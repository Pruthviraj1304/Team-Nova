import { AnimatePresence, motion } from "framer-motion";
import { Siren } from "lucide-react";
import type { Alert, Group } from "./mockData";
import { useDashTheme } from "./theme";

export function EmergencySosModal({
  alert,
  group,
  onAcknowledge,
}: {
  alert: Alert | null;
  group: Group | undefined;
  onAcknowledge: (id: number) => void;
}) {
  const { colors } = useDashTheme();
  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(20,4,4,0.82)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[420px] rounded-lg border-2 p-6 text-center"
            style={{ background: colors.panel, borderColor: colors.red, boxShadow: `0 0 60px ${colors.red}66` }}
          >
            <motion.div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: `${colors.red}22`, border: `2px solid ${colors.red}` }}
              animate={{ scale: [1, 1.08, 1], opacity: [1, 0.75, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            >
              <Siren size={30} color={colors.red} />
            </motion.div>

            <div className="mb-1 text-xl font-extrabold uppercase tracking-wide" style={{ color: colors.red }}>
              Emergency — SOS Activated
            </div>
            <div className="mb-4 font-mono text-xs text-[var(--dash-text-muted)]">
              Worker has pressed the emergency button
            </div>

            <div className="mb-5 space-y-1.5 rounded-md border border-[var(--dash-border)] p-3 text-left">
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--dash-text-muted)]">Group</span>
                <span className="font-mono font-semibold">{alert.group}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--dash-text-muted)]">Zone</span>
                <span className="font-mono font-semibold">{group?.zone ?? "—"}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--dash-text-muted)]">Time</span>
                <span className="font-mono font-semibold">{alert.time.toLocaleTimeString()}</span>
              </div>
            </div>

            <button
              onClick={() => onAcknowledge(alert.id)}
              className="w-full cursor-pointer rounded py-3 text-sm font-bold uppercase tracking-wide text-white"
              style={{ background: colors.red }}
            >
              Acknowledge &amp; Dispatch Help
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
