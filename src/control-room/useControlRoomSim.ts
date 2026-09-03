import { useEffect, useMemo, useRef, useState } from "react";
import { GROUP_DEFS, LIVE_DEVICE_ID, LIVE_GROUP_ID, SIM_GROUP_ID, beep, makeGroup, randRange, type Alert, type Group, type GasAlert, type HistoryPoint } from "./mockData";
import { useBays } from "./useBays";
import {
  buildGasReading,
  mq135ToAirQuality,
  mq4ToMethanePercent,
  useDeviceReadings,
  type DeviceReading,
  type GasReading,
  type GasSeverity,
} from "./useDeviceReadings";
import { predictRisk, riskClassToStatus, VIBRATION_PLACEHOLDER_G, type AiRiskFeatures, type AiRiskResult } from "../lib/mineguardAI";

export type ManualField = "methane" | "mq135Raw" | "temp" | "humidity" | "pressure" | "soundDb" | "vibrationG";

const UNCALIBRATED_NOTE =
  "AI input is approximate: the wearable's MQ gas sensors report raw, uncalibrated ADC counts (scaled into the model's ppm range), and it has no accelerometer, so vibration is a placeholder.";

// Shared by simulated AND live groups — both report methane/air-quality on
// the same 0-4% / 0-100 display scales (see useDeviceReadings.ts for the
// live path), so both must go through the exact same ppm mapping. Using two
// different formulas for "the same number" was the bug: a live 1.15% and a
// simulated 1.6% classified nothing alike because they took different paths
// into the model. Calibrated against MineGuard_Cleaned.csv's per-class
// ranges so a normal/resting value lands in the Safe band (mq4 34-236ppm,
// mq135 21-104ppm) and only a real spike lands in the High/Critical band,
// instead of the model seeing an arbitrary point outside anything it was
// trained on.
function methanePercentToPpm(methanePct: number): number {
  const pct = Math.min(4, Math.max(0, methanePct));
  return Math.round(pct <= 1.4 ? 34 + pct * 140 : 230 + (pct - 1.4) * 1800);
}
// Takes a 0-1 fraction of "how far toward max gas reading" rather than a
// group-type-specific unit, so simulated groups (fraction = manually-editable
// mq135Raw / 900) and the live device (fraction = baseline-relative air
// quality / 100) both land on the exact same ppm curve from the same concept,
// not two formulas that happen to produce similar-looking numbers.
function mq135FractionToPpm(fraction: number): number {
  return Math.round(20 + Math.min(1, Math.max(0, fraction)) * 84);
}

// A single raw ADC sample from these gas sensors is noisy enough on its own
// to swing the displayed reading (and the AI classification built on it)
// even when nothing real changed — the on-device Serial status already
// averages 8 quick reads and requires 3 consecutive agreeing readings before
// it commits to a status; the dashboard had neither, reacting instantly to
// every single row. Averaging the last few readings here brings the two in
// line. ~6s of lag at the sender's 2s cycle — enough to reject one noisy
// sample without meaningfully delaying a genuine sustained rise.
const GAS_SMOOTHING_SAMPLES = 3;

