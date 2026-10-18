import { motion } from "framer-motion";
import { CalendarCheck, DatabaseBackup, LayoutDashboard, Landmark, Users } from "lucide-react";
import { useAppState } from "../context/AppStateContext";

const NAV_ITEMS = [
  { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
  { id: "home", label: "Cobros", icon: CalendarCheck },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "loans", label: "Préstamos", icon: Landmark },
  { id: "backups", label: "Respaldo", icon: DatabaseBackup },
];

export function AppShell({ view, onChangeView, children }) {
  const { lastExportAt } = useAppState();
  const days = lastExportAt ? Math.floor((new Date().getTime() - new Date(lastExportAt).getTime()) / 86400000) : null;
  const stale = days === null || days >= 7;

  return (
    <div className="min-h-svh overflow-x-hidden text-slate-200">
      <header className="sticky top-0 z-30 hidden border-b border-white/10 bg-slate-900/60 backdrop-blur-xl md:block">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
          <span className="text-sm font-semibold tracking-[0.25em] text-emerald-300">MINDSET</span>
          <button type="button" onClick={() => onChangeView("backups")} className={`text-xs ${stale ? "font-medium text-amber-400" : "text-slate-400"}`}>
            {days === null ? "Sin respaldo descargado" : days === 0 ? "Respaldo de hoy" : `Último respaldo: hace ${days} d`}
          </button>
        </div>
      </header>

      <main className="px-4 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="glass mx-auto grid w-full max-w-2xl grid-cols-5 rounded-3xl bg-slate-900/70 p-1.5 shadow-2xl shadow-black/40">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChangeView(id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[10px] ${active ? "text-emerald-300" : "text-slate-400"}`}
              >
                {active && (
                  <motion.span layoutId="nav-pill" transition={{ type: "spring", stiffness: 400, damping: 32 }} className="absolute inset-0 rounded-2xl bg-emerald-400/10 ring-1 ring-emerald-300/20" />
                )}
                <Icon size={20} className="relative" />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
