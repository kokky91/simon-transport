import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await auth.login({ email, password });
      navigate("/dashboard", { replace: true });
    } catch {
      return;
    }
  }

  return (
    <section className="os-login-shell">
      <form className="os-login-card" onSubmit={onSubmit}>
        <h1>Sign in to Osagro</h1>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button type="button" onClick={() => navigate("/register")}>
          Register
        </button>
        <button type="submit" disabled={auth.isLoggingIn}>
          {auth.isLoggingIn ? "Signing in..." : "Sign in"}
        </button>
        {auth.loginError ? <p>{auth.loginError}</p> : null}
      </form>
    </section>
  );
}