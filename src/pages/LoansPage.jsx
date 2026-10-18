import { useMemo, useState } from "react";
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
    } catch (collectError) {
      setError(collectError.message);
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
          <h1 className="text-2xl font-semibold text-slate-900">Préstamos</h1>
          <p className="mt-1 text-sm text-slate-600">Tasa mensual sobre el capital. Mora: {formatMoney(LATE_FEE_PER_DAY)} por día.</p>
        </div>
        <button type="button" onClick={() => { setError(""); setCreating(true); setEditing(false); setSelectedId(""); }} disabled={!preview.schedule} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">
          Nuevo
        </button>
      </header>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
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
            <li key={loan.id}>
              <button type="button" onClick={() => { setSelectedId(loan.id); setCreating(false); setEditing(false); }} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block font-medium text-slate-900">{client ? clientName(client) : "Cliente eliminado"}</span>
                    <span className="mt-1 block text-sm text-slate-600">{formatMoney(loan.capital)} · {loan.installmentCount} cuotas · {loan.interestRate}%</span>
                  </span>
                  <span className="text-sm font-medium text-slate-900">{formatMoney(outstandingBalance(loan, today))}</span>
                </span>
                <span className="mt-2 block text-sm text-slate-500">
                  {nextDue ? `Próximo vencimiento ${formatDisplayDate(nextDue.dueDate)}` : "Todas las cuotas cobradas"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {loans.length === 0 && !creating && <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Todavía no hay préstamos.</p>}
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-medium text-slate-900">Nuevo préstamo</h2>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm">
        <button type="button" onClick={() => setClientMode("existing")} disabled={!clients.length} className={`rounded-lg px-3 py-2 ${clientMode === "existing" ? "bg-white font-medium text-slate-900" : "text-slate-500"}`}>Existente</button>
        <button type="button" onClick={() => setClientMode("new")} className={`rounded-lg px-3 py-2 ${clientMode === "new" ? "bg-white font-medium text-slate-900" : "text-slate-500"}`}>Nuevo cliente</button>
      </div>

      {clientMode === "existing" ? (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">Cliente</span>
          <select value={clientId} onChange={(event) => setClientId(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5">
            {clients.map((item) => <option key={item.id} value={item.id}>{clientName(item)} · {item.dni}</option>)}
          </select>
          {selectedClient && <span className="block text-slate-500">{selectedClient.phone} · {selectedClient.address}</span>}
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
          <span className="font-medium text-slate-700">Cuotas</span>
          <select value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5">
            {Array.from({ length: MAX_INSTALLMENTS - MIN_INSTALLMENTS + 1 }, (_, index) => {
              const count = index + MIN_INSTALLMENTS;
              return <option key={count} value={count}>{count}</option>;
            })}
          </select>
        </label>
        <TextField label="Primera cuota" type="date" value={firstDueDate} onChange={setFirstDueDate} required />
      </div>
      <p className="text-sm text-slate-500">Frecuencia mensual. Cada cuota suma capital prorrateado más el interés del capital original.</p>

      {preview.schedule && <ScheduleTable installments={preview.schedule.installments} today={todayISODate()} total={preview.schedule.totalAmount} />}
      {(error || (capital && preview.error)) && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error || preview.error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={syncing || !preview.schedule} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">{syncing ? "Guardando..." : "Guardar préstamo"}</button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700">Cancelar</button>
      </div>
    </form>
  );
}

function LoanDetail({ loan, client, today, syncing, pendingDelete, onBack, onAskDelete, onCancelDelete, onDelete, onCollect, onEdit }) {
  return (
    <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-900">{client ? clientName(client) : "Cliente eliminado"}</h2>
          <p className="mt-1 text-sm text-slate-600">{formatMoney(loan.capital)} al {loan.interestRate}% · saldo {formatMoney(outstandingBalance(loan, today))}</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onEdit} className="text-sm font-medium text-teal-800">Editar</button>
          <button type="button" onClick={onBack} className="text-sm font-medium text-slate-500">Cerrar</button>
        </div>
      </div>
      <ScheduleTable installments={loan.installments ?? []} today={today} total={loan.totalAmount} syncing={syncing} onCollect={onCollect} />
      {pendingDelete ? (
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={onDelete} disabled={syncing} className="font-medium text-rose-700 disabled:opacity-60">Confirmar eliminación</button>
          <button type="button" onClick={onCancelDelete} className="text-slate-500">Cancelar</button>
        </div>
      ) : (
        <button type="button" onClick={onAskDelete} className="text-sm text-slate-500">Eliminar préstamo</button>
      )}
    </article>
  );
}

function ScheduleTable({ installments, today, total, syncing = false, onCollect }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-slate-500">
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
              <tr key={installment.id ?? installment.number} className="border-t border-slate-100">
                <td className="py-2 pr-3">
                  {installment.number}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${status === "overdue" ? "bg-rose-50 text-rose-700" : status === "paid" ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-600"}`}>{STATUS_LABEL[status]}</span>
                </td>
                <td className="py-2 pr-3">{formatDisplayDate(installment.dueDate)}</td>
                <td className="py-2 pr-3">{formatMoney(installment.capitalPart)}</td>
                <td className="py-2 pr-3">{formatMoney(installment.interestPart)}</td>
                <td className="py-2 pr-3">{formatMoney(lateFee)}</td>
                <td className="py-2 pr-3">{formatMoney(amountDue(installment, today))}</td>
                {onCollect && (
                  <td className="py-2">
                    <button type="button" disabled={syncing} onClick={() => onCollect(installment)} className="font-medium text-teal-800 disabled:opacity-60">
                      {installment.status === "paid" ? "Pendiente" : "Cobrar"}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 font-medium">
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
      <span className="font-medium text-slate-700">{label}</span>
      <input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none ring-teal-700 focus:ring-2" />
    </label>
  );
}

