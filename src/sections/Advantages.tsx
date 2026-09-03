import { SectionHeading } from "../components/ui/SectionHeading";
import { advantages } from "../data/content";

export function Advantages() {
  const loop = [...advantages, ...advantages];

  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading eyebrow="Why MineGuard X" title="Advantages that compound underground." />
      </div>

      <div className="relative mt-16 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max gap-4 animate-marquee">
          {loop.map((a, i) => (
            <div
              key={`${a.title}-${i}`}
              className="flex items-center gap-3 whitespace-nowrap rounded-full glass px-6 py-3.5"
            >
              <a.icon className="h-4.5 w-4.5 text-[var(--color-primary)]" strokeWidth={1.8} />
              <span className="text-sm font-medium text-[var(--color-text)]">{a.title}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
