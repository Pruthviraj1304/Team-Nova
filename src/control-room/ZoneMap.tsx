import { motion } from "framer-motion";
import type { Group } from "./mockData";
import { useDashTheme } from "./theme";
import { statusColor } from "./GroupCard";

export function ZoneMap({ groups, onSelect }: { groups: Group[]; onSelect: (g: Group) => void }) {
  const { colors } = useDashTheme();

  return (
    <svg viewBox="0 0 420 300" width="100%" height={260}>
      <rect x={60} y={40} width={320} height={240} fill="none" stroke={colors.border} strokeWidth={1.5} strokeDasharray="4 4" rx={6} />
      {groups.map((g) => (
        <g key={g.id} onClick={() => onSelect(g)} style={{ cursor: "pointer" }}>
          {g.status === "danger" && (
            <motion.circle
              cx={g.x}
              cy={g.y}
              r={10}
              fill={colors.red}
              initial={{ scale: 0.6, opacity: 0.7 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <circle cx={g.x} cy={g.y} r={9} fill={statusColor(colors, g.status)} stroke={colors.bg} strokeWidth={2} />
          <text x={g.x} y={g.y - 15} textAnchor="middle" fill={colors.textMuted} fontSize={10} fontFamily="JetBrains Mono">
            {g.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
