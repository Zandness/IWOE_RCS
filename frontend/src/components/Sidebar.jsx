import {
  ArrowLeftRight,
  Boxes,
  ChartColumn,
  CheckCircle2,
  ClipboardList,
  Files,
  History,
  LayoutDashboard,
  Map,
  Send,
  Settings,
  Warehouse,
} from "lucide-react";

import { Link, NavLink } from "react-router-dom";

export default function Sidebar() {
  const menu = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
      end: true,
    },
    {
      name: "Warehouse Monitor",
      path: "/warehouse",
      icon: Map,
    },
    {
      name: "Inventory & Storage Data",
      path: "/warehouse-data",
      icon: Boxes,
    },
    {
      name: "Warehouse Operations",
      path: "/operations",
      icon: ArrowLeftRight,
    },
    {
      name: "Inbound / Outbound Documents",
      path: "/documents",
      icon: Files,
    },
    {
      name: "Stock Count",
      path: "/stock-count",
      icon: ClipboardList,
    },
    {
      name: "Audit History",
      path: "/audit-history",
      icon: History,
    },
    {
      name: "Reports & CSV Export",
      path: "/reports",
      icon: ChartColumn,
    },
    {
      name: "Task Management",
      path: "/tasks",
      icon: CheckCircle2,
    },
    {
      name: "RCS Dispatch Queue",
      path: "/dispatcher",
      icon: Send,
    },
    {
      name: "Settings",
      path: "/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="sidebar navigation-sidebar">
      <nav aria-label="Main navigation">
        {menu.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              title={item.name}
              aria-label={item.name}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} aria-hidden="true" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <Link
          to="/settings"
          className="sidebar-connection"
          title="Check connections in Settings"
          aria-label="Check connections in Settings"
        >
          <Settings size={18} aria-hidden="true" />

          <span className="sidebar-connection-text">
            <strong>Connection checks</strong>
            <span>Open Settings</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}