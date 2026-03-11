import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { env } from "../../lib/utils/env";

type RegisterResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: {
    id: string;
    email: string;
    tenantId: string;
  };
};

export function RegisterPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${env.apiBaseUrl}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error("Email is al geregistreerd");
        }
        throw new Error("Registratie mislukt");
      }

      const data = (await response.json()) as RegisterResponse;
      await auth.login({ email: data.user.email, password });
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registratie mislukt");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="os-login-shell">
      <form className="os-login-card" onSubmit={onSubmit}>
        <h1>Register for Osagro</h1>
        <label htmlFor="register-email">Email</label>
        <input
          id="register-email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
        />
        <button type="submit" disabled={isSubmitting || auth.isLoggingIn}>
          {isSubmitting || auth.isLoggingIn ? "Registering..." : "Register"}
        </button>
        {error ? <p>{error}</p> : null}
        <p>
          Heb je al een account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </section>
  );
}
