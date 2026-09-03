import { Radar, Check } from "lucide-react";
import { SectionHeading } from "../components/ui/SectionHeading";
import { Reveal } from "../components/ui/Reveal";
import { stationaryMode } from "../data/content";

export function Modes() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          eyebrow="Flexible deployment"
          title="Built for zone-wide coverage."
          description="Mounted at fixed checkpoints, the same sensor stack watches over every shaft and tunnel section."
        />

        <Reveal delay={0.1}>
          <div className="mt-12 rounded-2xl glass-strong p-8 sm:p-10">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/15">
                <Radar className="h-6 w-6 text-[var(--color-primary)]" strokeWidth={1.7} />
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold text-[var(--color-text)]">{stationaryMode.name}</h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{stationaryMode.tagline}</p>
              </div>
            </div>

            <ul className="mt-7 grid gap-3.5 sm:grid-cols-2">
              {stationaryMode.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-[var(--color-text)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
