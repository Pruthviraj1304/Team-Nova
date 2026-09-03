#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <driver/i2s.h>
#include <math.h> 
#include <SPI.h>
#include <LoRa.h>
#include "FS.h"
#include "SD.h"
#include <WiFi.h>
#include <time.h>
#include <stdlib.h>

// ---------------- WiFi & Time Configuration ----------------
const char* ssid       = "YOUR_WIFI_SSID";
const char* password   = "YOUR_WIFI_PASSWORD";
const char* ntpServer  = "pool.ntp.org";
const long  gmtOffset_sec = 19800; // Offset for IST (UTC +5:30)
const int   daylightOffset_sec = 0; // India does not use Daylight Saving

// ---------------- Pins Configuration ----------------
#define I2C_SDA 8
#define I2C_SCL 9

#define MQ135_PIN 4
#define MQ4_PIN 5
// SAFETY: the ESP32's ADC pins are only rated for 0-3.3V. Many MQ-4/MQ-135
// breakout boards run their analog output stage off the 5V VCC rail, so AO
// can swing up toward 5V. Verify with a multimeter that AO never exceeds
// ~3.3V at your board's maximum expected gas exposure before trusting these
// pins directly; if it can exceed 3.3V, add a resistor voltage divider
// (e.g. 10k/20k) between AO and the ESP32 pin first. Do not assume a 5V
// module's analog output is safe to feed in as-is.

#define I2S_SCK 15
#define I2S_WS  16
#define I2S_SD  17
#define I2S_PORT I2S_NUM_0

#define BUTTON_PIN 6
#define RGB_RED 7
#define RGB_GREEN 10
#define BUZZER_PIN 12

#define LORA_MOSI 11
#define LORA_MISO 13
#define LORA_SCK  14
#define LORA_CS   21
#define LORA_RST  38
#define LORA_DIO0 3

// SD Card SPI Pins (FSPI for ESP32-S3)
#define SD_MOSI 42
#define SD_MISO 41
#define SD_SCK  40
#define SD_CS   2

#define DEVICE_ID "MG-01"

// ---------------- MQ Gas Sensor Configuration ----------------
// Relative-to-baseline percentage bands. These are SENSOR-RESPONSE bands, not
// gas concentration/ppm thresholds — an uncalibrated MQ-4/MQ-135 cannot
// report a real concentration (that needs a per-sensor Ro baseline and the
// datasheet's Rs/Ro curve, which hasn't been done here). Tune these
// percentages during field testing, not raw ADC numbers.
const float MQ_ELEVATED_THRESHOLD_PCT = 20.0;   // below this: NORMAL
const float MQ_HIGH_THRESHOLD_PCT = 50.0;       // below this: ELEVATED
const float MQ_VERY_HIGH_THRESHOLD_PCT = 100.0; // below this: HIGH, at/above: VERY HIGH

const int MQ_BASELINE_SAMPLES = 150;           // within the suggested 100-200 range
const int MQ_BASELINE_SAMPLE_DELAY_MS = 15;    // ~2.3s total to collect
const unsigned long MQ_WARMUP_MS = 3000;       // short boot pause before sampling.
// ponytail: this is a practical operational compromise, not a true chemical
// warm-up — MQ heating elements take minutes, not seconds, to reach stable
// operating temperature, and the datasheet burn-in is 24-48h. Blocking every
// boot for that long isn't viable on a device you reflash constantly during
// testing. Best accuracy comes from the sensor already having been powered a
// while before reset. Upgrade path: skip re-calibration on a warm reboot (no
// power-cycle) and persist the last-known-good baseline instead.
const int MQ_CONSECUTIVE_READINGS_REQUIRED = 3; // debounce: a status change (in
                                                 // either direction) must be seen
                                                 // this many reads in a row before
                                                 // it's reported, so one noisy
                                                 // sample can't trigger or clear
                                                 // an alarm by itself.
const int MQ_BASELINE_TRIM_FRACTION = 10;       // drop the top/bottom 1/10th of
                                                 // calibration samples (a trimmed
                                                 // mean) so one spike during
                                                 // calibration can't skew the
                                                 // baseline the whole session runs on.
