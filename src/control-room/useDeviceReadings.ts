import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const HISTORY_LEN = 30;
const ADC_MAX = 4095; // 12-bit ADC (ESP32 default attenuation)
// mineg.cpp reports every 2s while powered and connected; anything older than
// this is treated as "hardware not currently connected" rather than live,
// however recent the row was when it did arrive.
const STALE_MS = 10_000;

export interface DeviceReading {
  id: number;
  deviceId: string;
  temp: number | null;
  humidity: number | null;
  pressure: number | null;
  mq135: number | null;
  mq4: number | null;
  mq135Baseline: number | null;
  mq4Baseline: number | null;
  mq135BaselineValid: boolean | null;
  mq4BaselineValid: boolean | null;
  db: number | null;
  sos: boolean;
  createdAt: string;
}

interface ReadingRow {
  id: number;
  device_id: string;
  temp: number | null;
  humidity: number | null;
  pressure: number | null;
  mq135: number | null;
  mq4: number | null;
  mq135_baseline: number | null;
  mq4_baseline: number | null;
  mq135_baseline_valid: boolean | null;
  mq4_baseline_valid: boolean | null;
  db: number | null;
  sos: boolean;
  created_at: string;
}

function rowToReading(row: ReadingRow): DeviceReading {
  return {
    id: row.id,
    deviceId: row.device_id,
    temp: row.temp,
    humidity: row.humidity,
    pressure: row.pressure,
    mq135: row.mq135,
    mq4: row.mq4,
    mq135Baseline: row.mq135_baseline,
    mq4Baseline: row.mq4_baseline,
    mq135BaselineValid: row.mq135_baseline_valid,
    mq4BaselineValid: row.mq4_baseline_valid,
    db: row.db,
    sos: row.sos,
    createdAt: row.created_at,
  };
}

// Raw MQ-135/MQ-4 ADC readings aren't calibrated gas curves yet, and this
// sensor pair's clean-air baseline sits far above 0 — a pure 0..ADC_MAX
// linear scale reads "high" even at rest. Rebasing around the device's own
// measured baseline (mineg.cpp's calibrateMQSensors(), forwarded with every
// reading) so clean air reads near 0% and only a genuine rise climbs toward
// 100%. The hardcoded fallbacks below are only used for old rows recorded
// before the sender started reporting its own baseline.
//
// IMPORTANT: this 0-4% / 0-100 scale is an INTERNAL display-scale index —
// it drives card colors, sort order, and the site-wide trend chart for both
// simulated and live groups, a pre-existing convention that predates real
// hardware and was never meant to represent a measured gas concentration.
// It is NOT shown to the user labeled as "Methane %"/"Air quality" anymore —
// see relativeResponsePercent/gasSeverity below for the honest numbers that
// now appear in the group detail panel. Reworking every consumer of this
// internal scale (GroupCard, ZoneMap, the trend chart, alert thresholds) to
// stop using it entirely — including for the always-mock simulated groups —
// is a larger, separate rewrite than the "remove the fake conversion" ask
// (which was about the live device's *display*, not the whole app's
// internal card-coloring convention). Flagging this scoping choice rather
// than making it silently.
const MQ135_BASELINE_FALLBACK = 2180;
const MQ4_BASELINE_FALLBACK = 1650;

function baselineRelative(raw: number, baseline: number): number {
  const headroom = ADC_MAX - baseline;
  return headroom <= 0 ? 0 : Math.max(0, (raw - baseline) / headroom);
}

export function mq135ToAirQuality(raw: number, baseline: number = MQ135_BASELINE_FALLBACK): number {
  return Math.round(Math.min(100, baselineRelative(raw, baseline) * 100));
}

export function mq4ToMethanePercent(raw: number, baseline: number = MQ4_BASELINE_FALLBACK): number {
  return Math.round(Math.min(4, baselineRelative(raw, baseline) * 4) * 100) / 100;
}

// ---------------- Honest gas sensor reporting ----------------
// Everything below is what the live device's gas readings are ACTUALLY
// shown as: relative response over this unit's own baseline, never a
// concentration. Mirrors mineg.cpp's MQ Gas Sensor Configuration exactly —
// same band percentages, same meaning — so the sender's Serial output and
// the dashboard never disagree about what "HIGH" means.

export type GasSeverity = "NORMAL" | "ELEVATED" | "HIGH" | "VERY HIGH";
export type GasTrend = "STABLE" | "RISING" | "RAPIDLY RISING" | "FALLING";

const GAS_ELEVATED_THRESHOLD_PCT = 20;
const GAS_HIGH_THRESHOLD_PCT = 50;
const GAS_VERY_HIGH_THRESHOLD_PCT = 100;
// Trend compares the average of the most recent readings against the
// average of the readings just before them; a gap this wide (percentage
// points) between those two windows counts as "rising" at all, and twice
// that counts as "rapidly rising" — small enough to catch a real move,
// large enough that normal ADC jitter alone won't trip it.
const GAS_TREND_RISING_DELTA_PCT = 8;
const GAS_TREND_RAPID_DELTA_PCT = 20;
const GAS_TREND_WINDOW = 3;

