import { Reveal } from "./Reveal";
import { cn } from "../../lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <Reveal>
        <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] animate-pulse-slow" />
          {eyebrow}
        </span>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="mt-5 text-3xl font-semibold text-[var(--color-text)] sm:text-4xl md:text-5xl">
          {title}
        </h2>
      </Reveal>
      {description && (
        <Reveal delay={0.14}>
          <p className="mt-4 text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg">
            {description}
          </p>
        </Reveal>
      )}
    </div>
  );
}
