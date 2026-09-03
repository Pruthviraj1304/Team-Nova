import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

interface AuthResult {
  error: string | null;
  /** True when sign-up returned a live session (email confirmation is disabled on the project). */
  signedIn?: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<AuthResult> {
    if (!supabase) return { error: "Supabase is not configured." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string): Promise<AuthResult> {
    if (!supabase) return { error: "Supabase is not configured." };
    const { data, error } = await supabase.auth.signUp({ email, password });
    // Supabase's own error text ("User already registered") directly confirms
    // an email is taken — a classic account-enumeration leak. Soften it so a
    // failed signup doesn't explicitly confirm the account exists.
    // ponytail: this only hides the wording; a prober can still distinguish
    // "existing email" (errors) from "new email" (succeeds) by outcome alone.
    // Closing that fully needs a server-side proxy that responds identically
    // either way — out of scope here.
    const message = error?.message?.toLowerCase().includes("already registered")
      ? "Unable to create an account with these details. If you already have one, try signing in instead."
      : (error?.message ?? null);
    return { error: message, signedIn: Boolean(data.session) };
  }

  async function signOut() {
    if (!supabase) return;
    // supabase-js still calls /auth/v1/logout under the hood whenever a
    // session exists, regardless of `scope` — so if that endpoint is
    // unreachable this would hang forever. Race it against a short timeout
    // and forcibly clear the cached session either way, then hard-reload so
    // the app re-initializes as signed-out without depending on the network.
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
    await Promise.race([supabase.auth.signOut({ scope: "local" }).catch(() => {}), timeout]);

    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
      .forEach((k) => localStorage.removeItem(k));

    window.location.href = "/";
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        configured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
