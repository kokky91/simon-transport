import { Link, Outlet } from "react-router-dom";
import { AUTH_STORAGE_KEY } from "../../features/auth/auth.types";
import { useSessionStore } from "../../store/sessionStore";
import { useTenantStore } from "../../store/tenantStore";
import FarmChatButton from "../../features/farmchat/components/FarmChatButton";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/farms", label: "Farms" },
  { to: "/fields", label: "Fields" },
  { to: "/plants", label: "Plants" },
  { to: "/animals", label: "Animals" },
  { to: "/tasks", label: "Tasks" },
  { to: "/finance", label: "Finance" },
  { to: "/simulations", label: "Simulations" },
  { to: "/simulations/live", label: "Live View" }
];

function decodeRoleFromToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function AppLayout() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const role = decodeRoleFromToken(accessToken);

  return (
    <div className="os-shell">
      <aside className="os-sidebar">
        <strong>Osagro</strong>
        <nav className="os-nav">
          {links.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
          {role === "admin" ? <Link to="/admin">Admin</Link> : null}
        </nav>
      </aside>
      <main className="os-main">
        <header className="os-main-header">
          <span />
          <LogoutButton />
        </header>
        <Outlet />
      </main>
      {/* FarmChatButton als vaste button rechtsonder */}
      <FarmChatButton />
    </div>
  );
}

function LogoutButton() {
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearTenant = useTenantStore((state) => state.clearTenant);

  function logout() {
    clearSession();
    clearTenant();
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  return (
    <button type="button" onClick={logout}>
      Logout
    </button>
  );
}