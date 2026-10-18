import { useAppState } from "../context/AppStateContext";

const NAV_ITEMS = [
  { id: "home", label: "Cobros" },
  { id: "clients", label: "Clientes" },
  { id: "loans", label: "Préstamos" },
    { id: "reports", label: "Ganancias" },
    { id: "settings", label: "Ajustes" },
];

export function AppShell({ view, onChangeView, children }) {
  const { syncing, status } = useAppState();

  return (
    <div className="min-h-svh bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
          <span className="text-sm font-semibold tracking-wide text-teal-800">MINDSET</span>
          <span className="text-xs text-slate-500">
            {syncing ? "Guardando..." : status === "ready" ? "En línea" : "Sin sincronizar"}
          </span>
        </div>
      </header>
      <main className="px-4 py-6 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-2xl grid-cols-5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              className={`px-1 py-4 text-xs sm:text-sm ${view === item.id ? "font-semibold text-teal-800" : "text-slate-500"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
