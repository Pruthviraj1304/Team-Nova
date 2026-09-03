import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "./useCountUp";

export interface StatDef {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}

export function StatCard({ stat, delay }: { stat: StatDef; delay: number }) {
  const val = useCountUp(stat.value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="relative flex items-center gap-3 overflow-hidden rounded-md border border-[var(--dash-border)] bg-[var(--dash-panel)] p-3.5"
    >
      <stat.icon size={20} color={stat.color} />
      <div>
        <div className="font-mono text-[22px] font-bold leading-none" style={{ color: stat.color }}>
          {val}
        </div>
        <div className="mt-0.5 text-[10px] tracking-wide text-[var(--dash-text-muted)]">{stat.label}</div>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: stat.color, boxShadow: `0 0 8px ${stat.color}` }} />
    </motion.div>
  );
}
