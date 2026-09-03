import { motion } from "framer-motion";

const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 6.3) % 100,
  delay: (i * 1.7) % 12,
  duration: 14 + (i % 5) * 3,
  size: 1.5 + (i % 3),
}));

export function AmbientParticles() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute top-0 rounded-full bg-[var(--dash-amber)]"
          style={{ left: `${p.left}%`, width: p.size, height: p.size }}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: "110vh", opacity: [0, 0.35, 0.15, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
            times: [0, 0.1, 0.9, 1],
          }}
        />
      ))}
    </div>
  );
}
