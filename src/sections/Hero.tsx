import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Play, Wind, Radio, ShieldCheck } from "lucide-react";
import { MagneticButton } from "../components/ui/MagneticButton";
import { Reveal } from "../components/ui/Reveal";

const HeroScene = lazy(() => import("../components/three/HeroScene").then((m) => ({ default: m.HeroScene })));

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-40 pb-24 sm:pt-48 sm:pb-32">
      <div className="pointer-events-none absolute inset-0 grid-overlay [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-[var(--color-primary)]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-40 h-[500px] w-[500px] rounded-full bg-[var(--color-accent)]/15 blur-[120px]" />

      <div className="relative mx-auto grid max-w-6xl gap-16 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-safe)] animate-pulse-slow" />
              IoT Coal Mine Safety System
            </span>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="mt-6 text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-[var(--color-text)] sm:text-6xl lg:text-[4rem]">
              Every miner,
              <br />
              <span className="text-gradient">continuously protected.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg">
              MineGuard X is a portable safety device that watches hazardous gases, environment, and worker
              status underground — then fires instant local alerts and LoRa transmissions to the control room
              before a routine shift becomes an emergency.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <MagneticButton>
                Explore the system
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
              <MagneticButton variant="ghost">
                <Play className="h-3.5 w-3.5 fill-current" />
                See it in action
              </MagneticButton>
            </div>
          </Reveal>

          <Reveal delay={0.32}>
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-[var(--color-border)] pt-7 text-[13px] text-[var(--color-text-dim)]">
              <span className="flex items-center gap-2"><Wind className="h-4 w-4 text-[var(--color-primary)]" /> Real-time gas sensing</span>
              <span className="flex items-center gap-2"><Radio className="h-4 w-4 text-[var(--color-accent)]" /> Long-range LoRa link</span>
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--color-safe)]" /> Local + control-room logging</span>
            </div>
          </Reveal>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="relative"
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] glass-strong">
            <Suspense
              fallback={
                <div className="absolute inset-0 animate-pulse-slow bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-accent)]/10" />
              }
            >
              <HeroScene className="absolute inset-0" />
            </Suspense>
          </div>

          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="absolute -left-6 top-8 hidden w-44 rounded-xl glass-strong p-3.5 sm:block animate-float"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">Methane (CH4)</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-xl font-semibold text-[var(--color-safe)]">0.6%</span>
              <span className="text-[11px] text-[var(--color-text-dim)]">LEL</span>
            </p>
            <p className="mt-1 text-[11px] font-medium text-[var(--color-safe)]">● Safe range</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="absolute -right-4 bottom-10 hidden w-44 rounded-xl glass-strong p-3.5 sm:block animate-float-slow"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">LoRa uplink</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-xl font-semibold text-[var(--color-accent)]">-78</span>
              <span className="text-[11px] text-[var(--color-text-dim)]">dBm</span>
            </p>
            <p className="mt-1 text-[11px] font-medium text-[var(--color-accent)]">● Control room linked</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