const int MQ_BASELINE_MIN_VALID_ADC = 50;       // baseline this close to either ADC
const int MQ_BASELINE_MAX_VALID_ADC = 4045;     // rail suggests a disconnected/
                                                 // faulty sensor, not clean air.
const float MQ_BASELINE_MAX_STDDEV = 250.0;     // calibration samples spread wider
                                                 // than this suggest an unstable
                                                 // environment/sensor, not a usable
                                                 // clean-air reading.
const int MQ_SATURATION_ADC = 4090;             // pinned this close to max — treat
                                                 // as sensor saturation/fault, not a
                                                 // precise extreme reading.
const int MQ_STUCK_REPEAT_THRESHOLD = 5;        // this many byte-identical
                                                 // consecutive readings in a row is
                                                 // implausible for real ADC noise —
                                                 // flag as a stuck sensor.

enum GasLevel { GAS_NORMAL = 0, GAS_ELEVATED = 1, GAS_HIGH = 2, GAS_VERY_HIGH = 3 };

struct GasFilterState {
  int confirmedLevel = GAS_NORMAL;
  int candidateLevel = GAS_NORMAL;
  int candidateCount = 0;
};

float mq4Baseline = 0;
float mq135Baseline = 0;
bool mq4BaselineValid = false;
bool mq135BaselineValid = false;
int mq4LastRaw = -1;
int mq135LastRaw = -1;
int mq4StuckCount = 0;
int mq135StuckCount = 0;
GasFilterState mq4Filter;
GasFilterState mq135Filter;

Adafruit_BME280 bme;
SPIClass loraSPI(FSPI);
SPIClass sdSPI(HSPI); 

unsigned long previousMillis = 0;
const long readInterval = 2000; 

bool sosActive = false; 
unsigned long previousSosMillis = 0;
const long sosBlinkInterval = 250; 
bool sosToggleState = false; 

// Button Debounce Variables
unsigned long lastButtonChange = 0;
const unsigned long debounceDelay = 50; 

float currentTemp = 0.0;
float currentHum = 0.0;
float currentPres = 0.0;
int currentMQ135 = 0;
int currentMQ4 = 0;
float currentDB = 0.0;
bool sdCardMounted = false;

// Function Prototypes
void setupI2S();
void readBME280();
void readMQ135();
void readMQ4();
void readINMP441();
void logDataToSD(String data);
void sendLoRaData(String data);
void syncTime();
void calibrateMQSensors();
void updateGasStatus();

void setup() {
  Serial.begin(115200);
  while (!Serial);

  Serial.println("Starting S3 Data Logger...");

  // Sync NTP Time over WiFi
  syncTime();

  Wire.begin(I2C_SDA, I2C_SCL);
  if (!bme.begin(0x76, &Wire)) Serial.println("BME280 not found!");
  
  pinMode(MQ135_PIN, INPUT);
  pinMode(MQ4_PIN, INPUT);
  calibrateMQSensors();

  setupI2S();

  pinMode(BUTTON_PIN, INPUT_PULLUP); 
  pinMode(RGB_RED, OUTPUT);
  pinMode(RGB_GREEN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RGB_RED, LOW);
  digitalWrite(RGB_GREEN, HIGH);
  digitalWrite(BUZZER_PIN, LOW);

  // Initialize SD Card
  sdSPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  if (!SD.begin(SD_CS, sdSPI, 4000000)) { 
    Serial.println("SD Card Mount Failed!");
  } else {
    Serial.println("SD Card Mounted.");
    sdCardMounted = true;
    
    // Write CSV Header if file doesn't exist
    File file = SD.open("/data.csv", FILE_APPEND);
    if (file) {
      if (file.size() == 0) {
        file.println("Time,DeviceID,Temp,Hum,Pres,MQ135,MQ4,dB,Status");
      }
      file.close();
      Serial.println("CSV Header verified.");
    }
  }

  loraSPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);

  LoRa.setSPI(loraSPI);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(433E6)) {
    Serial.println("LoRa Failed!");
    while (1);
  }
  LoRa.setTxPower(20);
  Serial.println("System Ready.");
}

