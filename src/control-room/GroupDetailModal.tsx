import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BrainCircuit, Check, Pencil, Plus, SlidersHorizontal, Trash2, Users, WifiOff, X } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LIVE_GROUP_ID, SIM_GROUP_ID, type Group } from "./mockData";
import { useDashTheme } from "./theme";
import { statusColor } from "./GroupCard";
import { riskClassToStatus } from "../lib/mineguardAI";
import type { ManualField } from "./useControlRoomSim";

interface ManualFieldDef {
  key: ManualField;
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  suffix: string;
}

export function GroupDetailModal({
  group,
  groups,
  onClose,
  onRename,
  manualMode,
  onSetManualMode,
  onSetManualField,
  onAddWorker,
  onRemoveWorker,
  onRenameWorker,
}: {
  group: Group;
  groups: Group[];
  onClose: () => void;
  onRename: (id: string, name: string) => void;
  manualMode: boolean;
  onSetManualMode: (value: boolean) => void;
  onSetManualField: (field: ManualField, value: number) => void;
  onAddWorker: (groupId: string, name: string) => void;
  onRemoveWorker: (groupId: string, workerId: string) => void;
  onRenameWorker: (groupId: string, workerId: string, name: string) => void;
}) {
  const { colors } = useDashTheme();
  const g = groups.find((gr) => gr.id === group.id) ?? group;
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(g.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [newWorkerName, setNewWorkerName] = useState("");
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [workerNameDraft, setWorkerNameDraft] = useState("");

  function startWorkerEdit(workerId: string, currentName: string) {
    setEditingWorkerId(workerId);
    setWorkerNameDraft(currentName);
  }
  function saveWorkerEdit() {
    const trimmed = workerNameDraft.trim();
    if (editingWorkerId && trimmed) onRenameWorker(g.id, editingWorkerId, trimmed);
    setEditingWorkerId(null);
  }
  function submitNewWorker() {
    const trimmed = newWorkerName.trim();
    if (trimmed) onAddWorker(g.id, trimmed);
    setNewWorkerName("");
  }
  const sColor = statusColor(colors, g.status);
  const awaitingHardware = g.id === LIVE_GROUP_ID && !g.live;
  const isSimGroup = g.id === SIM_GROUP_ID;
  const manualActive = isSimGroup && manualMode;

  // Rounded for display — the underlying walk leaves long float tails (e.g.
  // 66.80000000000001) that are noisy to edit against.
  const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals;
  const manualFields: ManualFieldDef[] = [
    { key: "methane", label: "Methane (%)", value: round(g.methane, 2), step: 0.1, min: 0, max: 5, suffix: "%" },
    // Capped at 900, not the sensor's full 12-bit range — useControlRoomSim's mq135FractionToPpm (fed g.mq135Raw / 900) clamps there too, so anything higher would have no further effect.
    { key: "mq135Raw", label: "Air quality (raw)", value: round(g.mq135Raw, 0), step: 10, min: 0, max: 900, suffix: "" },
    { key: "temp", label: "Temperature (°C)", value: round(g.temp, 1), step: 0.5, min: -20, max: 80, suffix: "°C" },
    { key: "humidity", label: "Humidity (%)", value: round(g.humidity, 1), step: 1, min: 0, max: 100, suffix: "%" },
    { key: "pressure", label: "Pressure (hPa)", value: round(g.pressure, 1), step: 1, min: 800, max: 1100, suffix: "hPa" },
    { key: "soundDb", label: "Sound level (dB)", value: round(g.soundDb ?? 55, 1), step: 1, min: 0, max: 150, suffix: "dB" },
    { key: "vibrationG", label: "Vibration (g)", value: round(g.vibrationG, 2), step: 0.05, min: 0, max: 10, suffix: "g" },
  ];
  const readOnlyMetrics: [string, string][] = [
    ["Altitude", `${g.altitude} m`],
    ["Battery", `${g.battery}%`],
    ["Last check-in", `${g.lastCheckin}s ago`],
  ];

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function startEdit() {
    setNameDraft(g.name);
    setIsEditing(true);
  }
  function saveEdit() {
    const trimmed = nameDraft.trim();
    if (trimmed) onRename(g.id, trimmed);
    setIsEditing(false);
  }

  // Live groups show the honest gas sensor panel (below) instead of these
  // two rows — see g.liveGas. Simulated groups have no real sensor behind
  // them at all, so their existing 0-4%/0-100 display convention is kept
  // as-is here (out of scope for the "remove the fake conversion" fix,
  // which was about the live device specifically).
  const metrics: [string, string][] = [
    ...(g.liveGas ? [] : ([["Methane", `${g.methane.toFixed(2)}%`], ["Air quality index", String(g.airQuality)]] as [string, string][])),
    ["Temperature", `${g.temp}°C`],
    ["Humidity", `${g.humidity.toFixed(0)}%`],
    ["Atmospheric pressure", `${g.pressure.toFixed(0)} hPa`],
    ["Altitude", `${g.altitude} m`],
    ["Battery", `${g.battery}%`],
    ["Last check-in", `${g.lastCheckin}s ago`],
    ...(g.soundDb != null ? ([["Sound level", `${g.soundDb.toFixed(0)} dB`]] as [string, string][]) : []),
    ["Vibration", `${g.vibrationG.toFixed(2)} g`],
  ];

  return (
    <AnimatePresence>
      <motion.div
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="max-h-[90vh] w-full max-w-[460px] overflow-y-auto rounded-lg border border-[var(--dash-border)] bg-[var(--dash-panel)] p-6"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2.5">
            {isEditing ? (
              <div className="flex flex-1 items-center gap-1.5">
                <input
                  ref={inputRef}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setIsEditing(false);
                  }}
                  className="w-full rounded border px-2 py-1 text-lg font-bold outline-none"
                  style={{ background: "var(--dash-panel-alt)", borderColor: colors.teal, color: "var(--dash-text)" }}
                />
                <button
                  onClick={saveEdit}
                  title="Save name"
                  className="flex cursor-pointer rounded p-1.5"
                  style={{ background: colors.teal }}
                >
                  <Check size={14} color={colors.bg} />
                </button>
              </div>
            ) : (
              <div className="flex-1 text-lg font-bold">{g.name}</div>
            )}
            <div className="flex items-center gap-2">
              {!isEditing && (
                <button
                  onClick={startEdit}
                  title="Rename group"
                  className="flex cursor-pointer rounded border border-[var(--dash-border)] p-1.5 text-[var(--dash-text-muted)]"
                >
                  <Pencil size={13} />
                </button>
              )}
              <button onClick={onClose} className="flex cursor-pointer text-[var(--dash-text-muted)]">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="mb-1 flex items-center gap-2 font-mono text-xs text-[var(--dash-text-muted)]">
            <span>
              Device {g.id} · {g.zone}
            </span>
            {g.live && (
              <span
                className="rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide"
                style={{ background: `${colors.green}22`, border: `1px solid ${colors.green}`, color: colors.green }}
              >
                Live
              </span>
            )}
            {g.sos && (
              <span
                className="rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide"
                style={{ background: `${colors.red}22`, border: `1px solid ${colors.red}`, color: colors.red }}
              >
                SOS active
              </span>
            )}
          </div>

          <div className="mb-3.5 flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1"
              style={{ background: `${colors.teal}22`, border: `1px solid ${colors.teal}` }}
            >
              <Users size={13} color={colors.teal} />
              <span className="font-mono text-xs font-bold" style={{ color: colors.teal }}>
                {g.workerCount} workers in this group
              </span>
            </div>

            {isSimGroup && (
              <button
                onClick={() => onSetManualMode(!manualMode)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1"
                style={{
                  background: manualMode ? `${colors.amber}22` : "transparent",
                  border: `1px solid ${manualMode ? colors.amber : "var(--dash-border)"}`,
                  color: manualMode ? colors.amber : "var(--dash-text-muted)",
                }}
                title="Drive this unit's readings by hand to test how the AI classifies them"
              >
                <SlidersHorizontal size={13} />
                <span className="font-mono text-xs font-bold">Manual mode {manualMode ? "ON" : "OFF"}</span>
              </button>
            )}
          </div>

          {awaitingHardware ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--dash-border)] py-8 text-[var(--dash-text-muted)]">
              <WifiOff size={22} />
              <span className="font-mono text-xs">Waiting for hardware to connect</span>
              <span className="max-w-[280px] text-center text-[11px]">
                No readings have been received recently. Boot the wearable to see live sensor data and AI classification here.
              </span>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={g.history}>
                  <defs>
                    <linearGradient id="modalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={sColor} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={sColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis hide dataKey="t" />
                  <YAxis hide domain={[0, 3.5]} />
                  <Tooltip
                    contentStyle={{ background: colors.panelAlt, border: `1px solid ${colors.border}`, fontSize: 11 }}
                    formatter={(v) => [`${Number(v).toFixed(2)}%`, "CH4"]}
                    labelFormatter={() => ""}
                  />
                  <Area type="monotone" dataKey="methane" stroke={sColor} strokeWidth={2} fill="url(#modalGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>

              {g.liveGas && (
                <div className="mb-3.5 space-y-2.5">
                  {(
                    [
                      ["mq4", "MQ-4 (Methane) Sensor"],
                      ["mq135", "MQ-135 (Gas/Smoke) Sensor"],
                    ] as const
                  ).map(([key, label]) => {
                    const gas = g.liveGas![key];
                    const sevColor =
                      gas.severity === "VERY HIGH" || gas.severity === "HIGH"
                        ? colors.red
                        : gas.severity === "ELEVATED"
                          ? colors.amber
                          : colors.green;
                    return (
                      <div key={key} className="rounded-md border p-3" style={{ borderColor: sevColor }}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                          <span
                            className="rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: `${sevColor}22`, color: sevColor }}
                          >
                            {gas.severity}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-[var(--dash-text-muted)]">Raw ADC</span>
                            <span className="font-semibold">{gas.raw ?? "—"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--dash-text-muted)]">Baseline</span>
                            <span className="font-semibold">{gas.baseline != null ? Math.round(gas.baseline) : "—"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--dash-text-muted)]">Relative response</span>
                            <span className="font-semibold">+{gas.relativePercent}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--dash-text-muted)]">Trend</span>
                            <span className="font-semibold">{gas.trend}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--dash-text-muted)]">Baseline status</span>
                            <span className="font-semibold" style={{ color: gas.baselineValid === false ? colors.red : undefined }}>
                              {gas.baselineValid == null ? "—" : gas.baselineValid ? "VALID" : "INVALID"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--dash-text-muted)]">Concentration</span>
                            <span className="font-semibold">NOT CALIBRATED</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-[10px] text-[var(--dash-text-muted)]">
                    "Relative response" is how far this reading sits above the sensor's own measured clean-air baseline — it is not a gas
                    concentration. This hardware has not been calibrated against a real methane/gas reference, so no ppm or % concentration
                    is shown.
                  </div>
                </div>
              )}

              {manualActive ? (
                <>
                  <div className="mb-2.5 grid grid-cols-2 gap-2.5">
                    {manualFields.map((f) => (
                      <label key={f.key} className="block">
                        <span className="mb-0.5 block text-[11px] text-[var(--dash-text-muted)]">{f.label}</span>
                        <input
                          type="number"
                          value={f.value}
                          step={f.step}
                          min={f.min}
                          max={f.max}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            // The AI backend hard-rejects (422) anything outside its physical
                            // sensor ranges — clamp here so a typo, a spinner nudge past `max`,
                            // or an empty-field intermediate state can never reach it and
                            // silently break the prediction for this field.
                            if (Number.isFinite(value)) onSetManualField(f.key, Math.min(f.max, Math.max(f.min, value)));
                          }}
                          className="w-full rounded border px-2 py-1 font-mono text-[13px] outline-none"
                          style={{ background: "var(--dash-panel-alt)", borderColor: colors.amber, color: "var(--dash-text)" }}
                        />
                      </label>
                    ))}
                  </div>
                  {readOnlyMetrics.map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[var(--dash-border)] py-1.5">
                      <span className="text-[13px] text-[var(--dash-text-muted)]">{k}</span>
                      <span className="font-mono text-[13px] font-semibold">{v}</span>
                    </div>
                  ))}
                </>
              ) : (
                metrics.map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-[var(--dash-border)] py-1.5">
                    <span className="text-[13px] text-[var(--dash-text-muted)]">{k}</span>
                    <span className="font-mono text-[13px] font-semibold">{v}</span>
                  </div>
                ))
              )}
            </>
          )}

          {g.gasAlert && (
            <div
              className="mt-4.5 rounded-md border p-3"
              style={{
                borderColor: statusColor(
                  colors,
                  g.gasAlert.severity === "HIGH" || g.gasAlert.severity === "VERY HIGH"
                    ? "danger"
                    : g.gasAlert.severity === "ELEVATED"
                      ? "warning"
                      : "normal",
                ),
              }}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--dash-text-muted)]">
                  <AlertTriangle size={13} />
                  Gas Alert — sensor-based, independent of AI
                </div>
                <span
                  className="rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: `${statusColor(colors, g.gasAlert.severity === "HIGH" || g.gasAlert.severity === "VERY HIGH" ? "danger" : g.gasAlert.severity === "ELEVATED" ? "warning" : "normal")}22`,
                    color: statusColor(colors, g.gasAlert.severity === "HIGH" || g.gasAlert.severity === "VERY HIGH" ? "danger" : g.gasAlert.severity === "ELEVATED" ? "warning" : "normal"),
                  }}
                >
                  {g.gasAlert.severity}
                </span>
              </div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--dash-text-muted)]">Primary factors</div>
              <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-[var(--dash-text-muted)]">
                {g.gasAlert.factors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {g.aiRisk && (
            <div className="mt-4.5 rounded-md border p-3" style={{ borderColor: statusColor(colors, riskClassToStatus(g.aiRisk.status)) }}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--dash-text-muted)]">
                  <BrainCircuit size={13} />
                  MineGuard V2 assessment{g.liveGas ? " — secondary, AI model" : ""}
                </div>
                <span
                  className="rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: `${statusColor(colors, riskClassToStatus(g.aiRisk.status))}22`,
                    color: statusColor(colors, riskClassToStatus(g.aiRisk.status)),
                  }}
                >
                  {g.aiRisk.status}
                </span>
              </div>
              <div className="mb-1.5 grid grid-cols-4 gap-1.5 font-mono text-[10px]">
                {(
                  [
                    ["Critical", g.aiRisk.criticalProbability],
                    ["High", g.aiRisk.highProbability],
                    ["Moderate", g.aiRisk.moderateProbability],
                    ["Safe", g.aiRisk.safeProbability],
                  ] as const
                ).map(([label, prob]) => (
                  <div key={label} className="rounded border border-[var(--dash-border)] px-1.5 py-1 text-center">
                    <div className="text-[var(--dash-text-muted)]">{label}</div>
                    <div className="font-semibold">{(prob * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-[var(--dash-text-muted)]">{g.aiRisk.reason}</div>
              {g.aiRisk.recommendation && (
                <div className="mt-2 border-t border-[var(--dash-border)] pt-2">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--dash-text-muted)]">
                    {g.aiRisk.recommendation.title}
                    <span
                      className="rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold"
                      style={{
                        background: `${statusColor(colors, riskClassToStatus(g.aiRisk.status))}22`,
                        color: statusColor(colors, riskClassToStatus(g.aiRisk.status)),
                      }}
                    >
                      {g.aiRisk.recommendation.priority}
                    </span>
                  </div>
                  <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-[var(--dash-text-muted)]">
                    {g.aiRisk.recommendation.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
              {g.aiNote && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[10px]" style={{ color: colors.amber }}>
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>{g.aiNote}</span>
                </div>
              )}
            </div>
          )}

          <div className="mb-2 mt-4.5 text-xs font-bold uppercase tracking-wide text-[var(--dash-text-muted)]">
            Team Roster
          </div>
          <div className="max-h-[200px] overflow-y-auto rounded-md border border-[var(--dash-border)]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="sticky top-0 bg-[var(--dash-panel-alt)]">
                  {["NAME", "ID", "CHECK-IN", "CHECK-OUT", ""].map((h) => (
                    <th key={h} className="px-2.5 py-1.5 text-left font-mono text-[9px] font-semibold tracking-wide text-[var(--dash-text-muted)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.workers.map((w, wi) => (
                  <tr
                    key={w.id}
                    className="border-t border-[var(--dash-border)]"
                    style={{ background: wi % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--dash-panel-alt) 55%, transparent)" }}
                  >
                    {editingWorkerId === w.id ? (
                      <td className="px-2.5 py-1.5" colSpan={2}>
                        <input
                          autoFocus
                          value={workerNameDraft}
                          onChange={(e) => setWorkerNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveWorkerEdit();
                            if (e.key === "Escape") setEditingWorkerId(null);
                          }}
                          className="w-full rounded border px-1.5 py-0.5 text-xs outline-none"
                          style={{ background: "var(--dash-panel-alt)", borderColor: colors.teal, color: "var(--dash-text)" }}
                        />
                      </td>
                    ) : (
                      <>
                        <td className="px-2.5 py-1.5 text-xs font-semibold">{w.name}</td>
                        <td className="px-2.5 py-1.5 font-mono text-[11px] text-[var(--dash-text-muted)]">{w.id}</td>
                      </>
                    )}
                    <td className="px-2.5 py-1.5 font-mono text-[11px]">{w.checkIn}</td>
                    <td className="px-2.5 py-1.5 font-mono text-[11px]" style={{ color: w.checkOut ? "var(--dash-text)" : colors.green }}>
                      {w.checkOut || "On site"}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        {editingWorkerId === w.id ? (
                          <button onClick={saveWorkerEdit} title="Save" className="flex cursor-pointer rounded p-1" style={{ background: colors.teal }}>
                            <Check size={11} color={colors.bg} />
                          </button>
                        ) : (
                          <button
                            onClick={() => startWorkerEdit(w.id, w.name)}
                            title="Rename worker"
                            className="flex cursor-pointer rounded p-1 text-[var(--dash-text-muted)]"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove ${w.name} from this group?`)) onRemoveWorker(g.id, w.id);
                          }}
                          title="Remove worker"
                          className="flex cursor-pointer rounded p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-red)]"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {g.workers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2.5 py-4 text-center text-[11px] text-[var(--dash-text-muted)]">
                      No workers checked in.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2.5 flex items-center gap-1.5">
            <input
              value={newWorkerName}
              onChange={(e) => setNewWorkerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewWorker();
              }}
              placeholder="Add worker name..."
              className="w-full rounded border px-2.5 py-1.5 text-xs outline-none"
              style={{ background: "var(--dash-panel-alt)", borderColor: "var(--dash-border)", color: "var(--dash-text)" }}
            />
            <button
              onClick={submitNewWorker}
              title="Add worker"
              className="flex cursor-pointer items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide"
              style={{ background: `${colors.teal}22`, border: `1px solid ${colors.teal}`, color: colors.teal }}
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
