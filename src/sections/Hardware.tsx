import { SectionHeading } from "../components/ui/SectionHeading";
import { RevealGroup, RevealItem } from "../components/ui/Reveal";
import { hardware } from "../data/content";
import { cn } from "../lib/utils";

export function Hardware() {
  return (
    <section id="hardware" className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-40 [mask-image:radial-gradient(ellipse_50%_60%_at_50%_50%,black,transparent)]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Inside the device"
          title="Purpose-built hardware, mine-tested layout."
          description="Every component is chosen for one job — sense, decide, alert, or record — assembled around a single low-power controller."
        />

        <RevealGroup className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" stagger={0.05}>
          {hardware.map((h, i) => (
            <RevealItem key={h.name}>
              <div
                className={cn(
                  "group relative h-full rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1",
                  i === 0 ? "glass-strong ring-1 ring-[var(--color-primary)]/40" : "glass",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    i === 0 ? "bg-[var(--color-primary)]/20" : "bg-white/5",
                  )}
                >
                  <h.icon
                    className={cn("h-4.5 w-4.5", i === 0 ? "text-[var(--color-primary)]" : "text-[var(--color-accent)]")}
                    strokeWidth={1.8}
                  />
                </span>
                <h3 className="mt-4 font-display text-sm font-semibold text-[var(--color-text)]">{h.name}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">{h.purpose}</p>
                {i === 0 && (
                  <span className="absolute right-4 top-4 font-mono text-[9px] uppercase tracking-wider text-[var(--color-primary)]">
                    Core
                  </span>
                )}
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
