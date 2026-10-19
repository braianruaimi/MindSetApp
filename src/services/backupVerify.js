import { decryptBackupText } from "./backupCrypto";
import { normalizeDatabase } from "./storage";

export const BACKUP_REMINDER_DAYS = 7;

export function inspectBackup(state) {
  const clients = state.clients ?? [];
  const loans = state.loans ?? [];
  const installments = loans.flatMap((loan) => loan.installments ?? []);
  const clientIds = new Set(clients.map((client) => client.id));
  const issues = [];

  const orphanLoans = loans.filter((loan) => !clientIds.has(loan.clientId)).length;
  if (orphanLoans > 0) issues.push(`${orphanLoans} préstamo(s) apuntan a un cliente que no está en el archivo.`);
  if (new Set(clients.map((client) => client.id)).size !== clients.length) issues.push("Hay clientes con identificador repetido.");
  if (new Set(loans.map((loan) => loan.id)).size !== loans.length) issues.push("Hay préstamos con identificador repetido.");
  const emptyLoans = loans.filter((loan) => (loan.installments ?? []).length === 0).length;
  if (emptyLoans > 0) issues.push(`${emptyLoans} préstamo(s) no tienen cuotas.`);

  return {
    clients: clients.length,
    loans: loans.length,
    installments: installments.length,
    paid: installments.filter((installment) => installment.status === "paid").length,
    pending: installments.filter((installment) => installment.status !== "paid").length,
    auditEntries: (state.auditLog ?? []).length,
    issues,
  };
}

export function compareBackup(current, incoming) {
  const now = inspectBackup(current);
  const next = inspectBackup(incoming);
  return {
    current: now,
    incoming: next,
    clientsDelta: next.clients - now.clients,
    loansDelta: next.loans - now.loans,
    paidDelta: next.paid - now.paid,
  };
}

function stableSignature(state) {
  return JSON.stringify(normalizeDatabase(state));
}

// Descifra el archivo recién generado y confirma que contiene exactamente los datos actuales.
export async function verifyBackupText(text, secret, expectedState) {
  let restored;
  try {
    restored = await decryptBackupText(text, secret);
  } catch {
    throw new Error("El respaldo generado no se pudo volver a abrir; no se descargó.");
  }
  if (stableSignature(restored) !== stableSignature(expectedState)) {
    throw new Error("El respaldo generado no coincide con tus datos actuales; no se descargó.");
  }
  return inspectBackup(restored);
}

export function daysSince(isoTimestamp, now = new Date()) {
  if (!isoTimestamp) return null;
  const time = new Date(isoTimestamp).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / 86_400_000));
}

export function backupReminder(lastExportAt, hasData, now = new Date()) {
  if (!hasData) return null;
  const days = daysSince(lastExportAt, now);
  if (days === null) return "Todavía no descargaste ningún respaldo.";
  if (days >= BACKUP_REMINDER_DAYS) return `Hace ${days} días que no descargas un respaldo.`;
  return null;
}
