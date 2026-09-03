import type { AiRiskResult } from "../lib/mineguardAI";
import type { GasReading } from "./useDeviceReadings";

export type GroupStatus = "normal" | "warning" | "danger";

export interface Worker {
  id: string;
  name: string;
  checkIn: string;
  checkOut: string | null;
}

export interface HistoryPoint {
  t: number;
  methane: number;
}

export interface Group {
  id: string;
  name: string;
  zone: string;
  x: number;
  y: number;
  methane: number;
  airQuality: number;
  mq135Raw: number;
  temp: number;
  humidity: number;
  pressure: number;
  altitude: number;
  workers: Worker[];
  workerCount: number;
  battery: number;
  lastCheckin: number;
  status: GroupStatus;
  history: HistoryPoint[];
  live: boolean;
  sos: boolean;
  soundDb: number | null;
  vibrationG: number;
  /** MineGuard V2 Random Forest classification, or null if the AI backend is unreachable/not yet evaluated. */
  aiRisk: AiRiskResult | null;
  /** Set for the live hardware group: explains why its AI input isn't a calibrated reading. */
  aiNote: string | null;
  /** Honest raw/baseline/relative-response gas data — set only for the live hardware group; null for simulated groups (which have no real sensor behind them at all). */
  liveGas: { mq4: GasReading; mq135: GasReading } | null;
  /** Rule-based severity from liveGas alone (relative response + trend + persistence) — independent of the AI model, which still receives an approximated input. Null for simulated groups. */
  gasAlert: GasAlert | null;
}

export type GasAlertSeverity = "NORMAL" | "ELEVATED" | "HIGH" | "VERY HIGH";

export interface GasAlert {
  severity: GasAlertSeverity;
  /** Plain-language reasons this severity was reached, most significant first — e.g. "MQ-4 response +158% above baseline". */
  factors: string[];
}

export type BayState = "charging" | "full" | "empty";

export interface Bay {
  id: string;
  state: BayState;
  charge: number;
  deviceId: string | null;
}

export interface Alert {
  id: number;
  group: string;
  groupId: string;
  type: string;
  level: string;
  time: Date;
  acknowledged: boolean;
}

export const GROUP_DEFS = [
  // Kept as a simulated reference unit so the dashboard (and the AI
  // classification) can still be exercised when the live hardware below is
  // disconnected or acting up.
  { name: "Alpha-1 — Simulated", zone: "Tunnel 3, Sec B", x: 90, y: 150 },
  // Real hardware unit (mineg.cpp) — last entry, kept in sync with LIVE_GROUP_ID below.
  { name: "Field Unit — MG-01", zone: "Live wearable device", x: 330, y: 150 },
];

// The one physical wearable (mineg.cpp, device ID "MG-01") reports through
// the LoRa gateway (mineg_receiver.cpp) into the device_readings table.
// LIVE_GROUP_ID must match the group generated from GROUP_DEFS' last entry.
export const LIVE_DEVICE_ID = "MG-01";
export const LIVE_GROUP_ID = `MG-G${String(GROUP_DEFS.length).padStart(2, "0")}`;
// The simulated reference unit — must match the group generated from
// GROUP_DEFS' first entry. This is the only group manual mode can drive.
export const SIM_GROUP_ID = "MG-G01";

export function randRange(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

const WORKER_NAMES = [
  "Arjun Mehta", "Ravi Kumar", "Sanjay Singh", "Vikram Rao", "Suresh Yadav",
  "Deepak Sharma", "Manoj Tiwari", "Rakesh Verma", "Ajay Gupta", "Vinod Prasad",
  "Anil Chauhan", "Sunil Patel", "Naresh Reddy", "Prakash Joshi", "Dinesh Nair",
  "Ramesh Iyer", "Mahesh Pillai", "Santosh Das", "Gopal Mishra", "Rajesh Thakur",
];

function formatShiftTime(hoursAgo: number) {
  const d = new Date(Date.now() - hoursAgo * 3600 * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function makeWorkers(count: number, seedOffset: number): Worker[] {
  return Array.from({ length: count }, (_, i) => {
    const idx = (seedOffset * 7 + i * 3) % WORKER_NAMES.length;
    const checkedOut = Math.random() < 0.1;
    return {
      id: `W-${String(1000 + seedOffset * 10 + i)}`,
      name: WORKER_NAMES[idx],
      checkIn: formatShiftTime(randRange(3, 6)),
      checkOut: checkedOut ? formatShiftTime(randRange(0.1, 1)) : null,
    };
  });
}

export function makeGroup(def: (typeof GROUP_DEFS)[number], i: number): Group {
  const workers = makeWorkers(Math.round(randRange(3, 9)), i);
  return {
    id: `MG-G${String(i + 1).padStart(2, "0")}`,
    name: def.name,
    zone: def.zone,
    x: def.x,
    y: def.y,
    methane: randRange(0.2, 1.2),
    airQuality: randRange(20, 60),
    mq135Raw: Math.round(randRange(150, 900)),
    // Kept within the MineGuard V2 model's "Safe" training band (see
    // MineGuard_AI/MineGuard_Cleaned.csv) so the simulated baseline actually
    // reads as safe to the real model; only a spike event should push a
    // group's readings out of this band.
    temp: randRange(22, 28),
    humidity: randRange(52, 68),
    pressure: randRange(1007, 1019),
    altitude: -Math.round(randRange(40, 320)),
    workers,
    workerCount: workers.length,
    battery: Math.round(randRange(15, 100)),
    lastCheckin: Math.round(randRange(2, 40)),
    status: "normal",
    history: Array.from({ length: 30 }, (_, k) => ({ t: k, methane: randRange(0.2, 0.9) })),
    live: false,
    sos: false,
    soundDb: randRange(46, 62),
    vibrationG: randRange(0.05, 0.22),
    aiRisk: null,
    aiNote: null,
    liveGas: null,
    gasAlert: null,
  };
}

export function makeBay(i: number): Bay {
  const states: BayState[] = ["charging", "charging", "full", "empty"];
  const state = states[i % states.length];
  return {
    id: `BAY-${String(i + 1).padStart(2, "0")}`,
    state,
    charge: state === "full" ? 100 : state === "empty" ? 0 : Math.round(randRange(20, 85)),
    deviceId: state === "empty" ? null : `MG-D${String(100 + i)}`,
  };
}

export function beep(freq = 720) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = "square";
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // audio unavailable
  }
}
