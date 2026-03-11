import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isHydrated) {
    return <p>Checking session...</p>;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}