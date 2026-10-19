import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, CirclePlus, Landmark, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LoanEditor } from "../components/LoanEditor";
import { CollectionControls } from "../components/CollectionControls";
import { useAppState } from "../context/AppStateContext";
import { clientName } from "../services/clients";
import {
  LATE_FEE_PER_DAY,
  MAX_INSTALLMENTS,
  MIN_INSTALLMENTS,
  amountDue,
  buildScheduleFromInstallmentAmount,
  createLoan,
  installmentStatus,
  lateFeeForInstallment,
  outstandingBalance,
    registerCollection,
    setLateFee,
    removeLoan,
        updateLoan,
  } from "../services/loans";
import { addMonths, formatDisplayDate, todayISODate } from "../utils/dates";
import { formatMoney } from "../utils/money";

const CAPITAL_OPTIONS = [50_000, 100_000, 200_000, 300_000, 400_000, 500_000, 1_000_000];

const EMPTY_CLIENT = {
  firstName: "",
  lastName: "",
  phone: "",
  dni: "",
  address: "",
  email: "",
  instagram: "",
  notes: "",
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

  async function handleCollect(installment, options) {
    if (!selected) return;
    setError("");
    try {
      const collected = installment.status !== "paid";
      await commit(
        (current) => registerCollection(current, selected.id, installment.id, collected, today, options),
        collected ? "collect: cuota" : "revert: cuota",
      );
      toast.success(collected ? "Cobro registrado" : "Cobro revertido", { description: "Guardado en este dispositivo" });
    } catch (collectError) {
      setError(collectError.message);
      toast.error(collectError.message);
    }
  }

  async function handleLateFee(installment, amount) {
    if (!selected) return;
    setError("");
    try {
      await commit((current) => setLateFee(current, selected.id, installment.id, amount), "edit: mora");
      toast(amount === null ? "Mora automática restaurada" : "Mora eliminada");
    } catch (feeError) {
      setError(feeError.message);
      toast.error(feeError.message);
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
          <p className="mt-1 text-sm text-slate-400">Interés calculado según el monto total pactado · mora {formatMoney(LATE_FEE_PER_DAY)} por día.</p>
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
          onSetLateFee={handleLateFee}
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
                    <span className="mt-1 block text-sm text-slate-400">{formatMoney(loan.capital)} entregados · {loan.installmentCount} cuotas · total {formatMoney(loan.totalAmount)}</span>
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
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [startDate, setStartDate] = useState(todayISODate());
  const [firstDueDate, setFirstDueDate] = useState(() => addMonths(todayISODate(), 1));
  const [error, setError] = useState("");
  const selectedClient = clients.find((item) => item.id === clientId);

  const preview = useMemo(() => {
    try {
      return { schedule: buildScheduleFromInstallmentAmount({ capital, installmentAmount, installmentCount: Number(installmentCount), firstDueDate }), error: "" };
    } catch (previewError) {
      return { schedule: null, error: previewError.message };
    }
  }, [capital, installmentAmount, installmentCount, firstDueDate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({ clientMode, clientId, client, capital, installmentAmount, installmentCount: Number(installmentCount), startDate, firstDueDate });
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
                      <TextField label="Email" type="email" value={client.email} onChange={(value) => setClient((current) => ({ ...current, email: value }))} placeholder="correo@ejemplo.com" autoCapitalize="none" />
                      <TextField label="Instagram" value={client.instagram} onChange={(value) => setClient((current) => ({ ...current, instagram: value }))} placeholder="@usuario" autoCapitalize="none" />
                      <label className="block space-y-1.5 text-sm sm:col-span-2">
                        <span className="font-medium text-slate-300">Notas</span>
                        <textarea value={client.notes} onChange={(event) => setClient((current) => ({ ...current, notes: event.target.value }))} rows={3} className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-slate-100 outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10" />
                      </label>
                    </div>
                  )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-300">Capital entregado</span>
          <select value={capital} onChange={(event) => setCapital(event.target.value)} required className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-slate-100">
            <option value="">Seleccionar monto</option>
            {CAPITAL_OPTIONS.map((amount) => <option key={amount} value={amount}>{formatMoney(amount)}</option>)}
          </select>
        </label>
        <TextField label="Monto total a cobrar por cuota" value={installmentAmount} onChange={setInstallmentAmount} inputMode="numeric" required />
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-300">Cantidad de cuotas</span>
          <select value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-slate-100">
            {Array.from({ length: MAX_INSTALLMENTS - MIN_INSTALLMENTS + 1 }, (_, index) => {
              const count = index + MIN_INSTALLMENTS;
              return <option key={count} value={count}>{count}</option>;
            })}
          </select>
        </label>
        <TextField
          label="Fecha de inicio del préstamo"
          type="date"
          value={startDate}
          onChange={(value) => {
            if (!value) {
              setStartDate("");
              setFirstDueDate("");
              return;
            }
            setStartDate(value);
            setFirstDueDate(addMonths(value, 1));
          }}
          required
        />
        <TextField label="Fecha de pago de la primera cuota" type="date" value={firstDueDate} onChange={setFirstDueDate} required />
      </div>

      {preview.schedule && <ScheduleTable installments={preview.schedule.installments} today={todayISODate()} total={preview.schedule.totalAmount} />}
      {(error || (capital && installmentAmount && preview.error)) && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error || preview.error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={syncing || !preview.schedule} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">{syncing ? "Guardando..." : "Guardar préstamo"}</button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5">Cancelar</button>
      </div>
    </form>
  );
}

function LoanDetail({ loan, client, today, syncing, pendingDelete, onBack, onAskDelete, onCancelDelete, onDelete, onCollect, onSetLateFee, onEdit }) {
  return (
    <article className="glass space-y-4 rounded-3xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">{client ? clientName(client) : "Cliente eliminado"}</h2>
          <p className="mt-1 text-sm text-slate-400">Saldo pendiente <span className="font-semibold text-white">{formatMoney(outstandingBalance(loan, today))}</span></p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300"><Pencil size={14} />Editar</button>
          <button type="button" onClick={onBack} className="text-sm font-medium text-slate-400 hover:text-white">Cerrar</button>
        </div>
      </div>
      <ScheduleTable installments={loan.installments ?? []} today={today} total={loan.totalAmount} syncing={syncing} onCollect={onCollect} onSetLateFee={onSetLateFee} />
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

function ScheduleTable({ installments, today, total, syncing = false, onCollect, onSetLateFee }) {
  const capital = installments.reduce((sum, installment) => sum + Number(installment.capitalPart || 0), 0);
  const agreedTotal = total ?? installments.reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
  const returnAmount = agreedTotal - capital;
  const returnRate = capital > 0 ? (returnAmount / capital) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <SummaryMetric label="Capital entregado" value={formatMoney(capital)} />
        <div className="rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-400/10 to-teal-400/[0.03] p-3 shadow-lg shadow-emerald-950/10 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200/70">Retorno total</p>
          <p className="mt-1 text-base font-semibold text-emerald-200 sm:text-lg">{formatMoney(returnAmount)}</p>
          <p className="mt-0.5 text-xs text-emerald-300">{returnRate > 0 ? "+" : ""}{formatPercentage(returnRate)}% sobre el capital</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-sky-300/15 bg-gradient-to-br from-sky-400/10 to-indigo-400/[0.03] p-3 shadow-lg shadow-sky-950/10 sm:col-span-1 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200/70">Total pactado</p>
          <p className="mt-1 text-base font-semibold text-white sm:text-lg">{formatMoney(agreedTotal)}</p>
          <p className="mt-0.5 text-xs text-sky-200/70">Sin incluir mora</p>
        </div>
      </div>

      <div className="space-y-3">
        {installments.map((installment) => {
          const status = installmentStatus(installment, today);
          const lateFee = lateFeeForInstallment(installment, today);
          const statusStyles = status === "overdue"
            ? "border-orange-300/20 bg-orange-400/10 text-orange-200"
            : status === "paid"
              ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
              : "border-white/10 bg-white/5 text-slate-300";
          const accentStyles = status === "overdue"
            ? "border-l-orange-400"
            : status === "paid"
              ? "border-l-emerald-400"
              : "border-l-sky-400";

          return (
            <article key={installment.id ?? installment.number} className={`rounded-2xl border border-white/[0.07] border-l-2 ${accentStyles} bg-gradient-to-br from-white/[0.045] to-white/[0.015] p-3.5 shadow-lg shadow-slate-950/10 sm:p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Cuota {String(installment.number).padStart(2, "0")}{installments.length ? ` / ${String(installments.length).padStart(2, "0")}` : ""}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-200"><CalendarDays size={14} className="text-slate-500" />{formatDisplayDate(installment.dueDate)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusStyles}`}>{STATUS_LABEL[status]}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <InstallmentMetric label="Capital" value={formatMoney(installment.capitalPart)} />
                <InstallmentMetric label="Interés" value={formatMoney(installment.interestPart)} />
                <InstallmentMetric label="Mora" value={formatMoney(lateFee)} tone={lateFee > 0 ? "warning" : undefined} />
                <InstallmentMetric label="Total cuota" value={formatMoney(amountDue(installment, today))} tone="bright" />
              </div>

              {onCollect && (
                <CollectionControls
                  installment={installment}
                  today={today}
                  disabled={syncing}
                  onCollect={(options) => onCollect(installment, options)}
                  onRevert={() => onCollect(installment)}
                  onSetLateFee={onSetLateFee ? (amount) => onSetLateFee(installment, amount) : undefined}
                />
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-slate-950/30 p-3 sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-white sm:text-lg">{value}</p>
    </div>
  );
}

function InstallmentMetric({ label, value, tone }) {
  const valueStyles = tone === "warning" ? "text-orange-300" : tone === "bright" ? "text-white" : "text-slate-200";
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.05] bg-slate-950/30 px-2.5 py-2">
      <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-xs font-semibold sm:text-sm ${valueStyles}`}>{value}</p>
    </div>
  );
}

function formatPercentage(value) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

function TextField({ label, onChange, ...props }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-slate-300">{label}</span>
      <input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-slate-100 outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10" />
    </label>
  );
}
