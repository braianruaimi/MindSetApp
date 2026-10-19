import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, CirclePlus, Landmark, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LoanEditor } from "../components/LoanEditor";
import { useAppState } from "../context/AppStateContext";
import { clientName } from "../services/clients";
import {
  LATE_FEE_PER_DAY,
  MAX_INSTALLMENTS,
  MIN_INSTALLMENTS,
  amountDue,
  buildSchedule,
  createLoan,
  installmentStatus,
  lateFeeForInstallment,
  outstandingBalance,
    registerCollection,
    removeLoan,
        updateLoan,
  } from "../services/loans";
import { formatDisplayDate, todayISODate } from "../utils/dates";
import { formatMoney } from "../utils/money";

const EMPTY_CLIENT = {
  firstName: "",
  lastName: "",
  phone: "",
  dni: "",
  address: "",
};

const STATUS_LABEL = {
  paid: "Cobrado",
  pending: "Pendiente",
  overdue: "Atrasado",
};

export function LoansPage() {
  const { database, commit } = useAppState();
  const syncing = false;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const today = todayISODate();
  const selected = (database.loans ?? []).find((loan) => loan.id === selectedId) ?? null;

  const loans = useMemo(() => {
    return [...(database.loans ?? [])].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [database.loans]);

  async function handleCreate(input) {
    setError("");
    await commit((current) => createLoan(current, input), "create: préstamo");
    setCreating(false);
  }

  async function handleCollect(installment) {
    if (!selected) return;
    setError("");
    try {
      const collected = installment.status !== "paid";
      await commit(
        (current) => registerCollection(current, selected.id, installment.id, collected, today),
        collected ? "collect: cuota" : "revert: cuota",
      );
      toast.success(collected ? "Cobro registrado" : "Cobro revertido", { description: "Guardado en este dispositivo" });
    } catch (collectError) {
      setError(collectError.message);
      toast.error(collectError.message);
    }
  }

  async function handleUpdate(input) {
    if (!selected) return;
    setError("");
    await commit((current) => updateLoan(current, selected.id, input), "edit: préstamo");
    setEditing(false);
  }

  async function handleDelete(loanId) {
    setError("");
    try {
      await commit((current) => removeLoan(current, loanId), "delete: préstamo");
      setPendingDeleteId("");
      setSelectedId("");
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Cartera activa</p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><Landmark size={22} className="text-emerald-300" />Préstamos</h1>
          <p className="mt-1 text-sm text-slate-400">Tasa mensual sobre el capital · mora {formatMoney(LATE_FEE_PER_DAY)} por día.</p>
        </div>
        <button type="button" onClick={() => { setError(""); setCreating(true); setEditing(false); setSelectedId(""); }} className="flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:brightness-110">
          <CirclePlus size={18} /><span className="hidden sm:inline">Nuevo préstamo</span><span className="sm:hidden">Nuevo</span>
        </button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}
      {creating && (
        <LoanForm
          clients={database.clients ?? []}
          syncing={syncing}
          onCancel={() => setCreating(false)}
          onSubmit={handleCreate}
        />
      )}

      {selected && editing && (
              <LoanEditor
                loan={selected}
                clients={database.clients ?? []}
                syncing={syncing}
                onCancel={() => setEditing(false)}
                onSubmit={handleUpdate}
              />
            )}

            {selected && !editing && (
              <LoanDetail
          loan={selected}
          client={(database.clients ?? []).find((client) => client.id === selected.clientId)}
          today={today}
          syncing={syncing}
          pendingDelete={pendingDeleteId === selected.id}
          onBack={() => setSelectedId("")}
          onAskDelete={() => setPendingDeleteId(selected.id)}
          onCancelDelete={() => setPendingDeleteId("")}
          onDelete={() => handleDelete(selected.id)}
                    onCollect={handleCollect}
                              onEdit={() => setEditing(true)}
                                      />
      )}

      <ul className="space-y-3">
        {loans.map((loan) => {
          const client = (database.clients ?? []).find((item) => item.id === loan.clientId);
          const nextDue = loan.installments?.find((installment) => installment.status !== "paid");
          return (
            <motion.li key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}>
              <button type="button" onClick={() => { setSelectedId(loan.id); setCreating(false); setEditing(false); }} className="glass w-full rounded-2xl p-4 text-left transition hover:border-emerald-300/20 hover:bg-white/[0.07]">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-white">{client ? clientName(client) : "Cliente eliminado"}</span>
                    <span className="mt-1 block text-sm text-slate-400">{formatMoney(loan.capital)} · {loan.installmentCount} cuotas · {loan.interestRate}% mensual</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[10px] uppercase tracking-wide text-slate-500">Saldo</span>
                    <span className="text-sm font-semibold text-white">{formatMoney(outstandingBalance(loan, today))}</span>
                  </span>
                </span>
                <span className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={14} />
                    {nextDue ? `Próximo vencimiento ${formatDisplayDate(nextDue.dueDate)}` : "Todas las cuotas cobradas"}
                  </span>
                  <ChevronRight size={16} className="text-slate-500" />
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>
      {loans.length === 0 && !creating && (
        <div className="glass flex flex-col items-center rounded-3xl border-dashed px-5 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300"><Landmark size={22} /></span>
          <p className="mt-3 font-medium text-slate-200">Sin préstamos todavía</p>
          <p className="mt-1 text-sm text-slate-400">Crea un préstamo y define sus cuotas, tasa y vencimientos.</p>
          <button type="button" onClick={() => setCreating(true)} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-300"><CirclePlus size={16} />Crear préstamo</button>
        </div>
      )}
    </section>
  );
}

function LoanForm({ clients, syncing, onCancel, onSubmit }) {
  const [clientMode, setClientMode] = useState(clients.length ? "existing" : "new");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [client, setClient] = useState(EMPTY_CLIENT);
  const [capital, setCapital] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [firstDueDate, setFirstDueDate] = useState(todayISODate());
  const [error, setError] = useState("");
  const selectedClient = clients.find((item) => item.id === clientId);

  const preview = useMemo(() => {
    try {
      return { schedule: buildSchedule({ capital, interestRate, installmentCount: Number(installmentCount), firstDueDate }), error: "" };
    } catch (previewError) {
      return { schedule: null, error: previewError.message };
    }
  }, [capital, interestRate, installmentCount, firstDueDate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({ clientMode, clientId, client, capital, interestRate, installmentCount: Number(installmentCount), firstDueDate });
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass space-y-4 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300"><Landmark size={20} /></span>
        <div><h2 className="font-semibold text-white">Nuevo préstamo</h2><p className="text-xs text-slate-400">Define el cliente y las condiciones</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/5 bg-slate-950/40 p-1 text-sm">
        <button type="button" onClick={() => setClientMode("existing")} disabled={!clients.length} className={`rounded-xl px-3 py-2.5 transition ${clientMode === "existing" ? "bg-white/10 font-medium text-white" : "text-slate-400 hover:text-white"}`}>Existente</button>
        <button type="button" onClick={() => setClientMode("new")} className={`rounded-xl px-3 py-2.5 transition ${clientMode === "new" ? "bg-white/10 font-medium text-white" : "text-slate-400 hover:text-white"}`}>Nuevo cliente</button>
      </div>

      {clientMode === "existing" ? (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-300">Cliente</span>
          <select value={clientId} onChange={(event) => setClientId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-slate-100">
            {clients.map((item) => <option key={item.id} value={item.id}>{clientName(item)} · {item.dni}</option>)}
          </select>
          {selectedClient && <span className="block text-slate-400">{selectedClient.phone} · {selectedClient.address}</span>}
        </label>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nombre" value={client.firstName} onChange={(value) => setClient((current) => ({ ...current, firstName: value }))} required />
          <TextField label="Apellido" value={client.lastName} onChange={(value) => setClient((current) => ({ ...current, lastName: value }))} required />
          <TextField label="Teléfono" value={client.phone} onChange={(value) => setClient((current) => ({ ...current, phone: value }))} required />
          <TextField label="DNI" value={client.dni} onChange={(value) => setClient((current) => ({ ...current, dni: value }))} required />
          <div className="sm:col-span-2">
            <TextField label="Dirección" value={client.address} onChange={(value) => setClient((current) => ({ ...current, address: value }))} required />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Capital" value={capital} onChange={setCapital} inputMode="numeric" required />
        <TextField label="Tasa mensual %" value={interestRate} onChange={setInterestRate} inputMode="decimal" required />
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-300">Cuotas</span>
          <select value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-slate-100">
            {Array.from({ length: MAX_INSTALLMENTS - MIN_INSTALLMENTS + 1 }, (_, index) => {
              const count = index + MIN_INSTALLMENTS;
              return <option key={count} value={count}>{count}</option>;
            })}
          </select>
        </label>
        <TextField label="Primera cuota" type="date" value={firstDueDate} onChange={setFirstDueDate} required />
      </div>
      <p className="rounded-xl border border-sky-300/10 bg-sky-300/5 px-3 py-2.5 text-sm text-sky-100/80">Frecuencia mensual. Cada cuota suma capital prorrateado más el interés del capital original.</p>

      {preview.schedule && <ScheduleTable installments={preview.schedule.installments} today={todayISODate()} total={preview.schedule.totalAmount} />}
      {(error || (capital && preview.error)) && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error || preview.error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={syncing || !preview.schedule} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">{syncing ? "Guardando..." : "Guardar préstamo"}</button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5">Cancelar</button>
      </div>
    </form>
  );
}

function LoanDetail({ loan, client, today, syncing, pendingDelete, onBack, onAskDelete, onCancelDelete, onDelete, onCollect, onEdit }) {
  return (
    <article className="glass space-y-4 rounded-3xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{client ? clientName(client) : "Cliente eliminado"}</h2>
          <p className="mt-1 text-sm text-slate-400">{formatMoney(loan.capital)} al {loan.interestRate}% · saldo {formatMoney(outstandingBalance(loan, today))}</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300"><Pencil size={14} />Editar</button>
          <button type="button" onClick={onBack} className="text-sm font-medium text-slate-400 hover:text-white">Cerrar</button>
        </div>
      </div>
      <ScheduleTable installments={loan.installments ?? []} today={today} total={loan.totalAmount} syncing={syncing} onCollect={onCollect} />
      {pendingDelete ? (
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={onDelete} disabled={syncing} className="font-medium text-rose-700 disabled:opacity-60">Confirmar eliminación</button>
          <button type="button" onClick={onCancelDelete} className="text-slate-500">Cancelar</button>
        </div>
      ) : (
        <button type="button" onClick={onAskDelete} className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-rose-300"><Trash2 size={14} />Eliminar préstamo</button>
      )}
    </article>
  );
}

function ScheduleTable({ installments, today, total, syncing = false, onCollect }) {
  return (
    <div className="glass overflow-x-auto rounded-2xl p-3 sm:p-4">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">Cuota</th>
            <th className="py-2 pr-3 font-medium">Vence</th>
            <th className="py-2 pr-3 font-medium">Capital</th>
            <th className="py-2 pr-3 font-medium">Interés</th>
            <th className="py-2 pr-3 font-medium">Mora</th>
            <th className="py-2 pr-3 font-medium">Total</th>
            {onCollect && <th className="py-2 font-medium">Cobro</th>}
          </tr>
        </thead>
        <tbody>
          {installments.map((installment) => {
            const status = installmentStatus(installment, today);
            const lateFee = lateFeeForInstallment(installment, today);
            return (
              <tr key={installment.id ?? installment.number} className="border-t border-white/5 text-slate-300">
                <td className="py-2 pr-3">
                  {installment.number}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${status === "overdue" ? "bg-orange-400/10 text-orange-300" : status === "paid" ? "bg-emerald-400/10 text-emerald-200" : "bg-white/5 text-slate-400"}`}>{STATUS_LABEL[status]}</span>
                </td>
                <td className="py-2 pr-3">{formatDisplayDate(installment.dueDate)}</td>
                <td className="py-2 pr-3">{formatMoney(installment.capitalPart)}</td>
                <td className="py-2 pr-3">{formatMoney(installment.interestPart)}</td>
                <td className="py-2 pr-3">{formatMoney(lateFee)}</td>
                <td className="py-2 pr-3">{formatMoney(amountDue(installment, today))}</td>
                {onCollect && (
                  <td className="py-2">
                    <button type="button" disabled={syncing} onClick={() => onCollect(installment)} className="font-semibold text-emerald-300 transition hover:text-emerald-200 disabled:opacity-60">
                      {installment.status === "paid" ? "Pendiente" : "Cobrar"}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/10 font-semibold text-white">
            <td className="py-2" colSpan={onCollect ? 6 : 5}>Total pactado sin mora</td>
            <td className="py-2">{formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function TextField({ label, onChange, ...props }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-slate-300">{label}</span>
      <input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-slate-100 outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10" />
    </label>
  );
}
