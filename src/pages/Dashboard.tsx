import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowUpDown,
  Battery,
  BatteryCharging,
  BrainCircuit,
  Cloud,
  Droplets,
  Gauge,
  Home,
  Radio,
  Search,
  Thermometer,
  Users,
  Volume2,
  VolumeX,
  Wind,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { DashThemeProvider, useDashTheme } from "../control-room/theme";
import { MineLogo } from "../control-room/MineLogo";
import { AmbientParticles } from "../control-room/AmbientParticles";
import { AlertToast } from "../control-room/AlertToast";
import { EmergencySosModal } from "../control-room/EmergencySosModal";
import { SettingsMenu } from "../control-room/SettingsMenu";
import { StatCard, type StatDef } from "../control-room/StatCard";
import { GroupCard } from "../control-room/GroupCard";
import { AlertRow } from "../control-room/AlertRow";
import { BayCard } from "../control-room/BayCard";
import { ZoneMap } from "../control-room/ZoneMap";
import { GroupDetailModal } from "../control-room/GroupDetailModal";
import { useControlRoomSim } from "../control-room/useControlRoomSim";
import { LIVE_GROUP_ID, type Group } from "../control-room/mockData";

const TABS = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "groups", label: "Worker Groups", icon: Users },
  { id: "readings", label: "Sensor Readings", icon: Gauge },
  { id: "alerts", label: "Alert Feed", icon: AlertTriangle },
  { id: "charging", label: "Charging Station", icon: BatteryCharging },
] as const;

type TabId = (typeof TABS)[number]["id"];

