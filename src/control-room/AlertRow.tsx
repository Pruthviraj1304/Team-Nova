import { motion } from "framer-motion";
import type { Alert } from "./mockData";
import { useDashTheme } from "./theme";

export function AlertRow({ a, onAcknowledge }: { a: Alert; onAcknowledge: (id: number) => void }) {
  const { colors } = useDashTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: a.acknowledged ? 0.55 : 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-2 rounded px-3.5 py-3 bg-[var(--dash-panel-alt)]"
      style={{ borderLeft: `3px solid ${a.acknowledged ? colors.border : colors.red}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold">{a.type}</div>
          <div className="mt-0.5 font-mono text-[11px] text-[var(--dash-text-muted)]">
            {a.group} · {a.level}
          </div>
        </div>
        <span className="font-mono text-[10px] text-[var(--dash-text-muted)]">{a.time.toLocaleTimeString()}</span>
      </div>
      {!a.acknowledged && (
        <button
          onClick={() => onAcknowledge(a.id)}
          className="mt-2 cursor-pointer rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
          style={{ borderColor: colors.amber, color: colors.amber, background: "transparent" }}
        >
          Acknowledge
        </button>
      )}
    </motion.div>
  );
}