void loop() {
  unsigned long currentMillis = millis();
  bool isPressed = (digitalRead(BUTTON_PIN) == LOW);

  // Grab the real time formatted string
  struct tm timeinfo;
  char timeStr[25];
  if (getLocalTime(&timeinfo)) {
    strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &timeinfo);
  } else {
    strcpy(timeStr, "Time_Not_Synced"); 
  }

  // 1. Debounced Button Logic
  if (currentMillis - lastButtonChange > debounceDelay) {
    if (isPressed && !sosActive) {
      Serial.println("\n!!! SOS BUTTON PRESSED !!!");

      // Sent 3x back-to-back: this is a one-shot packet (unlike telemetry,
      // which just naturally retries every 2s), and the LoRa link has been
      // running marginal (~-103 to -104 dBm) — a single copy can get lost in
      // the air with nothing to notice or retry it. A dropped emergency
      // signal is worse than a few redundant packets.
      for (int i = 0; i < 3; i++) {
        LoRa.beginPacket();
        LoRa.print("SOS_ALERT:" DEVICE_ID);
        LoRa.endPacket();
        if (i < 2) delay(80);
      }

      sosActive = true;
      sosToggleState = true; 
      previousSosMillis = currentMillis; 
      digitalWrite(RGB_GREEN, LOW); 
      digitalWrite(RGB_RED, HIGH);
      digitalWrite(BUZZER_PIN, HIGH);

      // Log SOS trigger with NTP time
      logDataToSD(String(timeStr) + "," + String(DEVICE_ID) + ",-,-,-,-,-,-,SOS_TRIGGERED");
      lastButtonChange = currentMillis;
      
    } else if (!isPressed && sosActive) {
      Serial.println("--- SOS Cleared ---");

      for (int i = 0; i < 3; i++) {
        LoRa.beginPacket();
        LoRa.print("SOS_CLEARED:" DEVICE_ID);
        LoRa.endPacket();
        if (i < 2) delay(80);
      }

      sosActive = false;
      digitalWrite(RGB_RED, LOW);
      digitalWrite(RGB_GREEN, HIGH);
      digitalWrite(BUZZER_PIN, LOW);
      
      // Log SOS clear with NTP time
      logDataToSD(String(timeStr) + "," + String(DEVICE_ID) + ",-,-,-,-,-,-,SOS_CLEARED");
      lastButtonChange = currentMillis;
    }
  }

  // Handle SOS Blinking independently of button state changes
  if (sosActive) {
    if (currentMillis - previousSosMillis >= sosBlinkInterval) {
      previousSosMillis = currentMillis;
      sosToggleState = !sosToggleState; 
      digitalWrite(RGB_RED, sosToggleState ? HIGH : LOW);
      digitalWrite(BUZZER_PIN, sosToggleState ? HIGH : LOW);
    }
  }

  if (currentMillis - previousMillis >= readInterval) {
    previousMillis = currentMillis;
    
    // Read sensors
    readBME280();
    readMQ135();
    readMQ4();
    updateGasStatus();
    readINMP441();
    
    // Determine the current status string
    const char* currentStatus = sosActive ? "SOS_ACTIVE" : "NORMAL";

    // Prevent memory fragmentation using char array
    // Trailing four fields are this unit's own measured clean-air baselines
    // (mq135Baseline, mq4Baseline) plus whether each baseline passed its
    // sanity checks (mq135BaselineValid, mq4BaselineValid — 0/1). Sent with
    // every packet so the dashboard always scales against THIS device's real,
    // current baseline instead of a guessed constant, and knows whether to
    // trust it. Appended at the end so existing field positions don't move.
    char dataBuffer[190];
    snprintf(dataBuffer, sizeof(dataBuffer), "%s,%s,%.2f,%.2f,%.2f,%d,%d,%.2f,%s,%.0f,%.0f,%d,%d",
             timeStr, DEVICE_ID, currentTemp, currentHum, currentPres,
             currentMQ135, currentMQ4, currentDB, currentStatus,
             mq135Baseline, mq4Baseline,
             mq135BaselineValid ? 1 : 0, mq4BaselineValid ? 1 : 0);

    Serial.print("Data: ");
    Serial.println(dataBuffer);
    
    // Save to SD first, then transmit LoRa to separate power spikes
    logDataToSD(String(dataBuffer));
    sendLoRaData(String(dataBuffer));
  }
}

