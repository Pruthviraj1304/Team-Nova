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

// ---------------- WiFi & Time Configuration ----------------
// Fill these in before flashing — kept out of source control.
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

      LoRa.beginPacket();
      LoRa.print("SOS_ALERT:" DEVICE_ID);
      LoRa.endPacket();

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

      LoRa.beginPacket();
      LoRa.print("SOS_CLEARED:" DEVICE_ID);
      LoRa.endPacket();

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
    readINMP441();

    // Determine the current status string
    const char* currentStatus = sosActive ? "SOS_ACTIVE" : "NORMAL";

    // Prevent memory fragmentation using char array
    char dataBuffer[150];
    snprintf(dataBuffer, sizeof(dataBuffer), "%s,%s,%.2f,%.2f,%.2f,%d,%d,%.2f,%s",
             timeStr, DEVICE_ID, currentTemp, currentHum, currentPres,
             currentMQ135, currentMQ4, currentDB, currentStatus);

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
