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
    db: row.db,
    sos: row.sos,
    createdAt: row.created_at,
  };
}

// Raw MQ-135/MQ-4 ADC readings aren't calibrated gas curves yet — these are
// rough linear approximations to drive the dashboard until real curve data
// is gathered from the sensors.
export function mq135ToAirQuality(raw: number): number {
  return Math.round(Math.min(100, Math.max(0, (raw / ADC_MAX) * 100)));
}

export function mq4ToMethanePercent(raw: number): number {
  return Math.round(Math.min(4, Math.max(0, (raw / ADC_MAX) * 4)) * 100) / 100;
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
      .select("id, device_id, temp, humidity, pressure, mq135, mq4, db, sos, created_at")
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
