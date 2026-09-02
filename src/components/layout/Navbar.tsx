import { useEffect, useState } from "react";
import { AnimatePresence, motion, useScroll } from "framer-motion";
import { Menu, X, ShieldHalf, LayoutDashboard, LogIn, LogOut } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

const links = [
  { label: "Features", href: "#features" },
  { label: "Hardware", href: "#hardware" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Applications", href: "#applications" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const onLanding = location.pathname === "/";
  const { user, signOut } = useAuth();

  useEffect(() => {
    return scrollY.on("change", (v) => setScrolled(v > 24));
  }, [scrollY]);

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div
        className={cn(
          "mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5 transition-all duration-300 sm:px-6",
          scrolled ? "glass-strong shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]" : "bg-transparent",
        )}
      >
        <Link to="/" className="flex items-center gap-2.5 cursor-pointer">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)]">
            <ShieldHalf className="h-4.5 w-4.5 text-[#05070c]" strokeWidth={2.4} />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight text-[var(--color-text)]">
            MineGuard <span className="text-[var(--color-primary)]">X</span>
          </span>
        </Link>

        {onLanding && (
          <nav className="hidden items-center gap-7 md:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="cursor-pointer text-[13.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                {l.label}
              </a>
            ))}
          </nav>
        )}

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="flex cursor-pointer items-center gap-1.5 text-[13.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                <LayoutDashboard className="h-4 w-4" />
                Control Room
              </Link>
              <button
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-1.5 text-[13.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="flex cursor-pointer items-center gap-1.5 text-[13.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              <LogIn className="h-4 w-4" />
              Log in
            </Link>
          )}
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full glass md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-3 mt-2 rounded-2xl glass-strong p-4 md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {onLanding &&
                links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)]"
                  >
                    {l.label}
                  </a>
                ))}
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)]"
                  >
                    Control Room
                  </Link>
                  <button
                    onClick={() => {
                      setOpen(false);
                      handleLogout();
                    }}
                    className="cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)]"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)]"
                >
                  Log in
                </Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
