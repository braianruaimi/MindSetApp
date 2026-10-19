import { useState } from "react";
import { installmentStatus, lateFeeForInstallment } from "../services/loans";
import { formatDisplayDate } from "../utils/dates";
import { formatMoney } from "../utils/money";

const STATUS_LABEL = { paid: "Cobrado", pending: "Pendiente", overdue: "Atrasado" };

export function CollectionControls({ installment, today, disabled, onCollect, onRevert, onSetLateFee }) {
  const [open, setOpen] = useState(false);
  const [paidDate, setPaidDate] = useState(today);
  const [lateText, setLateText] = useState(null);
  const status = installmentStatus(installment, today);
  const validDate = Boolean(paidDate) && paidDate <= today;
  const autoFee = validDate ? lateFeeForInstallment({ ...installment, status: "pending" }, paidDate) : 0;
  const feeText = lateText ?? String(autoFee);
  const fee = Number(feeText.replace(",", "."));
  const validFee = feeText.trim() !== "" && Number.isFinite(fee) && fee >= 0;
  const hasManualFee = installment.lateFeeOverride !== null && installment.lateFeeOverride !== undefined;
  const currentFee = lateFeeForInstallment(installment, today);
  const tone = status === "paid" ? "bg-emerald-400/10 text-emerald-200" : status === "overdue" ? "bg-orange-400/10 text-orange-300" : "bg-white/5 text-slate-300";

  function close() {
    setOpen(false);
    setPaidDate(today);
    setLateText(null);
  }

  async function confirm() {
    await onCollect({ paidDate, lateFee: fee });
    close();
  }

  if (status === "paid") {
    return (
      <div className={`mt-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm ${tone}`}>
        <span className="font-medium">{STATUS_LABEL[status]}{installment.paidDate ? ` · ${formatDisplayDate(installment.paidDate)}` : ""}</span>
        <button type="button" disabled={disabled} onClick={onRevert} className="text-xs text-slate-300 underline-offset-2 hover:underline disabled:opacity-50">Marcar como pendiente</button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm ${tone}`}>
        <span className="font-medium">{STATUS_LABEL[status]}</span>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {onSetLateFee && currentFee > 0 && (
            <button type="button" disabled={disabled} onClick={() => onSetLateFee(0)} className="font-medium text-rose-300 hover:underline disabled:opacity-50">Quitar mora</button>
          )}
          {onSetLateFee && hasManualFee && (
            <button type="button" disabled={disabled} onClick={() => onSetLateFee(null)} className="text-slate-300 hover:underline disabled:opacity-50">Mora automática</button>
          )}
          {!open && <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="rounded-lg bg-emerald-400/15 px-3 py-1.5 font-semibold text-emerald-200 disabled:opacity-50">Registrar cobro</button>}
        </div>
      </div>
      {open && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <label className="block text-xs text-slate-400">Fecha en que se abonó
            <input type="date" value={paidDate} max={today} onChange={(event) => { setPaidDate(event.target.value); setLateText(null); }} className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm" />
          </label>
          <label className="block text-xs text-slate-400">Mora a cobrar (0 = sin mora)
            <input type="text" inputMode="decimal" value={feeText} onChange={(event) => setLateText(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm" />
          </label>
          <p className="text-xs text-slate-500">
            Se registra como cobrado el {validDate ? formatDisplayDate(paidDate) : "—"} y suma al total cobrado: {validFee ? formatMoney((Number(installment.amount) || 0) + fee) : "—"}.
          </p>
          <div className="flex gap-4 text-sm">
            <button type="button" disabled={disabled || !validDate || !validFee} onClick={confirm} className="font-semibold text-emerald-300 disabled:opacity-50">Confirmar cobro</button>
            <button type="button" onClick={close} className="text-slate-400">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