export interface GasReading {
  raw: number | null;
  baseline: number | null;
  baselineValid: boolean | null;
  /** Percent above baseline, clamped to >= 0. Never a gas concentration. */
  relativePercent: number;
  severity: GasSeverity;
  trend: GasTrend;
}

/** Percent above baseline. Clamped to >= 0 — a reading below baseline is reported as 0% response, not a negative one. */
export function relativeResponsePercent(raw: number, baseline: number): number {
  const safeBaseline = baseline <= 0 ? 1 : baseline;
  return Math.max(0, Math.round(((raw - safeBaseline) / safeBaseline) * 100));
}

export function gasSeverity(relativePercent: number): GasSeverity {
  if (relativePercent < GAS_ELEVATED_THRESHOLD_PCT) return "NORMAL";
  if (relativePercent < GAS_HIGH_THRESHOLD_PCT) return "ELEVATED";
  if (relativePercent < GAS_VERY_HIGH_THRESHOLD_PCT) return "HIGH";
  return "VERY HIGH";
}

/** `values` oldest-first, same units as relativeResponsePercent's output. */
export function gasTrend(values: number[]): GasTrend {
  if (values.length < GAS_TREND_WINDOW * 2) return "STABLE";
  const recent = values.slice(-GAS_TREND_WINDOW);
  const prior = values.slice(-GAS_TREND_WINDOW * 2, -GAS_TREND_WINDOW);
  const avg = (xs: number[]) => xs.reduce((sum, v) => sum + v, 0) / xs.length;
  const delta = avg(recent) - avg(prior);
  if (delta >= GAS_TREND_RAPID_DELTA_PCT) return "RAPIDLY RISING";
  if (delta >= GAS_TREND_RISING_DELTA_PCT) return "RISING";
  if (delta <= -GAS_TREND_RISING_DELTA_PCT) return "FALLING";
  return "STABLE";
}

/** `history` oldest-first, must include `latest` as its last element (matches useDeviceReadings' own history array). */
export function buildGasReading(
  latestRaw: number | null,
  baseline: number | null,
  baselineValid: boolean | null,
  history: DeviceReading[],
  rawKey: "mq4" | "mq135",
): GasReading {
  if (latestRaw == null || baseline == null) {
    return { raw: latestRaw, baseline, baselineValid, relativePercent: 0, severity: "NORMAL", trend: "STABLE" };
  }
  const relativePercent = relativeResponsePercent(latestRaw, baseline);
  const trendSeries = history
    .filter((r) => r[rawKey] != null && r[rawKey === "mq4" ? "mq4Baseline" : "mq135Baseline"] != null)
    .map((r) => relativeResponsePercent(r[rawKey] as number, r[rawKey === "mq4" ? "mq4Baseline" : "mq135Baseline"] as number));
  return {
    raw: latestRaw,
    baseline,
    baselineValid,
    relativePercent,
    severity: gasSeverity(relativePercent),
    trend: gasTrend(trendSeries),
  };
}

export function useDeviceReadings(deviceId: string) {
  const [latest, setLatest] = useState<DeviceReading | null>(null);
  const [history, setHistory] = useState<DeviceReading[]>([]);
  // Ticks on an interval purely to force `live` (below) to be re-evaluated
  // against the clock, so the hardware is correctly marked offline again
  // after STALE_MS pass with no new reading — not just at the moment a row
  // arrives or on mount.
  const [, setClockTick] = useState(0);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let cancelled = false;

    client
      .from("device_readings")
      .select(
        "id, device_id, temp, humidity, pressure, mq135, mq4, mq135_baseline, mq4_baseline, mq135_baseline_valid, mq4_baseline_valid, db, sos, created_at",
      )
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LEN)
      .then(({ data, error }) => {
        if (cancelled || error || !data || data.length === 0) return;
        const rows = data.map(rowToReading).reverse();
        setHistory(rows);
        setLatest(rows[rows.length - 1]);
      });

    const channel = client
      .channel(`device-readings-${deviceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "device_readings", filter: `device_id=eq.${deviceId}` },
        (payload) => {
          const reading = rowToReading(payload.new as ReadingRow);
          setLatest(reading);
          setHistory((prev) => [...prev, reading].slice(-HISTORY_LEN));
        },
      )
      .subscribe();

    const clock = setInterval(() => setClockTick((n) => n + 1), 2000);

    return () => {
      cancelled = true;
      clearInterval(clock);
      client.removeChannel(channel);
    };
  }, [deviceId]);

  const live = latest != null && Date.now() - new Date(latest.createdAt).getTime() < STALE_MS;

  return { latest, history, live };
}
