// MineGuard X — Surface Gateway (Receiver Node)
//
// Sits at the surface within LoRa range of the wearable sender (mineg.cpp).
// Two things happen with every packet it receives:
//   1. Forwarded to Supabase over WiFi so the MineGuard X control-room web
//      dashboard can show live readings (this is what actually connects the
//      hardware to the app).
//   2. Mirrored onto a small local debug webpage (this ESP32's own IP,
//      printed to Serial on boot) so you can sanity-check LoRa reception
//      even when WiFi/Supabase is unavailable.
//
// Expected packet formats (see mineg.cpp):
//   "2026-09-03 10:15:22,MG-01,23.50,45.20,987.30,512,340,42.10,NORMAL,2180,1650,1,1"
//     (telemetry, every 2s — leading field is the sender's NTP-synced
//     timestamp, used only for its own SD log; we ignore it here since
//     Supabase stamps its own created_at on insert. Trailing four fields are
//     this unit's own measured clean-air baselines for MQ135/MQ4, and
//     whether each one passed its sanity checks (1/0) — forwarded as-is so
//     the dashboard scales against the device's real baseline instead of a
//     guessed constant, and knows whether to trust it. None of this is a
//     calibrated gas concentration — see mineg.cpp's MQ Gas Sensor
//     Configuration section for why.)
//   "SOS_ALERT:MG-01"                                 (button pressed)
//   "SOS_CLEARED:MG-01"                                (button released)
//
// Target board: ESP32-C3 Super Mini, wired to an SX1278 LoRa module, using
// the "LoRa" library (sandeepmistry/LoRa) already used by mineg.cpp.

#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <WebServer.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ---------------- WiFi & Supabase Configuration ----------------
// Same project as the web app's .env.local (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SUPABASE_URL = "https://oagikmfgjbuttqidznsm.supabase.co";
const char* SUPABASE_ANON_KEY = "sb_publishable_h-NT55R_9daWEjAWRX6nAg_J2JOmGrm";

// ---------------- LoRa SX1278 SPI Pins (ESP32-C3 Super Mini) ----------------
#define LORA_SCK  4
#define LORA_MISO 5
#define LORA_MOSI 6
#define LORA_CS   7
#define LORA_RST  3
#define LORA_DIO0 2

#define PACKET_BUFFER_SIZE 128
char rxBuffer[PACKET_BUFFER_SIZE] = "Waiting for first packet...";
int lastRssi = 0;
float lastSnr = 0.0;
String lastStatus = "NORMAL";

WebServer server(80);

// The sender keeps transmitting normal telemetry every 2s even while SOS is
// active (only SOS_ALERT/SOS_CLEARED packets carry the true state), so the
// gateway has to remember it and stamp every telemetry row accordingly —
// otherwise the next telemetry packet after a button press would overwrite
// the dashboard's live sos flag back to false while the button is still held.
bool deviceSosActive = false;

