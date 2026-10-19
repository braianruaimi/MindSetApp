import { clientName } from "./clients";
import { amountDue, installmentStatus } from "./loans";
import { roundMoney } from "../utils/money";

export function buildReport(database, today) {
  const loans = database.loans ?? [];
  const totals = {
    capitalLent: 0,
    projectedInterest: 0,
    collectedInterest: 0,
    collectedLateFees: 0,
    recoveredCapital: 0,
    cashCollected: 0,
    streetCapital: 0,
    streetMoney: 0,
    overdueCapital: 0,
    receivable: 0,
    pendingInterestDue: 0,
    overdueCount: 0,
    overdueAmount: 0,
  };

  const rows = loans.map((loan) => {
    const row = summarizeLoan(loan, today);
    totals.capitalLent += row.capital;
    totals.projectedInterest += row.projectedInterest;
    totals.collectedInterest += row.collectedInterest;
    totals.collectedLateFees += row.collectedLateFees;
    totals.recoveredCapital += row.recoveredCapital;
    totals.cashCollected += row.cashCollected;
    totals.streetCapital += row.streetCapital;
    totals.streetMoney += row.streetMoney;
    totals.overdueCapital += row.overdueCapital;
    totals.receivable += row.receivable;
    totals.pendingInterestDue += row.pendingInterestDue;
    totals.overdueCount += row.overdueCount;
    totals.overdueAmount += row.overdueAmount;
    const client = (database.clients ?? []).find((item) => item.id === loan.clientId);
    return { ...row, clientName: client ? clientName(client) : "Cliente eliminado" };
  });

  return {
    ...totals,
    realEarnings: totals.collectedInterest + totals.collectedLateFees,
    pendingInterest: Math.max(0, totals.projectedInterest - totals.collectedInterest),
    projectedEarnings: totals.projectedInterest,
    loanCount: loans.length,
    activeLoans: loans.filter((loan) => loan.status !== "paid").length,
    rows: rows.sort((a, b) => b.streetMoney - a.streetMoney),
  };
}

// Dinero en la calle = capital aún no recuperado; los intereses y la mora se cuentan aparte como ganancias.
// Compara el interés programado con el interés efectivamente cobrado; la mora no se mezcla con el interés.
export function monthlyProjection(database) {
  const months = new Map();
  for (const loan of database.loans ?? []) {
    for (const installment of loan.installments ?? []) {
      const key = installment.dueDate.slice(0, 7);
      const entry = months.get(key) ?? { key, projected: 0, real: 0 };
      entry.projected += roundMoney(installment.interestPart);
      if (installment.status === "paid") {
        entry.real += roundMoney(installment.interestPart);
      }
      months.set(key, entry);
    }
  }

  let projectedTotal = 0;
  let realTotal = 0;
  return [...months.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => {
      projectedTotal += entry.projected;
      realTotal += entry.real;
      const [year, month] = entry.key.split("-").map(Number);
      const label = new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
      return { month: label, proyectado: projectedTotal, real: realTotal };
    });
}

function summarizeLoan(loan, today) {
  const summary = {
    id: loan.id,
    capital: roundMoney(loan.capital),
    projectedInterest: roundMoney(loan.totalInterest),
    collectedInterest: 0,
    collectedLateFees: 0,
    recoveredCapital: 0,
    cashCollected: 0,
    streetCapital: 0,
    streetMoney: 0,
    overdueCapital: 0,
    receivable: 0,
    pendingInterestDue: 0,
    overdueCount: 0,
    overdueAmount: 0,
    status: loan.status ?? "active",
  };

  for (const installment of loan.installments ?? []) {
    if (installment.status === "paid") {
      summary.recoveredCapital += roundMoney(installment.capitalPart);
      summary.collectedInterest += roundMoney(installment.interestPart);
      summary.collectedLateFees += roundMoney(installment.lateFeeCharged);
      summary.cashCollected += roundMoney(installment.paidAmount);
      continue;
    }

    const due = amountDue(installment, today);
    summary.streetCapital += roundMoney(installment.capitalPart);
    summary.streetMoney += roundMoney(installment.capitalPart);
    summary.pendingInterestDue += roundMoney(installment.interestPart);
    summary.receivable += due;
    if (installmentStatus(installment, today) === "overdue") {
      summary.overdueCount += 1;
      summary.overdueCapital += roundMoney(installment.capitalPart);
      summary.overdueAmount += due;
    }
  }

  return summary;
}
