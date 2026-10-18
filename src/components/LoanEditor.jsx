import { useState } from "react";
import { clientName } from "../services/clients";
import { MAX_INSTALLMENTS, MIN_INSTALLMENTS, buildSchedule } from "../services/loans";
import { addMonths, todayISODate } from "../utils/dates";

export function LoanEditor({ loan, clients, syncing, onCancel, onSubmit }) {
  const [clientId, setClientId] = useState(loan.clientId);
  const [capital, setCapital] = useState(String(loan.capital ?? ""));
  const [interestRate, setInterestRate] = useState(String(loan.interestRate ?? ""));
  const [installmentCount, setInstallmentCount] = useState(String(loan.installmentCount ?? loan.installments?.length ?? 1));
  const [firstDueDate, setFirstDueDate] = useState(loan.firstDueDate || loan.installments?.[0]?.dueDate || todayISODate());
  const [installments, setInstallments] = useState(() => (loan.installments ?? []).map(toFormInstallment));
  const [keepPayments, setKeepPayments] = useState(true);
  const [error, setError] = useState("");

  function updateInstallment(index, field, value) {
    setInstallments((current) => current.map((installment, itemIndex) => {
      if (itemIndex !== index) return installment;
      const next = { ...installment, [field]: value };
      if (field === "capitalPart" || field === "interestPart") {
        next.amount = String(Number(field === "capitalPart" ? value : next.capitalPart) + Number(field === "interestPart" ? value : next.interestPart) || 0);
      }
      return next;
    }));
  }

  function recalculate() {
    setError("");
    try {
      const schedule = buildSchedule({ capital, interestRate, installmentCount: Number(installmentCount), firstDueDate });
      setInstallments(schedule.installments.map((installment) => {
        const previous = installments.find((item) => Number(item.number) === installment.number);
        if (!keepPayments || !previous) return toFormInstallment(installment);
        return {
          ...toFormInstallment(installment),
          id: previous.id,
          status: previous.status,
          paidAt: previous.paidAt,
          paidAmount: previous.paidAmount,
          lateFeeCharged: previous.lateFeeCharged,
          lateFeeOverride: previous.lateFeeOverride,
        };
      }));
    } catch (recalculateError) {
      setError(recalculateError.message);
    }
  }

  function addInstallment() {
    if (installments.length >= MAX_INSTALLMENTS) return;
    const last = installments.at(-1);
    setInstallments((current) => [...current, toFormInstallment({
      number: current.length + 1,
      dueDate: last ? addMonths(last.dueDate, 1) : firstDueDate,
      capitalPart: 0,
      interestPart: 0,
      amount: 0,
    })]);
    setInstallmentCount(String(installments.length + 1));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({ clientId, capital, interestRate, installments });
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-slate-900">Editar préstamo</h2>
        <button type="button" onClick={onCancel} className="text-sm font-medium text-teal-800">Cerrar</button>
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-slate-700">Cliente</span>
        <select value={clientId} onChange={(event) => setClientId(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5">
          {clients.map((client) => <option key={client.id} value={client.id}>{clientName(client)} · {client.dni}</option>)}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <EditorField label="Capital" value={capital} onChange={setCapital} inputMode="decimal" />
        <EditorField label="Tasa mensual %" value={interestRate} onChange={setInterestRate} inputMode="decimal" />
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">Cuotas al recalcular</span>
          <select value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5">
            {Array.from({ length: MAX_INSTALLMENTS - MIN_INSTALLMENTS + 1 }, (_, index) => {
              const count = index + MIN_INSTALLMENTS;
              return <option key={count} value={count}>{count}</option>;
            })}
          </select>
        </label>
        <EditorField label="Primera cuota" type="date" value={firstDueDate} onChange={setFirstDueDate} />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={keepPayments} onChange={(event) => setKeepPayments(event.target.checked)} className="h-4 w-4 accent-teal-700" />
        Conservar cobros al recalcular
      </label>
      <button type="button" onClick={recalculate} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700">Recalcular cuotas</button>

      <div className="space-y-3">
        {installments.map((installment, index) => (
          <fieldset key={installment.id || index} className="space-y-3 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-medium text-slate-800">Cuota {index + 1}</legend>
              {installments.length > 1 && (
                <button type="button" onClick={() => setInstallments((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-sm text-slate-500">Quitar</button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <EditorField label="Vencimiento" type="date" value={installment.dueDate} onChange={(value) => updateInstallment(index, "dueDate", value)} />
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-slate-700">Estado</span>
                <select value={installment.status} onChange={(event) => updateInstallment(index, "status", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5">
                  <option value="pending">Pendiente</option>
                  <option value="paid">Cobrado</option>
                </select>
              </label>
              <EditorField label="Capital" value={installment.capitalPart} onChange={(value) => updateInstallment(index, "capitalPart", value)} inputMode="decimal" />
              <EditorField label="Interés" value={installment.interestPart} onChange={(value) => updateInstallment(index, "interestPart", value)} inputMode="decimal" />
              <EditorField label="Importe de cuota" value={installment.amount} onChange={(value) => updateInstallment(index, "amount", value)} inputMode="decimal" />
              {installment.status === "paid" ? (
                <>
                  <EditorField label="Mora cobrada" value={installment.lateFeeCharged} onChange={(value) => updateInstallment(index, "lateFeeCharged", value)} inputMode="decimal" />
                  <EditorField label="Total cobrado" value={installment.paidAmount} onChange={(value) => updateInstallment(index, "paidAmount", value)} inputMode="decimal" />
                </>
              ) : (
                <EditorField label="Mora manual" value={installment.lateFeeOverride} onChange={(value) => updateInstallment(index, "lateFeeOverride", value)} inputMode="decimal" placeholder="Vacío = automática" />
              )}
            </div>
          </fieldset>
        ))}
      </div>
      {installments.length < MAX_INSTALLMENTS && (
        <button type="button" onClick={addInstallment} className="text-sm font-medium text-teal-800">Agregar cuota</button>
      )}
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <button type="submit" disabled={syncing} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">{syncing ? "Guardando..." : "Guardar cambios"}</button>
    </form>
  );
}

function toFormInstallment(installment) {
  return {
    id: installment.id ?? crypto.randomUUID(),
    number: installment.number,
    dueDate: installment.dueDate ?? todayISODate(),
    capitalPart: String(installment.capitalPart ?? 0),
    interestPart: String(installment.interestPart ?? 0),
    amount: String(installment.amount ?? 0),
    status: installment.status === "paid" ? "paid" : "pending",
    paidAt: installment.paidAt ?? "",
    paidAmount: installment.paidAmount ?? "",
    lateFeeCharged: installment.lateFeeCharged ?? 0,
    lateFeeOverride: installment.lateFeeOverride ?? "",
  };
}

function EditorField({ label, onChange, ...props }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-teal-700 focus:ring-2" />
    </label>
  );
}
