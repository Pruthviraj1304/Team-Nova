import { useRef } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { Power, Cpu, Activity, MonitorCheck, Siren, Radio, Building2 } from "lucide-react";
import { SectionHeading } from "../components/ui/SectionHeading";
import { Reveal } from "../components/ui/Reveal";
import { workflow } from "../data/content";
import { cn } from "../lib/utils";

const icons = [Power, Cpu, Activity, MonitorCheck, Siren, Radio, Building2];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.7", "end 0.4"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24, restDelta: 0.001 });

  return (
    <section id="how-it-works" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          eyebrow="System workflow"
          title="From power-on to control-room response."
          description="A tight sense → decide → alert loop keeps every worker's status current, with an automatic escalation path the instant conditions turn dangerous."
        />

        <div ref={ref} className="relative mt-20 pl-12 sm:pl-16">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[var(--color-border-strong)] sm:left-[27px]" />
          <motion.div
            style={{ scaleY: progress }}
            className="absolute left-[19px] top-2 bottom-2 w-px origin-top bg-gradient-to-b from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-safe)] sm:left-[27px]"
          />

          <div className="flex flex-col gap-10">
            {workflow.map((step, i) => {
              const Icon = icons[i] ?? Activity;
              const isAlert = step.title.toLowerCase().includes("abnormal");
              return (
                <Reveal key={step.title} delay={i * 0.03}>
                  <div className="relative flex items-start gap-5">
                    <span
                      className={cn(
                        "absolute -left-12 flex h-10 w-10 items-center justify-center rounded-full glass-strong sm:-left-16",
                        isAlert && "ring-2 ring-[var(--color-danger)]",
                      )}
                    >
                      <Icon
                        className={cn("h-4.5 w-4.5", isAlert ? "text-[var(--color-danger)]" : "text-[var(--color-accent)]")}
                        strokeWidth={1.8}
                      />
                    </span>
                    <div className={cn("w-full rounded-xl p-5", isAlert ? "glass-strong ring-1 ring-[var(--color-danger)]/30" : "glass")}>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[11px] text-[var(--color-text-dim)]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3 className="font-display text-[15px] font-semibold text-[var(--color-text)]">{step.title}</h3>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{step.description}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
