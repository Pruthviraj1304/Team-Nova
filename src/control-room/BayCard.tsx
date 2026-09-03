import { BatteryCharging, CheckCircle2, XCircle } from "lucide-react";
import type { Bay } from "./mockData";
import { useDashTheme } from "./theme";

export function BayCard({ b }: { b: Bay }) {
  const { colors } = useDashTheme();
  const color = b.state === "full" ? colors.green : b.state === "charging" ? colors.teal : colors.textMuted;

  return (
    <div className="rounded-md border border-[var(--dash-border)] bg-[var(--dash-panel)] p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-[var(--dash-text-muted)]">{b.id}</span>
        {b.state === "charging" ? (
          <BatteryCharging size={16} color={color} />
        ) : b.state === "full" ? (
          <CheckCircle2 size={16} color={color} />
        ) : (
          <XCircle size={16} color={color} />
        )}
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded bg-[var(--dash-border)]">
        <div
          className="h-full rounded transition-[width] duration-500"
          style={{ width: `${b.charge}%`, background: color }}
        />
      </div>
      <div className="font-mono text-[11px] text-[var(--dash-text-muted)]">
        {b.state === "empty" ? "Bay empty" : `${b.charge}% · ${b.deviceId}`}
      </div>
    </div>
  );
}