// ---------------- NTP Time Sync Function ----------------

void syncTime() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  // Wait up to 10 seconds for connection
  while (WiFi.status() != WL_CONNECTED && attempts < 20) { 
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("Fetching NTP time");
    
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
    
    struct tm timeinfo;
    // Wait for time to set
    while (!getLocalTime(&timeinfo, 5000)) { 
      Serial.print(".");
    }
    Serial.println("\nTime successfully synchronized.");
    
    // Disconnect WiFi to save power and improve analog sensor stability
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    Serial.println("WiFi turned off (power saving).");
  } else {
    Serial.println("\nWiFi connection failed! Time will not be recorded.");
  }
}

// ---------------- SD Data Logging Function ----------------

void logDataToSD(String data) {
  if (!sdCardMounted) return;
  
  File file = SD.open("/data.csv", FILE_APPEND);
  if (file) {
    file.println(data);
    file.close();
    Serial.println(" -> Saved to SD");
  } else {
    Serial.println(" -> SD Write Failed");
  }
}

// ---------------- Existing Functions ----------------

void sendLoRaData(String data) {
  LoRa.beginPacket();
  LoRa.print(data);
  LoRa.endPacket();
}

void readBME280() { 
  currentTemp = bme.readTemperature(); 
  currentHum = bme.readHumidity(); 
  currentPres = bme.readPressure() / 100.0F; 
}

// A single analogRead() on these gas sensors jitters between calls — averaging
// a handful of quick samples smooths that out before it reaches the model.
int readAnalogAveraged(int pin) {
  const int samples = 8;
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delayMicroseconds(200);
  }
  return sum / samples;
}

void readMQ135() { currentMQ135 = readAnalogAveraged(MQ135_PIN); }
void readMQ4() { currentMQ4 = readAnalogAveraged(MQ4_PIN); }

// ---------------- MQ Gas Detection (relative to this unit's own baseline) ----------------

float safeBaseline(float b) { return b < 1.0 ? 1.0 : b; } // guards divide-by-zero

int compareInts(const void* a, const void* b) {
  return (*(const int*)a) - (*(const int*)b);
}

// Trimmed mean: sorts the calibration samples and averages only the middle
// 1 - 2/MQ_BASELINE_TRIM_FRACTION of them, so a single spike during
// calibration (a bump, a stray VOC, ADC noise) can't skew the baseline the
// whole session then gets judged against. Also reports the sample spread
// (max - min over the kept middle section) so the caller can flag a
// calibration that ran during an unstable environment as invalid, instead of
// silently trusting it.
float trimmedMeanAndSpread(int* samples, int count, float* spreadOut) {
  qsort(samples, count, sizeof(int), compareInts);
  int trim = count / MQ_BASELINE_TRIM_FRACTION;
  int from = trim;
  int to = count - trim; // exclusive
  if (to <= from) { from = 0; to = count; } // guard tiny sample counts
  long sum = 0;
  for (int i = from; i < to; i++) sum += samples[i];
  *spreadOut = (float)(samples[to - 1] - samples[from]);
  return (float)sum / (to - from);
}

