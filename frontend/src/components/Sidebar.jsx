
import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    Wallet,
    ArrowLeftRight,
    Settings,
    Landmark,
    ShieldCheck,
} from "lucide-react";

const menuItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Accounts", path: "/accounts", icon: Wallet },
    { name: "Transactions", path: "/transactions", icon: ArrowLeftRight },
    { name: "Settings", path: "/settings", icon: Settings },
];

function Sidebar() {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <Landmark size={28} />
                <span>LedgerLine</span>
            </div>

            <div className="sidebar-label">MAIN MENU</div>

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
                            <Icon size={19} />
                            <span>{item.name}</span>
                        </NavLink>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <ShieldCheck size={18} />
                <span>Secure Banking Platform</span>
            </div>
        </aside>
    );
}

export default Sidebar;