// ---------------- Local debug webpage (HTML/CSS/JS payload) ----------------
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE HTML><html>
<head>
  <title>LoRa Receiver Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background-color: #f4f7f6; color: #333; text-align: center; padding: 20px; }
    h1 { color: #2c3e50; }
    .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); max-width: 600px; margin: 20px auto; }
    .status { font-size: 1.5em; font-weight: bold; padding: 15px; border-radius: 5px; margin-bottom: 20px; text-transform: uppercase; }
    .status.NORMAL { background-color: #d4edda; color: #155724; }
    .status.EMERGENCY { background-color: #f8d7da; color: #721c24; animation: blink 1s infinite; }
    .status.CLEARED { background-color: #fff3cd; color: #856404; }
    @keyframes blink { 50% { opacity: 0.6; } }
    .data-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; text-align: left; }
    .data-label { font-weight: bold; color: #555; }
    .signal { margin-top: 20px; font-size: 0.9em; color: #777; background: #eee; padding: 10px; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>LoRa Telemetry Station</h1>
  <div class="card">
    <div id="status-box" class="status NORMAL">WAITING FOR DATA</div>
    <div class="data-row"><span class="data-label">Raw Payload:</span> <span id="payload">--</span></div>
    <div class="signal">
      <strong>RSSI:</strong> <span id="rssi">--</span> dBm &nbsp;|&nbsp;
      <strong>SNR:</strong> <span id="snr">--</span>
    </div>
  </div>

  <script>
    setInterval(function ( ) {
      fetch('/data')
        .then(response => response.json())
        .then(json => {
          document.getElementById('payload').innerText = json.data;
          document.getElementById('rssi').innerText = json.rssi;
          document.getElementById('snr').innerText = json.snr;

          let statusBox = document.getElementById('status-box');
          statusBox.innerText = json.status;
          statusBox.className = 'status ' + json.status;
        });
    }, 2000);
  </script>
</body>
</html>
)rawliteral";

void connectWiFi() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n--- Wi-Fi Connected ---");
  Serial.print("Local debug page: HTTP://");
  Serial.println(WiFi.localIP());
}

void handleRoot() {
  server.send(200, "text/html", index_html);
}

void handleDataEndpoint() {
  char jsonPayload[256];
  snprintf(jsonPayload, sizeof(jsonPayload),
           "{\"status\":\"%s\", \"data\":\"%s\", \"rssi\":%d, \"snr\":%.2f}",
           lastStatus.c_str(), rxBuffer, lastRssi, lastSnr);

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", jsonPayload);
}

// Returns the comma-separated field at `index` (0-based) from a CSV packet
// like "2026-09-03 10:15:22,MG-01,23.50,45.20,987.30,512,340,42.10,NORMAL",
// or "" if missing.
String csvField(const String& packet, int index) {
  int start = 0;
  for (int i = 0; i < index; i++) {
    int comma = packet.indexOf(',', start);
    if (comma == -1) return "";
    start = comma + 1;
  }
  int end = packet.indexOf(',', start);
  return end == -1 ? packet.substring(start) : packet.substring(start, end);
}

// POSTs one row into public.device_readings via the Supabase REST API.
// mq135BaselineValid/mq4BaselineValid are nullable: true/false once telemetry
// has reported them, unset (sent as null) for SOS packets, which carry no
// sensor data at all.
void postReading(const String& deviceId, const String& temp, const String& hum, const String& pres,
                  const String& mq135, const String& mq4, const String& db, bool sos,
                  const String& mq135Baseline, const String& mq4Baseline,
                  const String& mq135BaselineValid, const String& mq4BaselineValid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, dropping reading.");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure(); // NOTE: skips TLS cert validation — fine for a prototype gateway, pin Supabase's root CA for production.

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/device_readings";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "return=minimal");

  String body = "{";
  body += "\"device_id\":\"" + deviceId + "\"";
  body += temp.length() ? ",\"temp\":" + temp : ",\"temp\":null";
  body += hum.length() ? ",\"humidity\":" + hum : ",\"humidity\":null";
  body += pres.length() ? ",\"pressure\":" + pres : ",\"pressure\":null";
  body += mq135.length() ? ",\"mq135\":" + mq135 : ",\"mq135\":null";
  body += mq4.length() ? ",\"mq4\":" + mq4 : ",\"mq4\":null";
  body += db.length() ? ",\"db\":" + db : ",\"db\":null";
  body += mq135Baseline.length() ? ",\"mq135_baseline\":" + mq135Baseline : ",\"mq135_baseline\":null";
  body += mq4Baseline.length() ? ",\"mq4_baseline\":" + mq4Baseline : ",\"mq4_baseline\":null";
  // "1"/"0" from the packet -> real JSON booleans, not bare digits, so the
  // boolean columns don't depend on PostgREST's implicit int->bool casting.
  body += mq135BaselineValid.length() ? ",\"mq135_baseline_valid\":" + String(mq135BaselineValid == "1" ? "true" : "false") : ",\"mq135_baseline_valid\":null";
  body += mq4BaselineValid.length() ? ",\"mq4_baseline_valid\":" + String(mq4BaselineValid == "1" ? "true" : "false") : ",\"mq4_baseline_valid\":null";
  body += String(",\"sos\":") + (sos ? "true" : "false");
  body += "}";

  int status = http.POST(body);
  Serial.printf("Supabase POST -> %d\n", status);
  if (status <= 0) {
    Serial.println(http.errorToString(status));
  } else if (status >= 400) {
    // A non-2xx HTTP status (e.g. 400 for a missing/misnamed column, 401/403
    // for an RLS or key problem) has a JSON error body explaining exactly
    // why — print it instead of leaving that status code to be guessed at.
    Serial.print("Supabase error body: ");
    Serial.println(http.getString());
  }
  http.end();
}

void handlePacket(const String& packet) {
  Serial.print("Received -> ");
  Serial.println(packet);

  if (packet.startsWith("SOS_ALERT:")) {
    String deviceId = packet.substring(strlen("SOS_ALERT:"));
    lastStatus = "EMERGENCY";
    deviceSosActive = true;
    postReading(deviceId, "", "", "", "", "", "", true, "", "", "", "");
    return;
  }

  if (packet.startsWith("SOS_CLEARED:")) {
    String deviceId = packet.substring(strlen("SOS_CLEARED:"));
    lastStatus = "CLEARED";
    deviceSosActive = false;
    postReading(deviceId, "", "", "", "", "", "", false, "", "", "", "");
    return;
  }

  // Telemetry: "timestamp,DEVICE_ID,temp,hum,pres,mq135,mq4,db,STATUS,mq135Baseline,mq4Baseline,mq135BaselineValid,mq4BaselineValid" —
  // index 0 (the sender's own NTP timestamp) and the STATUS field (index 8)
  // are both ignored here: Supabase stamps its own created_at on insert, and
  // the sos flag we forward comes from deviceSosActive (set by the SOS
  // packets above), not from this field. The trailing four fields are the
  // sender's own measured clean-air baselines and whether each passed its
  // sanity checks, forwarded as-is so the dashboard always scales against
  // this device's real, current baseline and knows whether to trust it.
  String deviceId = csvField(packet, 1);
  if (deviceId.length() == 0) {
    Serial.println("Unrecognized packet, ignoring.");
    return;
  }
  lastStatus = deviceSosActive ? "EMERGENCY" : "NORMAL";
  String temp = csvField(packet, 2);
  String hum = csvField(packet, 3);
  String pres = csvField(packet, 4);
  String mq135 = csvField(packet, 5);
  String mq4 = csvField(packet, 6);
  String db = csvField(packet, 7);
  String mq135Baseline = csvField(packet, 9);
  String mq4Baseline = csvField(packet, 10);
  String mq135BaselineValid = csvField(packet, 11);
  String mq4BaselineValid = csvField(packet, 12);
  postReading(deviceId, temp, hum, pres, mq135, mq4, db, deviceSosActive, mq135Baseline, mq4Baseline, mq135BaselineValid, mq4BaselineValid);
}

void setup() {
  Serial.begin(115200);
  while (!Serial);

  Serial.println("Starting Gateway Node...");

  connectWiFi();

  server.on("/", handleRoot);
  server.on("/data", handleDataEndpoint);
  server.begin();
  Serial.println("Local debug web server started.");

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(433E6)) {
    Serial.println("LoRa Module Initialization Failed! Check wiring.");
    while (1);
  }

  LoRa.receive();
  Serial.println("LoRa Initialized. Gateway Ready.");
}

void loop() {
  server.handleClient();

  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
  }

  int packetSize = LoRa.parsePacket();
  if (packetSize == 0) return;

  int bytesRead = 0;
  while (LoRa.available() && bytesRead < (PACKET_BUFFER_SIZE - 1)) {
    rxBuffer[bytesRead++] = (char)LoRa.read();
  }
  rxBuffer[bytesRead] = '\0';

  lastRssi = LoRa.packetRssi();
  lastSnr = LoRa.packetSnr();
  Serial.printf("RSSI %d dBm\n", lastRssi);

  handlePacket(String(rxBuffer));

  LoRa.receive();
}