void calibrateMQSensors() {
  Serial.println("MQ-4 / MQ-135 calibration: CALIBRATING");
  Serial.print("Warming up (");
  Serial.print(MQ_WARMUP_MS / 1000);
  Serial.println("s)...");
  delay(MQ_WARMUP_MS);

  static int mq4Samples[MQ_BASELINE_SAMPLES];
  static int mq135Samples[MQ_BASELINE_SAMPLES];
  for (int i = 0; i < MQ_BASELINE_SAMPLES; i++) {
    mq4Samples[i] = analogRead(MQ4_PIN);
    mq135Samples[i] = analogRead(MQ135_PIN);
    delay(MQ_BASELINE_SAMPLE_DELAY_MS);
  }

  float mq4Spread, mq135Spread;
  mq4Baseline = trimmedMeanAndSpread(mq4Samples, MQ_BASELINE_SAMPLES, &mq4Spread);
  mq135Baseline = trimmedMeanAndSpread(mq135Samples, MQ_BASELINE_SAMPLES, &mq135Spread);

  mq4BaselineValid = mq4Baseline >= MQ_BASELINE_MIN_VALID_ADC && mq4Baseline <= MQ_BASELINE_MAX_VALID_ADC && mq4Spread <= MQ_BASELINE_MAX_STDDEV;
  mq135BaselineValid = mq135Baseline >= MQ_BASELINE_MIN_VALID_ADC && mq135Baseline <= MQ_BASELINE_MAX_VALID_ADC && mq135Spread <= MQ_BASELINE_MAX_STDDEV;

  Serial.print("MQ4 baseline: "); Serial.print(mq4Baseline);
  Serial.print(" (spread "); Serial.print(mq4Spread);
  Serial.print(") -> "); Serial.println(mq4BaselineValid ? "READY" : "INVALID BASELINE");

  Serial.print("MQ135 baseline: "); Serial.print(mq135Baseline);
  Serial.print(" (spread "); Serial.print(mq135Spread);
  Serial.print(") -> "); Serial.println(mq135BaselineValid ? "READY" : "INVALID BASELINE");
}

// % increase over baseline -> one of the 4 sensor-RESPONSE bands (not gas
// concentration bands). Never a fixed ADC number.
int classifyLevel(int raw, float baseline) {
  float pct = ((raw - baseline) / safeBaseline(baseline)) * 100.0;
  if (pct < MQ_ELEVATED_THRESHOLD_PCT) return GAS_NORMAL;
  if (pct < MQ_HIGH_THRESHOLD_PCT) return GAS_ELEVATED;
  if (pct < MQ_VERY_HIGH_THRESHOLD_PCT) return GAS_HIGH;
  return GAS_VERY_HIGH;
}

// Debounce: a level only "sticks" once the same reading has shown up
// MQ_CONSECUTIVE_READINGS_REQUIRED times in a row — applies going up AND
// coming back down, so a single spike can't trigger it and a single dip
// can't clear it.
int filterLevel(GasFilterState &state, int rawLevel) {
  if (rawLevel == state.confirmedLevel) {
    state.candidateLevel = rawLevel;
    state.candidateCount = 0;
    return state.confirmedLevel;
  }
  if (rawLevel == state.candidateLevel) {
    state.candidateCount++;
  } else {
    state.candidateLevel = rawLevel;
    state.candidateCount = 1;
  }
  if (state.candidateCount >= MQ_CONSECUTIVE_READINGS_REQUIRED) {
    state.confirmedLevel = rawLevel;
    state.candidateCount = 0;
  }
  return state.confirmedLevel;
}

// Sensor-RESPONSE severity, identical wording for both sensors — this is
// deliberately NOT "methane detected"/"smoke detected" wording, since an
// uncalibrated MQ sensor can only honestly report how far its own reading
// has moved from its own baseline, not what specific gas caused it.
const char* levelLabel(int level) {
  switch (level) {
    case GAS_ELEVATED: return "ELEVATED";
    case GAS_HIGH: return "HIGH";
    case GAS_VERY_HIGH: return "VERY HIGH";
    default: return "NORMAL";
  }
}

// Tracks byte-identical consecutive readings — real ADC noise practically
// never repeats the exact same value this many times in a row, so it's a
// reasonable signal the sensor (or its wiring) is stuck rather than reading.
bool updateStuckCheck(int raw, int &lastRaw, int &stuckCount) {
  if (raw == lastRaw) stuckCount++; else stuckCount = 0;
  lastRaw = raw;
  return stuckCount >= MQ_STUCK_REPEAT_THRESHOLD;
}

