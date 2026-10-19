import { amountDue, collectionDateForInstallment, installmentStatus } from "./loans";

export const EMPTY_FILTERS = { clientId: "", status: "", from: "", to: "" };

export function hasActiveFilters(filters) {
  return Boolean(filters.clientId || filters.status || filters.from || filters.to);
}

// Filtra por cliente, estado (paid/pending/overdue) y rango de fechas de cobro (fecha real si ya se cobró, si no el vencimiento).
export function filterEntries(entries, filters, today) {
  return entries
    .filter(({ loan, installment }) => {
      if (filters.clientId && loan.clientId !== filters.clientId) return false;
      if (filters.status && installmentStatus(installment, today) !== filters.status) return false;
      const date = collectionDateForInstallment(installment);
      if (filters.from && date < filters.from) return false;
      if (filters.to && date > filters.to) return false;
      return true;
    })
    .sort((a, b) => collectionDateForInstallment(a.installment).localeCompare(collectionDateForInstallment(b.installment)));
}

export function summarizeEntries(entries, today) {
  const summary = { count: entries.length, collected: 0, collectedCount: 0, toCollect: 0, toCollectCount: 0, overdue: 0, overdueCount: 0 };
  for (const { installment } of entries) {
    const status = installmentStatus(installment, today);
    if (status === "paid") {
      summary.collectedCount += 1;
      summary.collected += Number(installment.paidAmount) || 0;
      continue;
    }
    const due = amountDue(installment, today);
    summary.toCollectCount += 1;
    summary.toCollect += due;
    if (status === "overdue") {
      summary.overdueCount += 1;
      summary.overdue += due;
    }
  }
  return summary;
}
