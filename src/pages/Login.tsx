import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, LogIn, Mail, Moon, Sun, TriangleAlert, CircleCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { DashThemeProvider, useDashTheme } from "../control-room/theme";
import { MineLogo } from "../control-room/MineLogo";
import { cn } from "../lib/utils";

type Mode = "signin" | "signup";

function LoginInner() {
  const { colors, theme, toggleTheme } = useDashTheme();
  const { signIn, signUp, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    const result = mode === "signin" ? await signIn(email, password) : await signUp(email, password);

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      setShake((s) => s + 1);
      return;
    }

    if (mode === "signup" && !result.signedIn) {
      setNotice("Account created. Check your inbox to confirm your email, then sign in.");
      setMode("signin");
      return;
    }

    navigate(from, { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <div className="relative w-[380px]">
        <button
          onClick={toggleTheme}
          title="Toggle theme"
          className="absolute -top-10 right-0 flex cursor-pointer rounded border border-[var(--dash-border)] p-1.5 text-[var(--dash-text-muted)]"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <motion.div
          animate={shake ? { x: [0, -6, 6, -6, 6, 0] } : {}}
          transition={{ duration: 0.35 }}
          key={shake}
          className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-panel)] p-8"
        >
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-md" style={{ background: colors.amber }}>
              <MineLogo size={26} />
            </div>
            <div className="text-xl font-bold uppercase tracking-wide">MineGuard X</div>
            <div className="mt-1 font-mono text-[11px] tracking-wide text-[var(--dash-text-muted)]">CONTROL ROOM ACCESS</div>
          </div>

          {!configured && (
            <div className="mb-5 flex items-start gap-2 rounded px-3.5 py-2.5 text-[11px]" style={{ background: `${colors.amber}1a`, color: colors.amber }}>
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Supabase isn't configured yet. Add <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
                <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to <code className="font-mono">.env.local</code>.
              </span>
            </div>
          )}

          <div className="mb-5 flex w-full rounded-full border border-[var(--dash-border)] bg-[var(--dash-panel-alt)] p-1">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                className={cn("relative flex-1 cursor-pointer rounded-full py-2 text-[13px] font-semibold transition-colors duration-200")}
                style={{ color: mode === m ? colors.bg : colors.textMuted, background: mode === m ? colors.amber : "transparent" }}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-3.5">
              <label className="mb-1.5 block font-mono text-[10px] tracking-wide text-[var(--dash-text-muted)]">EMAIL</label>
              <div className="relative">
                <Mail size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--dash-text-muted)]" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@controlroom.com"
                  className="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-panel-alt)] py-2.5 pl-8 pr-3 text-sm outline-none focus:border-[var(--dash-teal)]"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="mb-1.5 block font-mono text-[10px] tracking-wide text-[var(--dash-text-muted)]">PASSWORD</label>
              <div className="relative">
                <Lock size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--dash-text-muted)]" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-panel-alt)] py-2.5 pl-8 pr-9 text-sm outline-none focus:border-[var(--dash-teal)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2.5 top-1/2 flex -translate-y-1/2 cursor-pointer text-[var(--dash-text-muted)]"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-3 flex items-start gap-2 text-xs" style={{ color: colors.red }}>
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
            {notice && (
              <div className="mb-3 flex items-start gap-2 text-xs" style={{ color: colors.green }}>
                <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded py-2.5 text-sm font-bold uppercase tracking-wide disabled:cursor-default disabled:opacity-70"
              style={{ background: colors.amber, color: colors.bg }}
            >
              <LogIn size={15} />
              {submitting ? "Verifying…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </motion.div>

        <Link
          to="/"
          className="mt-5 block text-center text-xs font-medium text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
        >
          ← Back to site
        </Link>
      </div>
    </div>
  );
}

export function Login() {
  return (
    <DashThemeProvider>
      <LoginInner />
    </DashThemeProvider>
  );
}
