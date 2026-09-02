import { AlertTriangle, Check, X } from "lucide-react";
import { SectionHeading } from "../components/ui/SectionHeading";
import { Reveal } from "../components/ui/Reveal";

const existing = [
  "Fixed monitoring stations, limited coverage",
  "No per-worker, personal monitoring",
  "Expensive industrial infrastructure",
  "No wireless real-time transmission",
];

const proposed = [
  "Worn or mounted — coverage moves with the miner",
  "Individual gas, environment & motion tracking",
  "Low-cost, portable ESP32-S3 platform",
  "LoRa wireless alerts straight to the surface",
];

export function Problem() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="The problem"
          title="Underground safety hasn't kept pace with the risk."
          description="Toxic gases, poor ventilation, heat, and collapse risk make coal mining one of the most hazardous professions on earth — yet most safety infrastructure still watches a room, not a worker."
        />

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl glass p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-danger)]/15">
                  <X className="h-4.5 w-4.5 text-[var(--color-danger)]" />
                </span>
                <h3 className="font-display text-lg font-semibold text-[var(--color-text)]">Existing systems</h3>
              </div>
              <ul className="mt-6 space-y-4">
                {existing.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[var(--color-text-muted)]">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="h-full rounded-2xl glass-strong p-8 ring-1 ring-[var(--color-primary)]/25">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)]/15">
                  <Check className="h-4.5 w-4.5 text-[var(--color-primary)]" />
                </span>
                <h3 className="font-display text-lg font-semibold text-[var(--color-text)]">MineGuard X</h3>
              </div>
              <ul className="mt-6 space-y-4">
                {proposed.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[var(--color-text)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <div className="mt-6 flex items-start gap-3 rounded-2xl glass px-6 py-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" />
            <p className="text-sm text-[var(--color-text-muted)]">
              A portable, affordable, and intelligent safety system — capable of monitoring conditions and
              alerting instantly — is the missing layer between a miner and a preventable accident.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
