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
    totals.overdueCount += row.overdueCount;
    totals.overdueAmount += row.overdueAmount;
    const client = (database.clients ?? []).find((item) => item.id === loan.clientId);
    return { ...row, clientName: client ? clientName(client) : "Cliente eliminado" };
  });

  return {
    ...totals,
    realEarnings: totals.collectedInterest + totals.collectedLateFees,
    pendingInterest: Math.max(0, totals.projectedInterest - totals.collectedInterest),
    loanCount: loans.length,
    activeLoans: loans.filter((loan) => loan.status !== "paid").length,
    rows: rows.sort((a, b) => b.streetMoney - a.streetMoney),
  };
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
    summary.streetMoney += due;
    if (installmentStatus(installment, today) === "overdue") {
      summary.overdueCount += 1;
      summary.overdueAmount += due;
    }
  }

  return summary;
}
