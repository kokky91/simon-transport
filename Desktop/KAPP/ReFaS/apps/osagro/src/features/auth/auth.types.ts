export const AUTH_STORAGE_KEY = "osagro.auth.token";

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: {
    id: string;
    email: string;
    tenantId: string;
  };
};

export type AuthContextValue = {
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoggingIn: boolean;
  loginError: string | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
};