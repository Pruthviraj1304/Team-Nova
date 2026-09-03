import { motion } from "framer-motion";
import { Battery, MapPin, Thermometer, Trash2, WifiOff, Wind } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { LIVE_GROUP_ID, type Group } from "./mockData";
import { useDashTheme } from "./theme";

function statusColor(colors: ReturnType<typeof useDashTheme>["colors"], s: Group["status"]) {
  return s === "danger" ? colors.red : s === "warning" ? colors.amber : colors.green;
}
function statusLabel(s: Group["status"]) {
  return s === "danger" ? "DANGER" : s === "warning" ? "CAUTION" : "NORMAL";
}

function DeleteButton({ name, onDelete }: { name: string; onDelete: () => void }) {
  return (
    <button
      title="Remove this group from the dashboard"
      onClick={(e) => {
        e.stopPropagation();
        if (window.confirm(`Remove "${name}" from the dashboard? You can bring it back by reloading the page.`)) onDelete();
      }}
      className="flex cursor-pointer rounded p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-red)]"
    >
      <Trash2 size={13} />
    </button>
  );
}

export function GroupCard({ g, onSelect, onDelete }: { g: Group; onSelect: (g: Group) => void; onDelete: (id: string) => void }) {
  const { colors } = useDashTheme();
  const sColor = statusColor(colors, g.status);
  // The live hardware unit only ever shows real numbers once it's actually
  // booted and reporting — no fabricated readings, no stale numbers left over
  // from a previous session, matching Real Sensor mode's own rule.
  const awaitingHardware = g.id === LIVE_GROUP_ID && !g.live;

  if (awaitingHardware) {
    return (
      <motion.div
        onClick={() => onSelect(g)}
        whileHover={{ y: -3, boxShadow: "0 8px 22px rgba(0,0,0,0.4)" }}
        transition={{ duration: 0.18 }}
        className="cursor-pointer rounded-md border border-dashed bg-[var(--dash-panel)] p-3.5"
        style={{ borderColor: "var(--dash-border)" }}
      >
        <div className="mb-2.5 flex items-start justify-between">
          <div>
            <span className="text-base font-bold text-[var(--dash-text-muted)]">{g.name}</span>
            <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-[var(--dash-text-muted)]">
              <MapPin size={10} /> {g.zone}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="flex items-center gap-1.5 rounded px-1.5 py-0.5"
              style={{ background: "color-mix(in srgb, var(--dash-text-muted) 15%, transparent)", border: "1px solid var(--dash-border)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--dash-text-muted)" }} />
              <span className="font-mono text-[9px] font-bold tracking-wide text-[var(--dash-text-muted)]">OFFLINE</span>
            </div>
            <DeleteButton name={g.name} onDelete={() => onDelete(g.id)} />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-1.5 py-5 text-[var(--dash-text-muted)]">
          <WifiOff size={20} />
          <span className="text-center font-mono text-[10px]">Waiting for hardware to connect</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      onClick={() => onSelect(g)}
      whileHover={{ y: -3, boxShadow: "0 8px 22px rgba(0,0,0,0.4)" }}
      transition={{ duration: 0.18 }}
      className="cursor-pointer rounded-md border bg-[var(--dash-panel)] p-3.5"
      style={{ borderColor: g.status === "normal" ? "var(--dash-border)" : sColor }}
    >
      <div className="mb-2.5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold">{g.name}</span>
            {g.live && (
              <span
                className="rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide"
                style={{ background: `${colors.green}22`, border: `1px solid ${colors.green}`, color: colors.green }}
              >
                Live
              </span>
            )}
            {g.aiRisk && (
              <span
                title={g.aiRisk.reason}
                className="rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide"
                style={{ background: `${colors.teal}22`, border: `1px solid ${colors.teal}`, color: colors.teal }}
              >
                AI · {g.aiRisk.status}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-[var(--dash-text-muted)]">
            <MapPin size={10} /> {g.zone}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5"
            style={{ background: `${sColor}22`, border: `1px solid ${sColor}` }}
          >
            <motion.div
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: sColor }}
              animate={g.status === "danger" ? { opacity: [1, 0.35, 1] } : {}}
              transition={g.status === "danger" ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : {}}
            />
            <span className="font-mono text-[9px] font-bold tracking-wide" style={{ color: sColor }}>
              {statusLabel(g.status)}
            </span>
          </div>
          <DeleteButton name={g.name} onDelete={() => onDelete(g.id)} />
        </div>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-2">
        <div>
          <div className="mb-0.5 flex items-center gap-1 text-[9px] text-[var(--dash-text-muted)]">
            <Wind size={10} /> CH4
          </div>
          <div
            className="font-mono text-[13px] font-semibold"
            style={{ color: g.methane > 2.0 ? colors.red : g.methane > 1.4 ? colors.amber : colors.text }}
          >
            {g.methane.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="mb-0.5 flex items-center gap-1 text-[9px] text-[var(--dash-text-muted)]">
            <Thermometer size={10} /> TEMP
          </div>
          <div className="font-mono text-[13px] font-semibold">{g.temp}°C</div>
        </div>
        <div>
          <div className="mb-0.5 flex items-center gap-1 text-[9px] text-[var(--dash-text-muted)]">
            <Battery size={10} /> BATT
          </div>
          <div className="font-mono text-[13px] font-semibold" style={{ color: g.battery < 25 ? colors.red : colors.text }}>
            {g.battery}%
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={26}>
        <LineChart data={g.history}>
          <Line type="monotone" dataKey="methane" stroke={colors.teal} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 font-mono text-[9px] text-[var(--dash-text-muted)]">Last check-in: {g.lastCheckin}s ago</div>
    </motion.div>
  );
}

export { statusColor, statusLabel };
