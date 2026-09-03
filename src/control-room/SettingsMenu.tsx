import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Moon, Settings, Sun, User } from "lucide-react";
import { useDashTheme } from "./theme";

export function SettingsMenu({
  open,
  onToggle,
  onClose,
  userEmail,
  onSignOut,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  userEmail: string;
  onSignOut: () => void;
}) {
  const { theme, colors, toggleTheme } = useDashTheme();

  return (
    <div className="relative border-l border-[var(--dash-border)] pl-4.5">
      <button
        onClick={onToggle}
        title="Settings"
        className="flex cursor-pointer rounded p-2"
        style={{
          background: open ? colors.panelAlt : "none",
          border: `1px solid ${open ? colors.teal : colors.border}`,
          color: open ? colors.teal : colors.textMuted,
        }}
      >
        <Settings size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div onClick={onClose} className="fixed inset-0 z-[60]" />
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 top-[46px] z-[70] w-[240px] overflow-hidden rounded-lg border border-[var(--dash-border)] bg-[var(--dash-panel)] shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-center gap-2.5 border-b border-[var(--dash-border)] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-panel-alt)]">
                  <User size={16} color={colors.teal} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold">{userEmail}</div>
                  <div className="font-mono text-[9px] tracking-wide text-[var(--dash-text-muted)]">SITE MANAGER</div>
                </div>
              </div>

              <div className="border-b border-[var(--dash-border)] p-2.5">
                <div className="mb-2 font-mono text-[9px] tracking-wide text-[var(--dash-text-muted)]">APPEARANCE</div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => theme !== "dark" && toggleTheme()}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded py-1.5 text-xs font-semibold"
                    style={{
                      background: theme === "dark" ? colors.amber : "transparent",
                      color: theme === "dark" ? colors.bg : colors.textMuted,
                      border: `1px solid ${theme === "dark" ? colors.amber : colors.border}`,
                    }}
                  >
                    <Moon size={12} /> Dark
                  </button>
                  <button
                    onClick={() => theme !== "light" && toggleTheme()}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded py-1.5 text-xs font-semibold"
                    style={{
                      background: theme === "light" ? colors.amber : "transparent",
                      color: theme === "light" ? colors.bg : colors.textMuted,
                      border: `1px solid ${theme === "light" ? colors.amber : colors.border}`,
                    }}
                  >
                    <Sun size={12} /> Light
                  </button>
                </div>
              </div>

              <button
                onClick={onSignOut}
                className="flex w-full cursor-pointer items-center gap-2 p-3.5 text-[13px] font-semibold"
                style={{ color: colors.red }}
              >
                <LogOut size={14} /> Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
