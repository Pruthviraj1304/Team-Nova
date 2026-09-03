import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { Alert } from "./mockData";
import { useDashTheme } from "./theme";

export function AlertToast({ toast }: { toast: Alert | null }) {
  const { colors } = useDashTheme();
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 30, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed right-5 top-5 z-[100] flex items-center gap-2.5 rounded-md border p-3.5"
          style={{
            background: colors.panel,
            borderColor: colors.red,
            boxShadow: `0 6px 20px rgba(0,0,0,0.65), 0 0 16px ${colors.red}55`,
          }}
        >
          <AlertTriangle size={18} color={colors.red} />
          <div>
            <div className="text-[13px] font-bold">
              {toast.type} — {toast.group}
            </div>
            <div className="font-mono text-[11px] text-[var(--dash-text-muted)]">
              {toast.level} · click Acknowledge in feed
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
