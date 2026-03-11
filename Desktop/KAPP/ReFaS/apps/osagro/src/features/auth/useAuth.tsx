import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../../store/sessionStore";
import { useTenantStore } from "../../store/tenantStore";
import { env } from "../../lib/utils/env";
import { AUTH_STORAGE_KEY, type AuthContextValue, type LoginInput, type LoginResponse } from "./auth.types";

type JwtPayload = {
  sub?: string;
  tenant_id?: string;
  tenantId?: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSessionStore((state) => state.accessToken);
  const setSession = useSessionStore((state) => state.setSession);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setTenantId = useTenantStore((state) => state.setTenantId);
  const clearTenant = useTenantStore((state) => state.clearTenant);

  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedToken) {
      setIsHydrated(true);
      return;
    }

    const payload = decodeJwtPayload(storedToken);
    const userId = payload?.sub;
    const tenantId = payload?.tenant_id ?? payload?.tenantId;

    if (!userId || !tenantId) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      clearSession();
      clearTenant();
      setIsHydrated(true);
      return;
    }

    setSession(storedToken, userId);
    setTenantId(tenantId);
    setIsHydrated(true);
  }, [clearSession, clearTenant, setSession, setTenantId]);

  async function login(input: LoginInput) {
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const response = await fetch(`${env.apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      const data = (await response.json()) as LoginResponse;
      setSession(data.accessToken, data.user.id);
      setTenantId(data.user.tenantId);
      localStorage.setItem(AUTH_STORAGE_KEY, data.accessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      setLoginError(message);
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  }

  function logout() {
    clearSession();
    clearTenant();
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setLoginError(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      isHydrated,
      isLoggingIn,
      loginError,
      login,
      logout
    }),
    [token, isHydrated, isLoggingIn, loginError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}