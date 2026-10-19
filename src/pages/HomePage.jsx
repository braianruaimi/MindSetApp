import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Landmark, Users } from "lucide-react";
import { toast } from "sonner";
import { CollectBurst } from "../components/CollectBurst";
import { useAppState } from "../context/AppStateContext";
import { clientName } from "../services/clients";
import { EMPTY_FILTERS, filterEntries, hasActiveFilters, summarizeEntries } from "../services/collectionsFilter";
import {
  amountDue,
  collectionDateForInstallment,
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

export function HomePage({ onOpenClients, onOpenLoans }) {
  const { database, commit } = useAppState();
  const syncing = false;
  const today = todayISODate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(() => monthOf(today));
  const [actionError, setActionError] = useState("");
  const [burst, setBurst] = useState(0);
  const entries = useMemo(() => loanEntries(database), [database]);
  const dueByDate = useMemo(() => {
    const grouped = new Map();
    entries.forEach((entry) => {
      const date = collectionDateForInstallment(entry.installment);
      const list = grouped.get(date) ?? [];
      list.push(entry);
      grouped.set(date, list);
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
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const filtering = hasActiveFilters(filters);
  const filteredEntries = useMemo(() => (filtering ? filterEntries(entries, filters, today) : []), [entries, filters, filtering, today]);
  const filteredSummary = useMemo(() => summarizeEntries(filteredEntries, today), [filteredEntries, today]);
  const overall = useMemo(() => summarizeEntries(entries, today), [entries, today]);
  const todayEntries = dueByDate.get(today) ?? [];
  const upcomingAll = entries.filter((entry) => {
    const daysUntil = daysAfter(today, entry.installment.dueDate);
    return entry.installment.status !== "paid" && daysUntil > 0 && daysUntil <= 7;
  });
  const cells = monthCells(visibleMonth.year, visibleMonth.month);

  async function toggleCollection(entry) {
    setActionError("");
    const collected = entry.installment.status !== "paid";
    try {
      await commit(
        (current) => registerCollection(current, entry.loan.id, entry.installment.id, collected, today),
        collected ? "collect: cuota" : "revert: cuota",
      );
      if (collected) {
        setSelectedDate(today);
        setVisibleMonth(monthOf(today));
        setBurst((current) => current + 1);
        toast.success("Cobro registrado", { description: "Guardado en este dispositivo" });
      } else {
        toast("Cobro revertido");
      }
    } catch (collectError) {
      setActionError(collectError.message);
      toast.error(collectError.message);
    }
  }

  function shiftMonth(offset) {
    const date = new Date(visibleMonth.year, visibleMonth.month + offset, 1);
    setVisibleMonth({ year: date.getFullYear(), month: date.getMonth() });
  }

  return (
      <section className="mx-auto w-full max-w-2xl space-y-5">
        <CollectBurst trigger={burst} />
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Agenda</p>
          <h1 className="text-2xl font-semibold text-white">Cobros</h1>
          <p className="flex items-center gap-1.5 text-sm text-slate-400"><CalendarDays size={14} />{formatDisplayDate(today)} · guardado en este dispositivo</p>
        </header>

        {actionError && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{actionError}</p>}

        <div className="grid grid-cols-3 gap-3 text-center">
          <SummaryCard label="Atrasadas" count={overall.overdueCount} amount={overall.overdue} tone="text-orange-300" />
          <SummaryCard label="Hoy" count={todayEntries.length} amount={todayEntries.reduce((sum, entry) => sum + (entry.installment.status === "paid" ? 0 : amountDue(entry.installment, today)), 0)} tone="text-emerald-300" />
          <SummaryCard label="Próx. 7 días" count={upcomingAll.length} amount={upcomingAll.reduce((sum, entry) => sum + amountDue(entry.installment, today), 0)} tone="text-sky-300" />
        </div>

        <div className="glass space-y-3 rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Filter size={15} className="text-sky-300" />Filtros</h2>
            {filtering && <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs text-slate-400 hover:text-white">Limpiar</button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select aria-label="Filtrar por cliente" value={filters.clientId} onChange={(event) => setFilters({ ...filters, clientId: event.target.value })} className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm">
              <option value="">Todos los clientes</option>
              {[...database.clients].sort((a, b) => clientName(a).localeCompare(clientName(b))).map((client) => <option key={client.id} value={client.id}>{clientName(client)}</option>)}
            </select>
            <select aria-label="Filtrar por estado" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm">
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="overdue">Atrasado</option>
              <option value="paid">Cobrado</option>
            </select>
            <label className="text-xs text-slate-400">Desde
              <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs text-slate-400">Hasta
              <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm" />
            </label>
          </div>
        </div>

        {filtering ? (
          <>
            <div className="glass grid grid-cols-3 gap-3 rounded-2xl p-4 text-center text-xs text-slate-400">
              <p>Cobrado<span className="block text-base font-semibold text-emerald-300">{formatMoney(filteredSummary.collected)}</span>{filteredSummary.collectedCount} cuotas</p>
              <p>Por cobrar<span className="block text-base font-semibold text-white">{formatMoney(filteredSummary.toCollect)}</span>{filteredSummary.toCollectCount} cuotas</p>
              <p>Atrasado<span className="block text-base font-semibold text-orange-300">{formatMoney(filteredSummary.overdue)}</span>{filteredSummary.overdueCount} cuotas</p>
            </div>
            <CollectionSection title={`Resultados (${filteredEntries.length})`} entries={filteredEntries} clients={database.clients} today={today} syncing={syncing} onToggle={toggleCollection} empty="Ninguna cuota coincide con los filtros." />
          </>
        ) : null}

        {!filtering && (<>
        <div className="glass rounded-3xl p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" aria-label="Mes anterior" onClick={() => shiftMonth(-1)} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><ChevronLeft size={18} /></button>
            <p className="text-sm font-semibold capitalize text-white">{monthLabel(visibleMonth)}</p>
            <button type="button" aria-label="Mes siguiente" onClick={() => shiftMonth(1)} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><ChevronRight size={18} /></button>
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
                  className={`relative aspect-square rounded-xl text-sm transition ${selected ? "bg-teal-700 font-semibold text-white shadow-lg shadow-emerald-950/40" : isoDate === today ? "bg-emerald-400/10 font-medium text-emerald-200" : "text-slate-300 hover:bg-white/10"}`}
                >
                  {Number(isoDate.slice(-2))}
                  {dayEntries.length > 0 && <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${selected ? "bg-emerald-100" : hasOverdue ? "bg-rose-500" : "bg-emerald-400"}`} />}
                </button>
              );
            })}
          </div>
        </div>

        <CollectionSection title={selectedDate === today ? "Cobros de hoy" : `Cobros del ${formatDisplayDate(selectedDate)}`} total={dayTotal} entries={selectedEntries} clients={database.clients} today={today} syncing={syncing} onToggle={toggleCollection} empty="No hay cuotas para esta fecha." />
        <CollectionSection title="Atrasados" entries={overdue} clients={database.clients} today={today} syncing={syncing} onToggle={toggleCollection} empty="No hay cuotas atrasadas." />
        <CollectionSection title="Próximos 7 días" entries={upcoming} clients={database.clients} today={today} syncing={syncing} onToggle={toggleCollection} empty="No hay vencimientos en los próximos 7 días." />
        </>)}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onOpenClients} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10"><Users size={16} />Clientes</button>
          <button type="button" onClick={onOpenLoans} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10"><Landmark size={16} />Préstamos</button>
        </div>
      </section>
    );
  }

  function CollectionSection({ title, total, entries, clients, today, syncing, onToggle, empty }) {
    return (
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-semibold text-white">{title}</h2>
          {total !== undefined && <p className="rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-200">{formatMoney(total)}</p>}
        </div>
        {entries.length === 0 ? (
          <p className="glass rounded-2xl border-dashed px-4 py-6 text-center text-sm text-slate-400">{empty}</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => {
              const client = clients.find((item) => item.id === entry.loan.clientId);
              const status = installmentStatus(entry.installment, today);
              const lateFee = lateFeeForInstallment(entry.installment, today);
              return (
                <motion.li key={entry.installment.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{client ? clientName(client) : "Cliente eliminado"}</p>
                      <p className="mt-1 text-sm text-slate-600">Cuota {entry.installment.number}/{entry.loan.installmentCount} · {formatDisplayDate(entry.installment.dueDate)}</p>
                      {status === "paid" && <p className="mt-1 text-xs text-emerald-300">Cobrada el {formatDisplayDate(collectionDateForInstallment(entry.installment))}</p>}
                      <p className="mt-1 text-sm text-slate-500">Saldo del préstamo: {formatMoney(outstandingBalance(entry.loan, today))}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{formatMoney(amountDue(entry.installment, today))}</p>
                  </div>
                  {lateFee > 0 && <p className="mt-2 text-sm text-rose-700">Mora {formatMoney(lateFee)}</p>}
                  <label className={`mt-3 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${status === "paid" ? "bg-emerald-400/10 text-emerald-200" : status === "overdue" ? "bg-orange-400/10 text-orange-300" : "bg-white/5 text-slate-300"}`}>
                    <input type="checkbox" checked={status === "paid"} disabled={syncing} onChange={() => onToggle(entry)} className="h-4 w-4 accent-emerald-400" />
                    <span className="font-medium">{STATUS_LABEL[status]}</span>
                  </label>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  function SummaryCard({ label, count, amount, tone }) {
    return (
      <div className="glass rounded-2xl p-3">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`mt-1 text-lg font-semibold ${tone}`}>{count}</p>
        <p className="text-xs text-slate-500">{formatMoney(amount)}</p>
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
