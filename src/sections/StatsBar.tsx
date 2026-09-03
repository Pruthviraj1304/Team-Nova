import { RevealGroup, RevealItem } from "../components/ui/Reveal";
import { AnimatedCounter } from "../components/ui/AnimatedCounter";
import { stats } from "../data/content";

export function StatsBar() {
  return (
    <section className="relative border-y border-[var(--color-border)] bg-[var(--color-bg-soft)]">
      <RevealGroup className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-12 sm:grid-cols-4 sm:gap-8">
        {stats.map((s) => (
          <RevealItem key={s.label} className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            <s.icon className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={1.8} />
            <div className="font-display text-3xl font-semibold text-[var(--color-text)] sm:text-4xl">
              <AnimatedCounter value={s.value} suffix={s.suffix} />
            </div>
            <p className="text-xs leading-snug text-[var(--color-text-muted)] sm:text-sm">{s.label}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
