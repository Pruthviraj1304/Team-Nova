import { Mountain, Gem, Construction, Factory, LifeBuoy, Network } from "lucide-react";
import { SectionHeading } from "../components/ui/SectionHeading";
import { TiltCard } from "../components/ui/TiltCard";
import { RevealGroup, RevealItem } from "../components/ui/Reveal";
import { applications } from "../data/content";

const icons = [Mountain, Gem, Construction, Factory, LifeBuoy, Network];

export function Applications() {
  return (
    <section id="applications" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Where it deploys"
          title="Built for every hazardous underground environment."
        />

        <RevealGroup className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
          {applications.map((app, i) => {
            const Icon = icons[i] ?? Mountain;
            return (
              <RevealItem key={app}>
                <TiltCard className="flex h-full items-center gap-4 p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/12">
                    <Icon className="h-5 w-5 text-[var(--color-accent)]" strokeWidth={1.7} />
                  </span>
                  <span className="font-display text-[15px] font-medium text-[var(--color-text)]">{app}</span>
                </TiltCard>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