function recentAverage(history: DeviceReading[], key: "mq4" | "mq135"): number | null {
  const values = history
    .map((r) => r[key])
    .filter((v): v is number => v != null)
    .slice(-GAS_SMOOTHING_SAMPLES);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Combines both sensors' HONEST readings (relative response + trend +
// baseline validity — no ppm, no AI) into one severity + a plain-language
// list of what drove it, most significant first. This is the PRIMARY safety
// signal: the AI model (below) is a separate, secondary opinion that still
// necessarily receives an approximated ppm-shaped input, so it must not be
// the only thing deciding whether a gas condition is flagged.
const GAS_SEVERITY_RANK: Record<GasSeverity, number> = { NORMAL: 0, ELEVATED: 1, HIGH: 2, "VERY HIGH": 3 };

function buildGasAlert(mq4: GasReading, mq135: GasReading): GasAlert {
  const severity = GAS_SEVERITY_RANK[mq4.severity] >= GAS_SEVERITY_RANK[mq135.severity] ? mq4.severity : mq135.severity;
  const factors: string[] = [];
  if (mq4.severity !== "NORMAL") factors.push(`MQ-4 response +${mq4.relativePercent}% above baseline`);
  if (mq4.trend === "RISING" || mq4.trend === "RAPIDLY RISING") factors.push(`MQ-4 trend ${mq4.trend.toLowerCase()}`);
  if (mq135.severity !== "NORMAL") factors.push(`MQ-135 response +${mq135.relativePercent}% above baseline`);
  if (mq135.trend === "RISING" || mq135.trend === "RAPIDLY RISING") factors.push(`MQ-135 trend ${mq135.trend.toLowerCase()}`);
  if (mq4.baselineValid === false) factors.push("MQ-4 baseline calibration invalid — response % may be unreliable");
  if (mq135.baselineValid === false) factors.push("MQ-135 baseline calibration invalid — response % may be unreliable");
  if (factors.length === 0) factors.push("Both gas sensors reading within normal range of their baseline");
  return { severity, factors };
}

function mapLiveReadingToGroup(base: Group, latest: DeviceReading, history: DeviceReading[]): Group {
  const mq4Smoothed = recentAverage(history, "mq4");
  const mq135Smoothed = recentAverage(history, "mq135");
  const methane = mq4Smoothed != null ? mq4ToMethanePercent(mq4Smoothed, latest.mq4Baseline ?? undefined) : base.methane;
  const airQuality =
    mq135Smoothed != null ? mq135ToAirQuality(mq135Smoothed, latest.mq135Baseline ?? undefined) : base.airQuality;
  const mq135Raw = latest.mq135 ?? base.mq135Raw;
  const temp = latest.temp ?? base.temp;
  const humidity = latest.humidity ?? base.humidity;
  const pressure = latest.pressure ?? base.pressure;
  const soundDb = latest.db ?? base.soundDb;

  // Honest data: same smoothed value driving severity/trend, but `raw` shows
  // the actual most recent instant reading, not the smoothed one.
  const mq4Gas: GasReading = {
    ...buildGasReading(mq4Smoothed, latest.mq4Baseline, latest.mq4BaselineValid, history, "mq4"),
    raw: latest.mq4,
  };
  const mq135Gas: GasReading = {
    ...buildGasReading(mq135Smoothed, latest.mq135Baseline, latest.mq135BaselineValid, history, "mq135"),
    raw: latest.mq135,
  };
  const gasAlert = buildGasAlert(mq4Gas, mq135Gas);

  const status = latest.sos
    ? "danger"
    : gasAlert.severity === "HIGH" || gasAlert.severity === "VERY HIGH"
      ? "danger"
      : gasAlert.severity === "ELEVATED"
        ? "warning"
        : "normal";
  const lastCheckin = Math.max(0, Math.round((Date.now() - new Date(latest.createdAt).getTime()) / 1000));
  const historyWithGas = history.filter((r) => r.mq4 != null);
  const historyPoints: HistoryPoint[] =
    historyWithGas.length > 0
      ? historyWithGas.map((r, i) => ({
          t: i,
          methane: mq4ToMethanePercent(r.mq4 as number, r.mq4Baseline ?? undefined),
        }))
      : base.history;

  return {
    ...base,
    methane,
    airQuality,
    mq135Raw,
    temp,
    humidity,
    pressure,
    soundDb,
    vibrationG: VIBRATION_PLACEHOLDER_G,
    status: status as Group["status"],
    liveGas: { mq4: mq4Gas, mq135: mq135Gas },
    gasAlert,
    history: historyPoints,
    lastCheckin,
    live: true,
    sos: latest.sos,
    aiNote: UNCALIBRATED_NOTE,
  };
}

export function useControlRoomSim(soundOn: boolean) {
  const [simGroups, setSimGroups] = useState<Group[]>(() => GROUP_DEFS.map(makeGroup));
  const { bays, live: baysLive } = useBays();
  const { latest: liveReading, history: liveHistory, live: deviceLive } = useDeviceReadings(LIVE_DEVICE_ID);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [toast, setToast] = useState<Alert | null>(null);
  const [now, setNow] = useState(new Date());
  const [siteTrend, setSiteTrend] = useState(() =>
    Array.from({ length: 30 }, (_, k) => ({ t: k, avg: randRange(0.4, 0.8) })),
  );
  const [selectedAlertDetail, setSelectedAlertDetail] = useState<Alert | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, AiRiskResult>>({});
  const [aiOnline, setAiOnline] = useState(false);
  // Lets you drive the simulated reference unit's readings by hand — e.g. to
  // hand the AI model an extreme or edge-case combination and watch how it
  // classifies it — instead of the random walk. Never applies to the live
  // hardware group.
  const [manualMode, setManualMode] = useState(false);

  const alertIdRef = useRef(0);
  const lastAlertAtRef = useRef(0);
  const activeAlertGroupsRef = useRef(new Set<string>());
  // Tracks whether the currently-active SOS press has already raised its
  // alert, so a held button — which now keeps posting sos:true telemetry
  // rows every 2s (see mineg_receiver.cpp's deviceSosActive) — doesn't spawn
  // a fresh alert/modal off every single row. Only a false->true transition
  // (a genuinely new press) creates one; it resets on sos:false so the next
  // real press raises its own alert again.
  const sosActiveRef = useRef(false);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const liveReadingRef = useRef<DeviceReading | null>(null);
  liveReadingRef.current = liveReading;
  const deviceLiveRef = useRef(false);
  deviceLiveRef.current = deviceLive;
  const manualModeRef = useRef(false);
  manualModeRef.current = manualMode;

  // The one real device overlays its group's card with live sensor data;
  // every other group stays on the random-walk simulation below.
  const groups = useMemo(() => {
    const merged =
      !deviceLive || !liveReading
        ? simGroups
        : simGroups.map((g) => (g.id === LIVE_GROUP_ID ? mapLiveReadingToGroup(g, liveReading, liveHistory) : g));

    // Overlay the MineGuard V2 model's classification where we have one.
    // A live SOS press is an unambiguous manual signal, so it always wins
    // over the model's read; everything else falls back to the local
    // heuristic status computed above whenever the AI backend is unreachable.
    return merged.map((g) => {
      const ai = aiResults[g.id];
      if (!ai) return g;
      // Once the live hardware goes stale/offline, drop its last-known AI
      // read rather than keep showing it as current.
      if (g.id === LIVE_GROUP_ID && !deviceLive) return g;
      if (g.sos) return { ...g, aiRisk: ai };
      return { ...g, status: riskClassToStatus(ai.status), aiRisk: ai };
    });
  }, [simGroups, deviceLive, liveReading, liveHistory, aiResults]);

  // Run the live device's most recent reading through the real MineGuard V2
  // model whenever a new one arrives — but only while it's actually fresh;
  // otherwise this would fire once on mount for whatever old row Supabase
  // returns and classify data that's no longer meaningful.
  useEffect(() => {
    if (!liveReading || !deviceLive) return;
    // Same conversion path as every simulated group (see methanePercentToPpm/
    // mq135FractionToPpm above): compute the live device's display-scale
    // methane%/air-quality-index first, then feed those through the exact
    // same shared ppm mapping — not a separate ADC-derived formula. Averaged
    // over the last few readings (see recentAverage above) so the model
    // isn't classifying off a single noisy ADC sample.
    const mq4Smoothed = recentAverage(liveHistory, "mq4");
    const mq135Smoothed = recentAverage(liveHistory, "mq135");
    const methane = mq4Smoothed != null ? mq4ToMethanePercent(mq4Smoothed, liveReading.mq4Baseline ?? undefined) : 0;
    const airQuality = mq135Smoothed != null ? mq135ToAirQuality(mq135Smoothed, liveReading.mq135Baseline ?? undefined) : 0;
    const features: AiRiskFeatures = {
      temperature_c: liveReading.temp ?? 25,
      humidity_pct: liveReading.humidity ?? 50,
      pressure_hpa: liveReading.pressure ?? 1000,
      mq4_ch4_ppm: methanePercentToPpm(methane),
      mq135_gas_ppm: mq135FractionToPpm(airQuality / 100),
      sound_db: liveReading.db ?? 40,
      vibration_g: VIBRATION_PLACEHOLDER_G,
    };
    let cancelled = false;
    predictRisk(features).then((result) => {
      if (cancelled) return;
      if (result) {
        setAiResults((prev) => ({ ...prev, [LIVE_GROUP_ID]: result }));
        setAiOnline(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [liveReading, deviceLive, liveHistory]);

  // Run every simulated group's current readings through the same model on
  // each tick, so the whole dashboard reflects real model output rather than
  // the danger/warning thresholds below (which stay only as a fallback for
  // when the AI backend is unreachable).
  useEffect(() => {
    let cancelled = false;
    const targets = simGroups.filter((g) => g.id !== LIVE_GROUP_ID);
    Promise.all(
      targets.map(async (g) => {
        const features: AiRiskFeatures = {
          temperature_c: g.temp,
          humidity_pct: g.humidity,
          pressure_hpa: g.pressure,
          mq4_ch4_ppm: methanePercentToPpm(g.methane),
          mq135_gas_ppm: mq135FractionToPpm(g.mq135Raw / 900),
          sound_db: g.soundDb ?? 55,
          vibration_g: g.vibrationG,
        };
        return [g.id, await predictRisk(features)] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const succeeded = entries.filter((entry): entry is [string, AiRiskResult] => entry[1] !== null);
      if (succeeded.length > 0) {
        setAiResults((prev) => {
          const next = { ...prev };
          for (const [id, result] of succeeded) next[id] = result;
          return next;
        });
        setAiOnline(true);
      } else if (targets.length > 0) {
        setAiOnline(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [simGroups]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // A real SOS button press should raise an alert immediately, not wait for the next sim tick.
  useEffect(() => {
    if (!liveReading) return;
    if (!liveReading.sos) {
      sosActiveRef.current = false;
      return;
    }
    if (sosActiveRef.current) return; // already-active press, not a new one
    sosActiveRef.current = true;

    alertIdRef.current += 1;
    const groupName = simGroups.find((g) => g.id === LIVE_GROUP_ID)?.name ?? "Field Unit — MG-01";
    const newAlert: Alert = {
      id: alertIdRef.current,
      group: groupName,
      groupId: LIVE_GROUP_ID,
      type: "SOS — emergency button",
      level: "ACTIVE",
      time: new Date(),
      acknowledged: false,
    };
    setAlerts((a) => [newAlert, ...a].slice(0, 40));
    setToast(newAlert);
    if (soundOnRef.current) beep(880);
    setTimeout(() => setToast((t2) => (t2 && t2.id === newAlert.id ? null : t2)), 5000);
  }, [liveReading]);

  useEffect(() => {
    const t = setInterval(() => {
      let siteSum = 0;
      setSimGroups((prev) => {
        const next = prev.map((g) => {
          if (g.id === LIVE_GROUP_ID) {
            const liveReading = deviceLiveRef.current ? liveReadingRef.current : null;
            siteSum += liveReading?.mq4 != null ? mq4ToMethanePercent(liveReading.mq4, liveReading.mq4Baseline ?? undefined) : g.methane;
            return g;
          }
          if (g.id === SIM_GROUP_ID && manualModeRef.current) {
            siteSum += g.methane;
            return g;
          }
          // Pulls methane back toward baseline after a spike — without this,
          // the walk below has no upper bound or reversion force, so a spike
          // can wander near its peak for a very long time before random drift
          // happens to bring it back down (pre-existing behavior; harmless
          // under the old blunt >2.0%/>1.4% thresholds, but it made the AI
          // classification look stuck in Critical/High for minutes at a time).
          const reversion = Math.max(0, g.methane - 1.0) * 0.12;
          let methane = Math.max(0.1, g.methane + randRange(-0.15, 0.15) - reversion);
          const battery = Math.max(0, g.battery - (Math.random() < 0.3 ? 1 : 0));
          // Walk bounds are kept inside the MineGuard V2 model's "Safe" training
          // band (see MineGuard_AI/MineGuard_Cleaned.csv) so a non-spike tick
          // reads as safe to the real model instead of drifting into another
          // hazard signature by accident.
          const humidity = Math.min(70, Math.max(50, g.humidity + randRange(-1.5, 1.5)));
          const pressure = Math.min(1020, Math.max(1006, g.pressure + randRange(-0.8, 0.8)));
          const lastCheckin = Math.random() < 0.7 ? Math.round(randRange(1, 6)) : g.lastCheckin + 5;
          const spike = Math.random() < 0.035;
          if (spike) methane = randRange(2.2, 3.5);
          const status = methane > 2.0 ? "danger" : methane > 1.4 ? "warning" : lastCheckin > 30 ? "warning" : "normal";
          const history = [...g.history.slice(1), { t: g.history[g.history.length - 1].t + 1, methane }];
          siteSum += methane;
          const soundDb = spike
            ? randRange(70, 95)
            : Math.min(64, Math.max(44, (g.soundDb ?? 55) + randRange(-2, 2)));
          const vibrationG = spike ? randRange(2.5, 5.5) : Math.min(0.25, Math.max(0.05, g.vibrationG + randRange(-0.03, 0.03)));

          if (spike) {
            const nowMs = Date.now();
            const cooldownOk = nowMs - lastAlertAtRef.current >= 10000;
            const alreadyActive = activeAlertGroupsRef.current.has(g.id);
            if (cooldownOk && !alreadyActive) {
              lastAlertAtRef.current = nowMs;
              activeAlertGroupsRef.current.add(g.id);
              alertIdRef.current += 1;
              const newAlert: Alert = {
                id: alertIdRef.current,
                group: g.name,
                groupId: g.id,
                type: "Methane spike",
                level: methane.toFixed(2) + "%",
                time: new Date(),
                acknowledged: false,
              };
              setAlerts((a) => [newAlert, ...a].slice(0, 40));
              setToast(newAlert);
              if (soundOnRef.current) beep(880);
              setTimeout(() => setToast((t2) => (t2 && t2.id === newAlert.id ? null : t2)), 5000);
            }
          }

          return { ...g, methane, battery, humidity, pressure, lastCheckin, status: status as Group["status"], history, soundDb, vibrationG };
        });
        setSiteTrend((prevTrend) => [
          ...prevTrend.slice(1),
          { t: prevTrend[prevTrend.length - 1].t + 1, avg: siteSum / next.length },
        ]);
        return next;
      });
    }, 2500);
    return () => clearInterval(t);
  }, []);

  function acknowledge(id: number) {
    setAlerts((a) =>
      a.map((al) => {
        if (al.id === id) {
          activeAlertGroupsRef.current.delete(al.groupId);
          const acked = { ...al, acknowledged: true };
          setSelectedAlertDetail(acked);
          return acked;
        }
        return al;
      }),
    );
  }

  function renameGroup(id: string, newName: string) {
    setSimGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name: newName } : g)));
  }

  function deleteGroup(id: string) {
    setSimGroups((prev) => prev.filter((g) => g.id !== id));
  }

  function addWorker(groupId: string, name: string) {
    setSimGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const worker = {
          id: `W-${Date.now()}`,
          name,
          checkIn: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          checkOut: null,
        };
        const workers = [...g.workers, worker];
        return { ...g, workers, workerCount: workers.length };
      }),
    );
  }

  function removeWorker(groupId: string, workerId: string) {
    setSimGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const workers = g.workers.filter((w) => w.id !== workerId);
        return { ...g, workers, workerCount: workers.length };
      }),
    );
  }

  function renameWorker(groupId: string, workerId: string, newName: string) {
    setSimGroups((prev) =>
      prev.map((g) => (g.id !== groupId ? g : { ...g, workers: g.workers.map((w) => (w.id === workerId ? { ...w, name: newName } : w)) })),
    );
  }

  function setManualField(field: ManualField, value: number) {
    setSimGroups((prev) => prev.map((g) => (g.id === SIM_GROUP_ID ? { ...g, [field]: value } : g)));
  }

  return {
    groups,
    bays,
    baysLive,
    deviceLive,
    aiOnline,
    alerts,
    toast,
    now,
    siteTrend,
    selectedAlertDetail,
    setSelectedAlertDetail,
    acknowledge,
    renameGroup,
    deleteGroup,
    addWorker,
    removeWorker,
    renameWorker,
    manualMode,
    setManualMode,
    setManualField,
  };
}
