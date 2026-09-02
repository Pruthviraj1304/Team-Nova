import { ShieldHalf, Code2, Mail } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="relative border-t border-[var(--color-border)] bg-[var(--color-bg-soft)]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="flex cursor-pointer items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)]">
                <ShieldHalf className="h-4.5 w-4.5 text-[#05070c]" strokeWidth={2.4} />
              </span>
              <span className="font-display text-[15px] font-semibold text-[var(--color-text)]">
                MineGuard <span className="text-[var(--color-primary)]">X</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
              Portable IoT safety device for coal mine workers — real-time gas monitoring, LoRa alerts, and control-room visibility.
            </p>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-dim)]">Product</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--color-text-muted)]">
              <li><a href="#features" className="cursor-pointer transition-colors hover:text-[var(--color-text)]">Features</a></li>
              <li><a href="#hardware" className="cursor-pointer transition-colors hover:text-[var(--color-text)]">Hardware</a></li>
              <li><a href="#how-it-works" className="cursor-pointer transition-colors hover:text-[var(--color-text)]">How it works</a></li>
              <li><Link to="/dashboard" className="cursor-pointer transition-colors hover:text-[var(--color-text)]">Live dashboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-dim)]">Use cases</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--color-text-muted)]">
              <li>Underground coal mines</li>
              <li>Tunnel construction</li>
              <li>Rescue operations</li>
              <li>Smart mining systems</li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-dim)]">Contact</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--color-text-muted)]">
              <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> team@mineguardx.dev</li>
              <li className="flex items-center gap-2"><Code2 className="h-3.5 w-3.5" /> mineguard-x</li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-[var(--color-border)] pt-8 text-xs text-[var(--color-text-dim)] sm:flex-row">
          <p>© {new Date().getFullYear()} MineGuard X. Built for safer underground operations.</p>
          <p className="font-mono">Prototype · Educational & research demonstration</p>
        </div>
      </div>
    </footer>
  );
}
