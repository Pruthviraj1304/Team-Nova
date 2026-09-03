import { SectionHeading } from "../components/ui/SectionHeading";
import { TiltCard } from "../components/ui/TiltCard";
import { RevealGroup, RevealItem } from "../components/ui/Reveal";
import { features } from "../data/content";

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Capabilities"
          title="One device, full-spectrum protection."
          description="Every sensor, alert path, and storage layer works together — so nothing depends on a single point of failure underground."
        />

        <RevealGroup className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
          {features.map((f) => (
            <RevealItem key={f.title}>
              <TiltCard className="h-full p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-accent)]/20">
                  <f.icon className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={1.8} />
                </span>
                <h3 className="mt-5 font-display text-base font-semibold text-[var(--color-text)]">{f.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-text-muted)]">{f.description}</p>
              </TiltCard>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
