import { LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { Reveal } from "../components/ui/Reveal";
import { MagneticButton } from "../components/ui/MagneticButton";

export function CTA() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] glass-strong px-8 py-16 text-center sm:px-16 sm:py-20">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[var(--color-primary)]/25 blur-[110px]" />
            <div className="pointer-events-none absolute inset-0 grid-overlay opacity-30 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />

            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-semibold text-[var(--color-text)] sm:text-4xl md:text-5xl">
                Bring real-time visibility to every shift.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base text-[var(--color-text-muted)] sm:text-lg">
                See how MineGuard X pairs on-body sensing with a live control-room dashboard — from first
                power-on to emergency response.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                <Link to="/dashboard">
                  <MagneticButton>
                    <LayoutDashboard className="h-4 w-4" />
                    Open live dashboard
                  </MagneticButton>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
