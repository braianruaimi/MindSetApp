import { useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import { clientName } from "../services/clients";
import {
  amountDue,
  installmentStatus,
  lateFeeForInstallment,
  loanEntries,
  outstandingBalance,
  registerCollection,
} from "../services/loans";
import { daysAfter, formatDisplayDate, monthCells, todayISODate } from "../utils/dates";
import { formatMoney } from "../utils/money";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const STATUS_LABEL = { paid: "Cobrado", pending: "Pendiente", overdue: "Atrasado" };

export function HomePage({ onOpenSettings, onOpenClients, onOpenLoans }) {
  const { config, database, status, error, remoteMissing, syncing, reload, initializeRemote, commit } = useAppState();
  const today = todayISODate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(() => monthOf(today));
  const [actionError, setActionError] = useState("");
  const ready = status === "ready" && !remoteMissing;
  const entries = useMemo(() => loanEntries(database), [database]);
  const dueByDate = useMemo(() => {
    const grouped = new Map();
    entries.forEach((entry) => {
      const list = grouped.get(entry.installment.dueDate) ?? [];
      list.push(entry);
      grouped.set(entry.installment.dueDate, list);
    });
    return grouped;
  }, [entries]);
  const selectedEntries = dueByDate.get(selectedDate) ?? [];
  const overdue = entries
      .filter((entry) => entry.installment.dueDate !== selectedDate && installmentStatus(entry.installment, today) === "overdue")
    .sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate));
  const upcoming = entries
    .filter((entry) => {
      const daysUntil = daysAfter(today, entry.installment.dueDate);
      return entry.installment.dueDate !== selectedDate && entry.installment.status !== "paid" && daysUntil > 0 && daysUntil <= 7;
    })
    .sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate));
  const dayTotal = selectedEntries.reduce((sum, entry) => sum + amountDue(entry.installment, today), 0);
  const cells = monthCells(visibleMonth.year, visibleMonth.month);

  async function toggleCollection(entry) {
    setActionError("");
    const collected = entry.installment.status !== "paid";
    try {
      await commit(
        (current) => registerCollection(current, entry.loan.id, entry.installment.id, collected, today),
        collected ? "collect: cuota" : "revert: cuota",
      );
    } catch (collectError) {
      setActionError(collectError.message);
    }
  }

  function shiftMonth(offset) {
    const date = new Date(visibleMonth.year, visibleMonth.month + offset, 1);
    setVisibleMonth({ year: date.getFullYear(), month: date.getMonth() });
  }

  return (
      <section className="mx-auto w-full max-w-2xl space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Cobros</h1>
          <p className="text-sm text-slate-600">{formatDisplayDate(today)} · {config ? "sincronizado con GitHub" : "sin repositorio"}</p>
        </header>

        {status === "unconfigured" && <Notice text="Conecta el repositorio en Ajustes para ver los vencimientos." actionLabel="Abrir ajustes" onAction={onOpenSettings} />}
        {remoteMissing && <Notice text="El repositorio no tiene database.json." actionLabel="Crear archivo" onAction={() => initializeRemote()} />}
        {(error || actionError) && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError || error}</p>}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg px-3 py-2 text-sm text-slate-600">Anterior</button>
            <p className="text-sm font-medium capitalize text-slate-900">{monthLabel(visibleMonth)}</p>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg px-3 py-2 text-sm text-slate-600">Siguiente</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
            {WEEKDAYS.map((day) => <span key={day} className="py-1">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((isoDate, index) => {
              if (!isoDate) return <span key={`empty-${index}`} />;
              const dayEntries = dueByDate.get(isoDate) ?? [];
              const hasOverdue = dayEntries.some((entry) => installmentStatus(entry.installment, today) === "overdue");
              const selected = isoDate === selectedDate;
              return (
                <button
                  key={isoDate}
                  type="button"
                  onClick={() => setSelectedDate(isoDate)}
                  className={`relative rounded-lg py-2 text-sm ${selected ? "bg-teal-700 text-white" : isoDate === today ? "bg-teal-50 text-teal-900" : "text-slate-700"}`}
                >
                  {Number(isoDate.slice(-2))}
                  {dayEntries.length > 0 && <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${selected ? "bg-white" : hasOverdue ? "bg-rose-600" : "bg-teal-700"}`} />}
                </button>
              );
            })}
          </div>
        </div>

        <CollectionSection title={selectedDate === today ? "Cobros de hoy" : `Cobros del ${formatDisplayDate(selectedDate)}`} total={dayTotal} entries={selectedEntries} clients={database.clients} today={today} syncing={syncing || !ready} onToggle={toggleCollection} empty="No hay cuotas para esta fecha." />
        <CollectionSection title="Atrasados" entries={overdue} clients={database.clients} today={today} syncing={syncing || !ready} onToggle={toggleCollection} empty="No hay cuotas atrasadas." />
        <CollectionSection title="Próximos 7 días" entries={upcoming} clients={database.clients} today={today} syncing={syncing || !ready} onToggle={toggleCollection} empty="No hay vencimientos en los próximos 7 días." />

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => reload().catch(() => undefined)} disabled={!config || syncing} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60">Volver a leer</button>
          <button type="button" onClick={onOpenClients} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700">Clientes</button>
          <button type="button" onClick={onOpenLoans} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700">Préstamos</button>
        </div>
      </section>
    );
  }

  function CollectionSection({ title, total, entries, clients, today, syncing, onToggle, empty }) {
    return (
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-medium text-slate-900">{title}</h2>
          {total !== undefined && <p className="text-sm text-slate-600">{formatMoney(total)}</p>}
        </div>
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{empty}</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => {
              const client = clients.find((item) => item.id === entry.loan.clientId);
              const status = installmentStatus(entry.installment, today);
              const lateFee = lateFeeForInstallment(entry.installment, today);
              return (
                <li key={entry.installment.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{client ? clientName(client) : "Cliente eliminado"}</p>
                      <p className="mt-1 text-sm text-slate-600">Cuota {entry.installment.number}/{entry.loan.installmentCount} · {formatDisplayDate(entry.installment.dueDate)}</p>
                      <p className="mt-1 text-sm text-slate-500">Saldo del préstamo: {formatMoney(outstandingBalance(entry.loan, today))}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{formatMoney(amountDue(entry.installment, today))}</p>
                  </div>
                  {lateFee > 0 && <p className="mt-2 text-sm text-rose-700">Mora {formatMoney(lateFee)}</p>}
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={status === "paid"} disabled={syncing} onChange={() => onToggle(entry)} className="h-4 w-4 accent-teal-700" />
                    <span className={status === "overdue" ? "font-medium text-rose-700" : "text-slate-700"}>{STATUS_LABEL[status]}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  function Notice({ text, actionLabel, onAction }) {
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
        <p>{text}</p>
        <button type="button" onClick={onAction} className="rounded-lg bg-amber-700 px-3 py-2 font-medium text-white">{actionLabel}</button>
      </div>
    );
  }

  function monthOf(isoDate) {
    const [year, month] = isoDate.split("-").map(Number);
    return { year, month: month - 1 };
  }

  function monthLabel({ year, month }) {
    return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(year, month, 1));
  }
