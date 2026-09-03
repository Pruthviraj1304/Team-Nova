import { useMemo, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const redirectState = useMemo(() => ({ from: location.pathname }), [location.pathname]);

  if (loading) {
    return <div className="min-h-screen bg-[var(--color-bg)]" />;
  }

  if (!user) {
    return <Navigate to="/login" state={redirectState} replace />;
  }

  return <>{children}</>;
}