// NOTE: these are relative SENSOR RESPONSE indicators, not calibrated ppm/%
// gas concentration readings. Raw ADC counts are never reported as a
// specific methane/gas concentration — that requires real per-sensor Ro
// calibration against the datasheet's Rs/Ro curve, which hasn't been done
// here (see mq4BaselineValid/mq135BaselineValid).
void updateGasStatus() {
  bool mq4Saturated = currentMQ4 >= MQ_SATURATION_ADC;
  bool mq4Stuck = updateStuckCheck(currentMQ4, mq4LastRaw, mq4StuckCount);
  int mq4Level = filterLevel(mq4Filter, classifyLevel(currentMQ4, mq4Baseline));
  float mq4Pct = ((currentMQ4 - mq4Baseline) / safeBaseline(mq4Baseline)) * 100.0;
  if (mq4Pct < 0) mq4Pct = 0;

  bool mq135Saturated = currentMQ135 >= MQ_SATURATION_ADC;
  bool mq135Stuck = updateStuckCheck(currentMQ135, mq135LastRaw, mq135StuckCount);
  int mq135Level = filterLevel(mq135Filter, classifyLevel(currentMQ135, mq135Baseline));
  float mq135Pct = ((currentMQ135 - mq135Baseline) / safeBaseline(mq135Baseline)) * 100.0;
  if (mq135Pct < 0) mq135Pct = 0;

  Serial.print("MQ4 | Raw: "); Serial.print(currentMQ4);
  Serial.print(" | Baseline: "); Serial.print(mq4Baseline, 0);
  Serial.print(" | Relative response: +"); Serial.print(mq4Pct, 0);
  Serial.print("% | STATUS: "); Serial.print(levelLabel(mq4Level));
  Serial.print(" | Baseline: "); Serial.print(mq4BaselineValid ? "VALID" : "INVALID");
  Serial.print(" | Concentration: NOT CALIBRATED");
  if (mq4Saturated) Serial.print(" | FAULT: ADC SATURATED");
  if (mq4Stuck) Serial.print(" | FAULT: SENSOR STUCK");
  Serial.println();

  Serial.print("MQ135 | Raw: "); Serial.print(currentMQ135);
  Serial.print(" | Baseline: "); Serial.print(mq135Baseline, 0);
  Serial.print(" | Relative response: +"); Serial.print(mq135Pct, 0);
  Serial.print("% | STATUS: "); Serial.print(levelLabel(mq135Level));
  Serial.print(" | Baseline: "); Serial.print(mq135BaselineValid ? "VALID" : "INVALID");
  Serial.print(" | Concentration: NOT CALIBRATED");
  if (mq135Saturated) Serial.print(" | FAULT: ADC SATURATED");
  if (mq135Stuck) Serial.print(" | FAULT: SENSOR STUCK");
  Serial.println();
}

void readINMP441() {
  size_t bytesIn = 0;
  int16_t sBuffer[256];
  esp_err_t result = i2s_read(I2S_PORT, &sBuffer, sizeof(sBuffer), &bytesIn, pdMS_TO_TICKS(100));
  if (result == ESP_OK && bytesIn > 0) {
    int samples_read = bytesIn / 2; 
    double sumOfSquares = 0;
    for (int i = 0; i < samples_read; i++) sumOfSquares += (sBuffer[i] * sBuffer[i]);
    double rms = sqrt(sumOfSquares / samples_read);
    currentDB = (rms > 0) ? 20.0 * log10(rms) + 40.0 : 0.0;
  } else currentDB = 0.0;
}

void setupI2S() {
  const i2s_config_t i2s_config = {
    .mode = i2s_mode_t(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = 16000,
    .bits_per_sample = i2s_bits_per_sample_t(16),
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = i2s_comm_format_t(I2S_COMM_FORMAT_STAND_I2S),
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };
  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  const i2s_pin_config_t pin_config = { .bck_io_num = I2S_SCK, .ws_io_num = I2S_WS, .data_out_num = I2S_PIN_NO_CHANGE, .data_in_num = I2S_SD };
  i2s_set_pin(I2S_PORT, &pin_config);
  i2s_start(I2S_PORT);
}