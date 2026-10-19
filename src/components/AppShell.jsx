import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CalendarCheck, DatabaseBackup, LayoutDashboard, Landmark, RefreshCw, Users, WifiOff } from "lucide-react";
import { useAppState } from "../context/AppStateContext";
import { formatDisplayDate } from "../utils/dates";

const NAV_ITEMS = [
  { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
  { id: "home", label: "Cobros", icon: CalendarCheck },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "loans", label: "Préstamos", icon: Landmark },
  { id: "backups", label: "Respaldo", icon: DatabaseBackup },
];

export function AppShell({ view, onChangeView, children }) {
  const { lastExportAt, storageError } = useAppState();
  const [online, setOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [pwaError, setPwaError] = useState("");
  const stale = !lastExportAt;

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handlePwaStatus = (event) => {
      setUpdateAvailable(Boolean(event.detail?.updateAvailable));
      if (event.detail?.error) setPwaError(event.detail.error);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("mindset:pwa-status", handlePwaStatus);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("mindset:pwa-status", handlePwaStatus);
    };
  }, []);

  function applyUpdate() {
    navigator.serviceWorker?.getRegistration().then((registration) => {
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    }).catch((error) => {
      console.error("No se pudo aplicar la actualización de MindSet.", error);
      setPwaError("No se pudo aplicar la actualización. Inténtalo de nuevo.");
    });
  }

  return (
    <div className="min-h-svh overflow-x-hidden text-slate-200">
      <header className="sticky top-0 z-30 hidden border-b border-white/10 bg-slate-900/60 backdrop-blur-xl md:block">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
          <span className="text-sm font-semibold tracking-[0.25em] text-emerald-300">MINDSET</span>
          <button type="button" onClick={() => onChangeView("backups")} className={`text-xs ${stale ? "font-medium text-amber-400" : "text-slate-400"}`}>
            {lastExportAt ? `Último respaldo: ${formatDisplayDate(lastExportAt.slice(0, 10))}` : "Sin respaldo descargado"}
          </button>
        </div>
      </header>

      <main className="px-4 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-6">
        {(!online || updateAvailable || pwaError) && (
          <div className="mx-auto mb-4 flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-3 text-sm">
            {!online ? <p className="flex items-center gap-2 text-amber-200"><WifiOff size={16} />Sin conexión. Los datos siguen disponibles en este dispositivo.</p> : null}
            {updateAvailable && (
              <div className="flex flex-wrap items-center gap-3 text-emerald-200">
                <span>Hay una actualización lista.</span>
                <button type="button" onClick={applyUpdate} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/15 px-3 py-1.5 font-medium"><RefreshCw size={14} />Actualizar</button>
              </div>
            )}
            {pwaError && <p role="status" className="text-amber-200">{pwaError}</p>}
          </div>
        )}
        {storageError && (
          <div role="alert" className="mx-auto mb-4 flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100 sm:flex-row sm:items-center sm:justify-between">
            <p>El almacenamiento local tiene un problema. Para evitar sobrescribir datos, se bloquearon las modificaciones. Importa un JSON desde Respaldo.</p>
            <button type="button" onClick={() => onChangeView("backups")} className="shrink-0 rounded-xl bg-rose-400/15 px-4 py-2 font-medium text-rose-100">
              Abrir Respaldo
            </button>
          </div>
        )}
        {children}
      </main>

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
