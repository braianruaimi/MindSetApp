import { clientName } from "./clients";
import { MAX_AUDIT_ENTRIES } from "./storage";
import { formatMoney } from "../utils/money";

export function recordMutation(previous, next, action = "cambio") {
  const entries = [
    ...changedClients(previous, next, action),
    ...changedLoans(previous, next, action),
  ];
  return {
    ...next,
    auditLog: [...(previous.auditLog ?? []), ...entries].slice(-MAX_AUDIT_ENTRIES),
  };
}

export function recordRestore(previous, restored, action) {
  const imported = restored.auditLog ?? [];
  const existing = previous.auditLog ?? [];
  const merged = [...new Map([...imported, ...existing].map((entry) => [entry.id, entry])).values()];
  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    action,
    entity: "database",
    entityId: null,
    label: "Base de datos restaurada",
    detail: `${previous.clients.length} clientes y ${previous.loans.length} préstamos antes · ${restored.clients.length} clientes y ${restored.loans.length} préstamos después`,
  };
  return {
    ...restored,
    auditLog: [...merged, entry].slice(-MAX_AUDIT_ENTRIES),
  };
}

function changedClients(previous, next, action) {
  const before = new Map((previous.clients ?? []).map((client) => [client.id, client]));
  const after = new Map((next.clients ?? []).map((client) => [client.id, client]));
  const entries = [];

  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const oldClient = before.get(id);
    const newClient = after.get(id);
    if (JSON.stringify(oldClient) === JSON.stringify(newClient)) continue;
    entries.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      action,
      entity: "client",
      entityId: id,
      label: clientName(newClient ?? oldClient) || "Cliente",
      detail: oldClient && newClient ? "Datos del cliente modificados" : oldClient ? "Cliente eliminado" : "Cliente creado",
    });
  }
  return entries;
}

function changedLoans(previous, next, action) {
  const before = new Map((previous.loans ?? []).map((loan) => [loan.id, loan]));
  const after = new Map((next.loans ?? []).map((loan) => [loan.id, loan]));
  const entries = [];

  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const oldLoan = before.get(id);
    const newLoan = after.get(id);
    if (JSON.stringify(oldLoan) === JSON.stringify(newLoan)) continue;
    const loan = newLoan ?? oldLoan;
    const client = (next.clients ?? previous.clients ?? []).find((item) => item.id === loan.clientId);
    const changedInstallmentIds = getChangedInstallmentIds(oldLoan, newLoan);
    const isCollection = action === "collect: cuota" || action === "revert: cuota";
    entries.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      action,
      entity: "loan",
      entityId: id,
      label: client ? `Préstamo · ${clientName(client)}` : "Préstamo",
      detail: loanDetail(oldLoan, newLoan, action),
      before: oldLoan ? auditLoanSnapshot(oldLoan, isCollection ? changedInstallmentIds : null) : null,
      after: newLoan ? auditLoanSnapshot(newLoan, isCollection ? changedInstallmentIds : null) : null,
    });
  }
  return entries;
}

function getChangedInstallmentIds(before, after) {
  const oldInstallments = new Map((before?.installments ?? []).map((installment) => [installment.id, installment]));
  const newInstallments = new Map((after?.installments ?? []).map((installment) => [installment.id, installment]));
  return [...new Set([...oldInstallments.keys(), ...newInstallments.keys()])]
    .filter((id) => JSON.stringify(oldInstallments.get(id)) !== JSON.stringify(newInstallments.get(id)));
}

function auditLoanSnapshot(loan, installmentIds) {
  const installments = loan.installments ?? [];
  return {
    id: loan.id,
    clientId: loan.clientId,
    capital: loan.capital,
    interestRate: loan.interestRate,
    installmentCount: loan.installmentCount,
    installments: installmentIds
      ? installments.filter((installment) => installmentIds.includes(installment.id))
      : installments,
  };
}

function loanDetail(before, after, action) {
  if (!before) return `Capital ${formatMoney(after.capital)} · ${after.installmentCount} cuotas`;
  if (!after) {
    const paidCount = (before.installments ?? []).filter((installment) => installment.status === "paid").length;
    return `Eliminado · capital ${formatMoney(before.capital)} · ${paidCount} cuotas cobradas`;
  }

  const oldInstallments = new Map((before.installments ?? []).map((installment) => [installment.id, installment]));
  const newInstallments = new Map((after.installments ?? []).map((installment) => [installment.id, installment]));
  const changed = [...new Set([...oldInstallments.keys(), ...newInstallments.keys()])]
    .map((id) => ({ before: oldInstallments.get(id), after: newInstallments.get(id) }))
    .filter((entry) => JSON.stringify(entry.before) !== JSON.stringify(entry.after));

  if (action === "edit: mora") {
    const installment = changed[0]?.after;
    if (installment) {
      const fee = installment.lateFeeOverride;
      return `Cuota ${installment.number} · ${fee === null || fee === undefined ? "mora automática restaurada" : fee === 0 ? "mora eliminada" : `mora ${formatMoney(fee)}`}`;
    }
  }
  if (action === "collect: cuota" || action === "revert: cuota") {
    const installment = changed[0]?.after ?? changed[0]?.before;
    if (installment) {
      const amount = installment.paidAmount ?? installment.amount;
      const when = action === "collect: cuota" && installment.paidDate ? ` · pagada el ${installment.paidDate}` : "";
      return `${action === "collect: cuota" ? "Cobrado" : "Revertido"} · cuota ${installment.number} · ${formatMoney(amount)}${when}`;
    }
  }
  if (before.capital !== after.capital) {
    return `Capital ${formatMoney(before.capital)} → ${formatMoney(after.capital)} · ${changed.length} cuotas modificadas`;
  }
  return `${changed.length} cuotas modificadas · tasa ${before.interestRate}% → ${after.interestRate}%`;
}
