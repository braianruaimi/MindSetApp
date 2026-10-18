import { useMemo } from "react";
import { useAppState } from "../context/AppStateContext";
import { buildReport } from "../services/reports";
import { todayISODate } from "../utils/dates";
import { formatMoney } from "../utils/money";

export function ReportsPage() {
  const { database } = useAppState();
  const today = todayISODate();
  const report = useMemo(() => buildReport(database, today), [database, today]);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Ganancias</h1>
        <p className="mt-1 text-sm text-slate-600">{report.activeLoans} préstamos activos de {report.loanCount}. La mora se suma al dinero en la calle hasta que se cobra.</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Capital prestado" value={formatMoney(report.capitalLent)} />
        <Metric label="Capital en caja" value={formatMoney(report.recoveredCapital)} detail={`Caja total ${formatMoney(report.cashCollected)}`} />
        <Metric label="Interés proyectado" value={formatMoney(report.projectedInterest)} detail={`Cobrado ${formatMoney(report.collectedInterest)}`} />
        <Metric label="Interés real" value={formatMoney(report.realEarnings)} detail={`Mora cobrada ${formatMoney(report.collectedLateFees)}`} />
        <Metric label="Dinero en la calle" value={formatMoney(report.streetMoney)} detail={`Capital ${formatMoney(report.streetCapital)}`} />
        <Metric label="Atrasado" value={formatMoney(report.overdueAmount)} detail={`${report.overdueCount} cuotas`} tone="danger" />
      </div>

      <section className="space-y-3">
        <h2 className="font-medium text-slate-900">Por préstamo</h2>
        {report.rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Todavía no hay préstamos para reportar.</p>
        ) : (
          <ul className="space-y-3">
            {report.rows.map((row) => (
              <li key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{row.clientName}</p>
                    <p className="mt-1 text-sm text-slate-500">{row.status === "paid" ? "Cancelado" : "Activo"} · capital {formatMoney(row.capital)}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatMoney(row.streetMoney)}</p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <div>Interés proyectado <span className="block font-medium text-slate-900">{formatMoney(row.projectedInterest)}</span></div>
                  <div>Interés cobrado <span className="block font-medium text-slate-900">{formatMoney(row.collectedInterest)}</span></div>
                  <div>Capital en caja <span className="block font-medium text-slate-900">{formatMoney(row.recoveredCapital)}</span></div>
                  <div>Mora cobrada <span className="block font-medium text-slate-900">{formatMoney(row.collectedLateFees)}</span></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function Metric({ label, value, detail, tone = "default" }) {
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${tone === "danger" ? "border-rose-100 bg-rose-50" : "border-slate-200 bg-white"}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </article>
  );
}

