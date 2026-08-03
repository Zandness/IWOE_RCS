import { NavLink } from "react-router-dom";
import { LayoutDashboard, Cpu, Map, Activity, Settings } from "lucide-react";

export default function Sidebar() {
  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Fleet Control", path: "/fleet", icon: Cpu },
    { name: "Warehouse Map", path: "/warehouse", icon: Map },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between hidden md:flex">
      <div className="p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">Navigation</p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-indigo-600/10 text-indigo-400 border border-indigo-600/20"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* System Telemetry Footer Widget */}
      <div className="p-4 m-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>Server Telemetry</span>
        </div>
        <div className="space-y-1.5 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Latency:</span>
            <span className="text-emerald-400 font-mono">18ms</span>
          </div>
          <div className="flex justify-between">
            <span>Mesh Network:</span>
            <span className="text-slate-200 font-mono">99.8%</span>
          </div>
        </div>
      </div>
    </aside>
  );
}