function DashboardInner() {
  const { colors } = useDashTheme();
  const { user, signOut } = useAuth();

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Group["status"]>("all");
  const [sortBy, setSortBy] = useState<"name" | "status" | "battery" | "methane">("name");
  const [soundOn, setSoundOn] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    groups,
    bays,
    baysLive,
    aiOnline,
    alerts,
    toast,
    now,
    siteTrend,
    selectedAlertDetail,
    acknowledge,
    renameGroup,
    deleteGroup,
    addWorker,
    removeWorker,
    renameWorker,
    manualMode,
    setManualMode,
    setManualField,
  } = useControlRoomSim(soundOn);

  async function handleSignOut() {
    await signOut();
  }

  // The live hardware group only counts as "active" while it's actually
  // connected and reporting — offline, it's excluded from counts, averages,
  // and the zone map (though it still shows, as an offline card, in Worker
  // Groups so its disconnected state is visible rather than hidden).
  const activeGroups = groups.filter((g) => g.id !== LIVE_GROUP_ID || g.live);
  const activeCount = activeGroups.length;
  const dangerCount = groups.filter((g) => g.status === "danger").length;
  const warningCount = groups.filter((g) => g.status === "warning").length;
  const chargingCount = bays.filter((b) => b.state === "charging").length;
  const fullCount = bays.filter((b) => b.state === "full").length;
  const unackAlerts = alerts.filter((a) => !a.acknowledged);
  const activeSos = alerts.find((a) => a.type.startsWith("SOS") && !a.acknowledged) ?? null;
  const sosGroup = activeSos ? groups.find((g) => g.id === activeSos.groupId) : undefined;

  const statusRank = { danger: 0, warning: 1, normal: 2 };

  const visibleGroups = useMemo(() => {
    let list = groups.filter(
      (g) =>
        (statusFilter === "all" || g.status === statusFilter) &&
        (g.name.toLowerCase().includes(search.toLowerCase()) || g.zone.toLowerCase().includes(search.toLowerCase())),
    );
    if (sortBy === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "status") list = [...list].sort((a, b) => statusRank[a.status] - statusRank[b.status]);
    if (sortBy === "battery") list = [...list].sort((a, b) => a.battery - b.battery);
    if (sortBy === "methane") list = [...list].sort((a, b) => b.methane - a.methane);
    return list;
  }, [groups, search, statusFilter, sortBy]);

  const overviewStats: StatDef[] = [
    { label: "GROUPS ACTIVE", value: activeCount, icon: Radio, color: colors.teal },
    { label: "DANGER ALERTS", value: dangerCount, icon: AlertTriangle, color: colors.red },
    { label: "CAUTION FLAGS", value: warningCount, icon: AlertTriangle, color: colors.amber },
    { label: "BAYS CHARGING", value: chargingCount, icon: BatteryCharging, color: colors.teal },
    { label: "BAYS READY", value: fullCount, icon: Battery, color: colors.green },
  ];

  const readingTiles = [
    { label: "AVG METHANE", value: (activeGroups.reduce((a, g) => a + g.methane, 0) / activeGroups.length).toFixed(2) + "%", icon: Wind, color: colors.teal },
    { label: "AVG AIR QUALITY", value: String(Math.round(activeGroups.reduce((a, g) => a + g.airQuality, 0) / activeGroups.length)), icon: Wind, color: colors.teal },
    { label: "AVG TEMP", value: (activeGroups.reduce((a, g) => a + g.temp, 0) / activeGroups.length).toFixed(1) + "°C", icon: Thermometer, color: colors.amber },
    { label: "AVG HUMIDITY", value: Math.round(activeGroups.reduce((a, g) => a + g.humidity, 0) / activeGroups.length) + "%", icon: Droplets, color: colors.teal },
    { label: "AVG PRESSURE", value: Math.round(activeGroups.reduce((a, g) => a + g.pressure, 0) / activeGroups.length) + " hPa", icon: Gauge, color: colors.text },
    { label: "AVG MQ135", value: String(Math.round(activeGroups.reduce((a, g) => a + g.mq135Raw, 0) / activeGroups.length)), icon: Cloud, color: colors.text },
  ];

  function handleAcknowledgeSos(id: number) {
    acknowledge(id);
    // Dispatch means getting the responder to the alert's full detail — zone,
    // worker count, live readings — not just silencing the pop-up.
    setActiveTab("alerts");
  }

  return (
    <div className="relative overflow-hidden px-5 py-5">
      <AmbientParticles />
      <AlertToast toast={toast} />
      <EmergencySosModal alert={activeSos} group={sosGroup} onAcknowledge={handleAcknowledgeSos} />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <motion.div
                className="absolute -inset-1.5 rounded-md"
                style={{ background: colors.amber, filter: "blur(8px)" }}
                animate={{ opacity: [0.25, 0.5, 0.25], scale: [0.95, 1.08, 0.95] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative flex h-10 w-10 items-center justify-center rounded" style={{ background: colors.amber }}>
                <MineLogo size={22} />
              </div>
            </div>
            <div>
              <div className="text-[22px] font-bold uppercase tracking-wide">MineGuard X — Control Room</div>
              <div className="font-mono text-xs tracking-wide text-[var(--dash-text-muted)]">SITE 04 · KOYLA BLOCK · SHIFT MONITOR</div>
            </div>
          </div>

          <div className="flex items-center gap-4.5">
            <span
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide"
              style={{ borderColor: aiOnline ? colors.teal : colors.border, color: aiOnline ? colors.teal : colors.textMuted }}
              title="MineGuard V2 Random Forest model — see MineGuard_AI/README.md"
            >
              <BrainCircuit size={12} />
              AI Engine {aiOnline ? "Online" : "Offline"}
            </span>
            <button
              onClick={() => setSoundOn((s) => !s)}
              className="flex cursor-pointer rounded border border-[var(--dash-border)] p-2"
              style={{ color: soundOn ? colors.teal : colors.textMuted }}
            >
              {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <div className="text-right">
              <div className="font-mono text-xl font-semibold" style={{ color: colors.teal }}>
                {now.toLocaleTimeString()}
              </div>
              <div className="font-mono text-[11px] text-[var(--dash-text-muted)]">
                {now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" })}
              </div>
            </div>
            <SettingsMenu
              open={settingsOpen}
              onToggle={() => setSettingsOpen((o) => !o)}
              onClose={() => setSettingsOpen(false)}
              userEmail={user?.email ?? "manager"}
              onSignOut={handleSignOut}
            />
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-5.5 flex gap-1 overflow-x-auto border-b border-[var(--dash-border)]">
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="relative flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap px-4.5 py-3 text-sm font-semibold"
                style={{
                  color: active ? colors.amber : colors.textMuted,
                  borderBottom: `2px solid ${active ? colors.amber : "transparent"}`,
                }}
              >
                <t.icon size={15} />
                <span>{t.label}</span>
                {t.id === "alerts" && unackAlerts.length > 0 && (
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-tight text-white" style={{ background: colors.red }}>
                    {unackAlerts.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {overviewStats.map((s, i) => (
                <StatCard key={s.label} stat={s} delay={i * 0.05} />
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
              <div className="rounded-md border border-[var(--dash-border)] bg-[var(--dash-panel)] p-3.5">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--dash-text-muted)]">
                  Site-wide Avg. Methane (live)
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={siteTrend}>
                    <defs>
                      <linearGradient id="siteGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={colors.teal} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={colors.teal} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={[0, 2]} />
                    <XAxis hide dataKey="t" />
                    <Tooltip
                      contentStyle={{ background: colors.panelAlt, border: `1px solid ${colors.border}`, fontSize: 11 }}
                      labelFormatter={() => ""}
                      formatter={(v) => [`${Number(v).toFixed(2)}%`, "Avg CH4"]}
                    />
                    <Area type="monotone" dataKey="avg" stroke={colors.teal} strokeWidth={2} fill="url(#siteGrad)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-md border border-[var(--dash-border)] bg-[var(--dash-panel)] p-3.5">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--dash-text-muted)]">Zone Map</div>
                <ZoneMap groups={activeGroups} onSelect={setSelectedGroup} />
              </div>
            </div>
          </motion.div>
        )}

        {/* WORKER GROUPS */}
        {activeTab === "groups" && (
          <motion.div key="groups" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="mb-3.5 flex items-center gap-2.5">
              <div className="flex flex-1 items-center gap-1.5 rounded border border-[var(--dash-border)] bg-[var(--dash-panel)] px-2.5 py-1.5">
                <Search size={13} color={colors.textMuted} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search group or zone..."
                  className="w-full bg-transparent text-xs outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded border border-[var(--dash-border)] bg-[var(--dash-panel)] px-2 py-1.5 text-xs"
              >
                <option value="all">All statuses</option>
                <option value="danger">Danger only</option>
                <option value="warning">Caution only</option>
                <option value="normal">Normal only</option>
              </select>
              <button
                onClick={() => setSortBy((s) => (s === "name" ? "status" : s === "status" ? "battery" : s === "battery" ? "methane" : "name"))}
                className="flex cursor-pointer items-center gap-1.5 rounded border border-[var(--dash-border)] bg-[var(--dash-panel)] px-2.5 py-1.5 text-[11px] text-[var(--dash-text-muted)]"
              >
                <ArrowUpDown size={12} /> Sort: {sortBy}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleGroups.map((g) => (
                <GroupCard key={g.id} g={g} onSelect={setSelectedGroup} onDelete={deleteGroup} />
              ))}
              {visibleGroups.length === 0 && (
                <div className="col-span-full py-8 text-center text-[13px] text-[var(--dash-text-muted)]">
                  No groups match the current filter.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* SENSOR READINGS */}
        {activeTab === "readings" && (
          <motion.div key="readings" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="mb-1.5 text-sm font-bold uppercase tracking-wide text-[var(--dash-text-muted)]">
              Sensor Readings — All Groups
            </div>
            <div className="mb-3.5 font-mono text-[11px] text-[var(--dash-text-muted)]">Live feed · updates every few seconds</div>

            <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {readingTiles.map((s) => (
                <div key={s.label} className="rounded-md border border-[var(--dash-border)] bg-[var(--dash-panel)] p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[9px] tracking-wide text-[var(--dash-text-muted)]">
                    <s.icon size={11} /> {s.label}
                  </div>
                  <div className="font-mono text-base font-bold" style={{ color: s.color }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-md border border-[var(--dash-border)] bg-[var(--dash-panel)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--dash-border)]">
                      {["GROUP", "ZONE", "METHANE", "AIR QUALITY", "TEMP", "HUMIDITY", "PRESSURE", "SOUND", "ALTITUDE"].map((h) => (
                        <th key={h} className="whitespace-nowrap px-3.5 py-2.5 text-left font-mono text-[10px] font-semibold tracking-wide text-[var(--dash-text-muted)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeGroups.map((g, i) => (
                      <tr
                        key={g.id}
                        onClick={() => setSelectedGroup(g)}
                        className="cursor-pointer border-b border-[var(--dash-border)]"
                        style={{ background: i % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--dash-panel-alt) 55%, transparent)" }}
                      >
                        <td className="px-3.5 py-2.5 text-[13px] font-bold">{g.name}</td>
                        <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-[11px] text-[var(--dash-text-muted)]">{g.zone}</td>
                        <td
                          className="px-3.5 py-2.5 font-mono text-xs font-semibold"
                          style={{ color: g.methane > 2.0 ? colors.red : g.methane > 1.4 ? colors.amber : colors.text }}
                        >
                          {g.methane.toFixed(2)}%
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-xs">{g.airQuality} AQI</td>
                        <td className="px-3.5 py-2.5 font-mono text-xs" style={{ color: g.temp > 32 ? colors.amber : colors.text }}>
                          {g.temp}°C
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-xs">{g.humidity.toFixed(0)}%</td>
                        <td className="px-3.5 py-2.5 font-mono text-xs">{g.pressure.toFixed(0)} hPa</td>
                        <td className="px-3.5 py-2.5 font-mono text-xs" style={{ color: (g.soundDb ?? 0) > 70 ? colors.amber : colors.text }}>
                          {g.soundDb != null ? `${g.soundDb.toFixed(0)} dB` : "—"}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-xs text-[var(--dash-text-muted)]">{g.altitude} m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ALERT FEED */}
        {activeTab === "alerts" && (
          <motion.div key="alerts" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--dash-text-muted)]">
              Alert Feed {unackAlerts.length > 0 && <span style={{ color: colors.red }}>({unackAlerts.length} unacknowledged)</span>}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-md border border-[var(--dash-border)] bg-[var(--dash-panel)] p-3.5">
                {alerts.length === 0 && (
                  <div className="px-2.5 py-8 text-center text-[13px] text-[var(--dash-text-muted)]">
                    No alerts yet. Feed updates in real time as groups report data.
                  </div>
                )}
                {alerts.map((a) => (
                  <AlertRow key={a.id} a={a} onAcknowledge={acknowledge} />
                ))}
              </div>

              <div className="sticky top-5 self-start rounded-md border border-[var(--dash-border)] bg-[var(--dash-panel)] p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--dash-text-muted)]">Alert Details</div>
                {!selectedAlertDetail ? (
                  <div className="px-1 py-5 text-[13px] text-[var(--dash-text-muted)]">
                    Acknowledge an alert from the feed to see its full details here.
                  </div>
                ) : (
                  (() => {
                    const grp = groups.find((gr) => gr.id === selectedAlertDetail.groupId);
                    return (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                        <div className="mb-1 flex items-center gap-2">
                          <AlertTriangle size={16} color={colors.red} />
                          <div className="text-base font-bold">{selectedAlertDetail.type}</div>
                        </div>
                        <div className="mb-4 font-mono text-[11px] text-[var(--dash-text-muted)]">
                          Acknowledged · {selectedAlertDetail.time.toLocaleString()}
                        </div>
                        {[
                          ["Group", selectedAlertDetail.group],
                          ["Reading at time of alert", selectedAlertDetail.level],
                          ["Zone", grp ? grp.zone : "—"],
                          ["Workers in group", grp ? String(grp.workerCount) : "—"],
                          ["Current status", grp ? grp.status.toUpperCase() : "—"],
                          ["Current methane", grp ? `${grp.methane.toFixed(2)}%` : "—"],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-[var(--dash-border)] py-1.5">
                            <span className="text-xs text-[var(--dash-text-muted)]">{k}</span>
                            <span className="font-mono text-xs font-semibold">{v}</span>
                          </div>
                        ))}
                        {grp && (
                          <button
                            onClick={() => setSelectedGroup(grp)}
                            className="mt-3.5 w-full cursor-pointer rounded border py-2 text-[11px] font-bold uppercase tracking-wide"
                            style={{ borderColor: colors.teal, color: colors.teal, background: "transparent" }}
                          >
                            View group details
                          </button>
                        )}
                      </motion.div>
                    );
                  })()
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* CHARGING STATION */}
        {activeTab === "charging" && (
          <motion.div key="charging" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="mb-3 flex items-center gap-2.5">
              <span className="text-sm font-bold uppercase tracking-wide text-[var(--dash-text-muted)]">
                Charging Station — {bays.length} Bays
              </span>
              <span
                className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  borderColor: baysLive ? colors.green : colors.border,
                  color: baysLive ? colors.green : colors.textMuted,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: baysLive ? colors.green : colors.textMuted }} />
                {baysLive ? "Live" : "Demo data"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
              {bays.map((b) => (
                <BayCard key={b.id} b={b} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {selectedGroup && (
        <GroupDetailModal
          group={selectedGroup}
          groups={groups}
          onClose={() => setSelectedGroup(null)}
          onRename={renameGroup}
          manualMode={manualMode}
          onSetManualMode={setManualMode}
          onSetManualField={setManualField}
          onAddWorker={addWorker}
          onRemoveWorker={removeWorker}
          onRenameWorker={renameWorker}
        />
      )}
    </div>
  );
}

export function Dashboard() {
  return (
    <DashThemeProvider>
      <DashboardInner />
    </DashThemeProvider>
  );
}
