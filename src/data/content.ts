import {
  Wind,
  Gauge,
  Radio,
  HardDrive,
  Mic,
  BellRing,
  Battery,
  MonitorSmartphone,
  Siren,
  ShieldAlert,
  Flame,
  ThermometerSun,
  Cpu,
  DollarSign,
  Zap,
  ClipboardCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const stats: { label: string; value: number; suffix: string; icon: LucideIcon }[] = [
  { label: "Sensor refresh rate", value: 2, suffix: "s", icon: Gauge },
  { label: "LoRa alert range", value: 5, suffix: " km", icon: Radio },
  { label: "Hazard classes tracked", value: 6, suffix: "+", icon: ShieldAlert },
  { label: "On-device data retention", value: 100, suffix: "%", icon: HardDrive },
];

export const features: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Real-time gas monitoring",
    description: "Continuous methane and toxic-gas sampling via MQ-4 and MQ-135 sensors, flagged the moment thresholds are crossed.",
    icon: Wind,
  },
  {
    title: "Environmental telemetry",
    description: "BME280 tracks temperature, humidity, and atmospheric pressure to catch ventilation and pressure anomalies early.",
    icon: ThermometerSun,
  },
  {
    title: "OLED status display",
    description: "On-device readout shows live sensor values and system state without needing a paired phone or radio call.",
    icon: MonitorSmartphone,
  },
  {
    title: "Buzzer + RGB alerts",
    description: "Unmistakable audio and color-coded visual escalation the instant a reading drifts outside safe range.",
    icon: BellRing,
  },
  {
    title: "Emergency SOS button",
    description: "One press broadcasts a manual distress signal and geotagged event straight to the control room.",
    icon: Siren,
  },
  {
    title: "LoRa long-range link",
    description: "Long-range, low-power wireless keeps every unit connected to the surface, even deep underground.",
    icon: Radio,
  },
  {
    title: "Local data logging",
    description: "Every critical event is timestamped and written to microSD, independent of network availability.",
    icon: HardDrive,
  },
  {
    title: "Audio capture",
    description: "INMP441 microphone records ambient audio during emergencies to aid investigation and rescue response.",
    icon: Mic,
  },
  {
    title: "All-day battery",
    description: "Rechargeable power module built for a full shift underground, with a portable lightweight housing.",
    icon: Battery,
  },
];

export const hardware: { name: string; purpose: string; icon: LucideIcon }[] = [
  { name: "ESP32-S3", purpose: "Main controller", icon: Cpu },
  { name: "MQ-4", purpose: "Methane gas detection", icon: Flame },
  { name: "MQ-135", purpose: "Air quality & toxic gas detection", icon: Wind },
  { name: "BME280", purpose: "Temperature, humidity, pressure", icon: ThermometerSun },
  { name: "OLED Display", purpose: "Live sensor readout", icon: MonitorSmartphone },
  { name: "LoRa Module", purpose: "Wireless communication", icon: Radio },
  { name: "INMP441 Mic", purpose: "Emergency audio recording", icon: Mic },
  { name: "MicroSD Module", purpose: "Event & data storage", icon: HardDrive },
  { name: "Buzzer", purpose: "Audio alert", icon: BellRing },
  { name: "RGB LED", purpose: "Visual status indication", icon: Zap },
  { name: "SOS Button", purpose: "Manual emergency alert", icon: Siren },
  { name: "Battery Module", purpose: "Portable power supply", icon: Battery },
];

export const workflow: { title: string; description: string }[] = [
  { title: "Power on", description: "Device boots and the ESP32-S3 initializes every connected sensor." },
  { title: "Continuous sensing", description: "Gas, temperature, humidity, and pressure values are sampled on a tight loop." },
  { title: "Condition check", description: "Readings are compared against safety thresholds in real time." },
  { title: "Normal — display & log", description: "Safe readings stream to the OLED and monitoring continues uninterrupted." },
  { title: "Abnormal — activate alarm", description: "Buzzer sounds and the RGB LED shifts to red the instant a threshold is breached." },
  { title: "Transmit & store", description: "An emergency alert fires over LoRa while the event is written to the microSD card." },
  { title: "Control room response", description: "The surface dashboard receives the alert and rescue coordination begins." },
];

export const stationaryMode = {
  name: "Stationary Mode",
  tagline: "Mounted at fixed checkpoints for zone-wide coverage",
  points: [
    "Continuous environmental baseline for a shaft or tunnel section",
    "Extended battery life via external or mains power",
    "Acts as a relay point across the monitored zone",
  ],
};

export const applications = [
  "Underground coal mines",
  "Metal mines",
  "Tunnel construction",
  "Industrial hazardous areas",
  "Underground rescue operations",
  "Smart mining systems",
];

export const advantages: { title: string; icon: LucideIcon }[] = [
  { title: "Portable & lightweight", icon: Wrench },
  { title: "Low-cost implementation", icon: DollarSign },
  { title: "Real-time monitoring", icon: Gauge },
  { title: "Immediate emergency alerts", icon: Siren },
  { title: "Long-range communication", icon: Radio },
  { title: "Local event recording", icon: HardDrive },
  { title: "Easy installation", icon: ClipboardCheck },
  { title: "Improved worker safety", icon: ShieldAlert },
];

export const futureScope = [
  "AI-based accident prediction",
  "GPS/UWB indoor worker tracking",
  "Multi-worker monitoring",
  "Cloud data storage",
  "Mobile application",
  "Camera-based hazard detection",
  "Digital mine mapping",
  "Automatic rescue coordination",
];
