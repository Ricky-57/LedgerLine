import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Landmark,
  ShieldCheck,
  Database,
  Lock,
} from "lucide-react";

const menuItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "Accounts", path: "/accounts", icon: Wallet },
  { name: "Transactions & Audit", path: "/transactions", icon: ArrowLeftRight },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon-box">
          <Landmark size={20} />
        </div>
        <div className="brand-text">
          <span className="brand-title">LedgerLine</span>
          <span className="brand-badge">ENTERPRISE CORE</span>
        </div>
      </div>

      <div className="sidebar-label">FINANCIAL LEDGER</div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="engine-status-row">
          <span className="pulse-dot"></span>
          <span>SYSTEMS OPERATIONAL</span>
        </div>
        <span className="engine-detail">Real-Time Ledger Settlement</span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", fontSize: "10px", color: "var(--text-muted)" }}>
          <ShieldCheck size={12} />
          <span>Bank-Grade Encryption</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
