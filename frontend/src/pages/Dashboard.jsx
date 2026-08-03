import { BatteryCharging, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export default function Dashboard() {
  const stats = [
    { label: "Active AGVs", value: "24 / 28", status: "+2 from last shift", color: "text-emerald-400", border: "border-emerald-500/20" },
    { label: "Avg Fleet Battery", value: "86%", status: "3 charging", color: "text-indigo-400", border: "border-indigo-500/20" },
    { label: "Pending Tasks", value: "142", status: "Est. completion: 45m", color: "text-blue-400", border: "border-blue-500/20" },
    { label: "System Alerts", value: "1", status: "Zone B-4 Obstruction", color: "text-amber-400", border: "border-amber-500/20" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Overview</h1>
          <p className="text-sm text-slate-400">Real-time robotics operations and facility telemetry.</p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            All Systems Nominal
          </span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className={`p-5 rounded-xl bg-slate-950 border ${stat.border} shadow-lg relative overflow-hidden`}>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-3xl font-extrabold mt-2 font-mono ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {stat.status}
            </p>
          </div>
        ))}
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-xl bg-slate-950 border border-slate-800">
          <h2 className="text-base font-semibold text-white mb-4">Live Task Execution</h2>
          <div className="space-y-3">
            {[
              { id: "TSK-8921", robot: "AGV-04 (Atlas)", task: "Pallet retrieval from Rack 4-B", status: "In Progress", time: "2m ago", bg: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
              { id: "TSK-8920", robot: "AGV-12 (Titan)", task: "Transit to Charging Station 02", status: "Charging", time: "8m ago", bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
              { id: "TSK-8919", robot: "DRN-01 (Scout)", task: "Aisle 12 inventory scan complete", status: "Completed", time: "12m ago", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
            ].map((row, idx) => (
              <div key={idx} className="flex items-center justify-between p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-slate-500">{row.id}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{row.robot}</p>
                    <p className="text-xs text-slate-400">{row.task}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-md font-medium border ${row.bg}`}>{row.status}</span>
                  <span className="text-xs text-slate-500 w-12 text-right">{row.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Incidents Panel */}
        <div className="p-6 rounded-xl bg-slate-950 border border-slate-800">
          <h2 className="text-base font-semibold text-white mb-4">Active Alerts</h2>
          <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-amber-300">Obstruction Detected</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                AGV-08 halted in Sector B-4. Manual clearance required before resuming automated pathing.
              </p>
              <button className="mt-3 text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-4">
                View on Warehouse Map →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}