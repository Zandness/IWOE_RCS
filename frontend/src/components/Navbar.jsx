import { Bell, Search, User, ShieldCheck } from "lucide-react";

export default function Navbar() {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950 px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-lg text-white font-bold">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <span className="font-bold text-lg tracking-wide bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          AERO-FLEET <span className="text-indigo-500 text-xs px-1.5 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20">v2.4</span>
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative w-64 hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search AGVs, zones, tasks..." 
            className="w-full bg-slate-900 border border-slate-800 rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 border-l border-slate-800 pl-6">
          <button className="relative p-2 hover:bg-slate-900 rounded-full transition-colors text-slate-400 hover:text-white">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          </button>
          
          <div className="flex items-center gap-3 pl-2 cursor-pointer group">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center group-hover:border-slate-500 transition-colors">
              <User className="w-4 h-4 text-slate-300" />
            </div>
            <div className="hidden md:block text-left text-xs">
              <p className="font-medium text-slate-200">Ops Admin</p>
              <p className="text-slate-500">Sector 7-G</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}