import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Tractor,
  MapPin,
  Leaf,
  PawPrint,
  CheckSquare,
  DollarSign,
  Activity,
  Zap,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sprout,
  ShieldCheck,
} from "lucide-react";
import { useSessionStore } from "../../store/sessionStore";
import { useTenantStore } from "../../store/tenantStore";
import FarmChatButton from "../../features/farmchat/components/FarmChatButton";
import { useTheme } from "../app/useTheme";

const navLinks = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/farms", label: "Farms", Icon: Tractor },
  { to: "/fields", label: "Fields", Icon: MapPin },
  { to: "/plants", label: "Plants", Icon: Leaf },
  { to: "/animals", label: "Animals", Icon: PawPrint },
  { to: "/tasks", label: "Tasks", Icon: CheckSquare },
  { to: "/crops", label: "Crops", Icon: Zap },
  { to: "/finance", label: "Finance", Icon: DollarSign },
  { to: "/simulations", label: "Simulations", Icon: Activity },
  { to: "/market", label: "Market", Icon: TrendingUp },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  useTheme();

  return (
    <div className={`os-shell${collapsed ? " collapsed" : ""}`}>
      <aside className="os-sidebar">
        <div className="os-sidebar-header">
          <div className="os-sidebar-logo">
            <Sprout size={16} />
          </div>
          <span className="os-sidebar-brand">Osagro</span>
          <button
            type="button"
            className="os-sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav className="os-nav">
          {navLinks.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to}>
              <Icon size={18} className="os-nav-icon" />
              <span className="os-nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="os-sidebar-footer">
          <LogoutButton collapsed={collapsed} />
        </div>
      </aside>

      <main className="os-main">
        <header className="os-main-header">
          <span />
        </header>
        <div className="os-main-content">
          <Outlet />
        </div>
      </main>

      <FarmChatButton />
    </div>
  );
}

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearTenant = useTenantStore((state) => state.clearTenant);

  function logout() {
    clearSession();
    clearTenant();
    localStorage.clear();
  }

  return (
    <button type="button" className="os-logout-btn" onClick={logout} title="Logout">
      <LogOut size={18} className="os-nav-icon" />
      {!collapsed && <span className="os-logout-label">Logout</span>}
    </button>
  );
}
