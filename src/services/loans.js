import { saveClient } from "./clients";
import { addMonths, daysAfter, formatISODate, parseISODate, todayISODate } from "../utils/dates";
import { parseRate, roundMoney } from "../utils/money";

export const LATE_FEE_PER_DAY = 10_000;
export const MIN_INSTALLMENTS = 1;
export const MAX_INSTALLMENTS = 6;

export function buildSchedule(input) {
  const capital = roundMoney(input.capital);
  const interestRate = parseRate(input.interestRate);
  const installmentCount = Number(input.installmentCount);
  const firstDueDate = String(input.firstDueDate ?? "");

  if (!Number.isFinite(capital) || capital <= 0) {
    throw new Error("El capital debe ser mayor a cero.");
  }
  if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 1000) {
    throw new Error("La tasa mensual debe estar entre 0 y 1000.");
  }
  if (!Number.isInteger(installmentCount) || installmentCount < MIN_INSTALLMENTS || installmentCount > MAX_INSTALLMENTS) {
    throw new Error("La cantidad de cuotas debe ser de 1 a 6.");
  }
  if (!parseISODate(firstDueDate)) {
    throw new Error("La fecha de la primera cuota no es válida.");
  }

  const monthlyInterest = roundMoney(capital * (interestRate / 100));
  const capitalBase = Math.floor(capital / installmentCount);
  const capitalRemainder = capital - capitalBase * installmentCount;
  const installments = Array.from({ length: installmentCount }, (_, index) => {
    const capitalPart = capitalBase + (index === installmentCount - 1 ? capitalRemainder : 0);
    const amount = capitalPart + monthlyInterest;
    return {
      id: crypto.randomUUID(),
      number: index + 1,
      dueDate: addMonths(firstDueDate, index),
      capitalPart,
      interestPart: monthlyInterest,
      amount,
      status: "pending",
      paidAt: null,
      paidAmount: null,
      lateFeeCharged: 0,
    };
  });
  const totalInterest = monthlyInterest * installmentCount;
  const totalAmount = installments.reduce((sum, installment) => sum + installment.amount, 0);

  return {
    capital,
    interestRate,
    frequency: "monthly",
    installmentCount,
    firstDueDate,
    installmentAmount: installments[0].amount,
    totalInterest,
    totalAmount,
    installments,
  };
}

export function buildScheduleFromTotal(input) {
  const capital = roundMoney(input.capital);
  const totalAmount = roundMoney(input.totalAmount);
  const installmentCount = Number(input.installmentCount);

  if (totalAmount < capital) {
    throw new Error("El monto a cobrar debe ser igual o mayor al capital entregado.");
  }

  const totalInterest = totalAmount - capital;
  const interestRate = capital > 0 && installmentCount > 0
    ? (totalInterest / installmentCount / capital) * 100
    : 0;
  const schedule = buildSchedule({ ...input, interestRate });
  const interestBase = Math.floor(totalInterest / installmentCount);
  const interestRemainder = totalInterest - interestBase * installmentCount;
  const installments = schedule.installments.map((installment, index) => {
    const interestPart = interestBase + (index === installmentCount - 1 ? interestRemainder : 0);
    return {
      ...installment,
      interestPart,
      amount: installment.capitalPart + interestPart,
    };
  });

  return {
    ...schedule,
    totalInterest,
    totalAmount,
    installments,
  };
}

export function buildScheduleFromInstallmentAmount(input) {
  const installmentAmount = roundMoney(input.installmentAmount);
  const installmentCount = Number(input.installmentCount);
  if (installmentAmount <= 0) {
    throw new Error("El monto a cobrar por cuota debe ser mayor a cero.");
  }

  const schedule = buildScheduleFromTotal({ ...input, totalAmount: installmentAmount * installmentCount });
  return {
    ...schedule,
    installmentAmount,
    installments: schedule.installments.map((installment) => ({
      ...installment,
      interestPart: installmentAmount - installment.capitalPart,
      amount: installmentAmount,
    })),
  };
}

export function createLoan(database, input) {
  let nextDatabase = database;
  let clientId = String(input.clientId ?? "");

  if (input.clientMode === "new") {
    nextDatabase = saveClient(database, input.client);
    clientId = nextDatabase.clients[0]?.id ?? "";
  }

  if (!clientId || !(nextDatabase.clients ?? []).some((client) => client.id === clientId)) {
    throw new Error("Selecciona un cliente existente o carga uno nuevo.");
  }

  const now = new Date().toISOString();
  const loan = {
    id: crypto.randomUUID(),
    clientId,
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...(input.installmentAmount !== undefined
      ? buildScheduleFromInstallmentAmount(input)
      : input.totalAmount !== undefined ? buildScheduleFromTotal(input) : buildSchedule(input)),
    startDate: input.startDate || input.firstDueDate,
  };

  return {
    ...nextDatabase,
    loans: [loan, ...(nextDatabase.loans ?? [])],
  };
}

export function updateLoan(database, loanId, input) {
  const current = (database.loans ?? []).find((loan) => loan.id === loanId);
  if (!current) throw new Error("El préstamo no existe.");

  const clientId = String(input.clientId ?? "");
  if (!(database.clients ?? []).some((client) => client.id === clientId)) {
    throw new Error("Selecciona un cliente.");
  }

  const capital = roundMoney(input.capital);
  const interestRate = parseRate(input.interestRate);
  if (capital <= 0) throw new Error("El capital debe ser mayor a cero.");
  if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 1000) {
    throw new Error("La tasa mensual debe estar entre 0 y 1000.");
  }

  const installments = normalizeInstallments(input.installments);
  const totalInterest = installments.reduce((sum, installment) => sum + installment.interestPart, 0);
  const totalAmount = installments.reduce((sum, installment) => sum + installment.amount, 0);

  return {
    ...database,
    loans: database.loans.map((loan) => (loan.id === loanId ? {
      ...current,
      clientId,
      capital,
      interestRate,
      frequency: "monthly",
      installmentCount: installments.length,
      firstDueDate: installments[0].dueDate,
      installmentAmount: installments[0].amount,
      totalInterest,
      totalAmount,
      installments,
      status: installments.every((installment) => installment.status === "paid") ? "paid" : "active",
      updatedAt: new Date().toISOString(),
    } : loan)),
  };
}

export function removeLoan(database, loanId) {
  if (!(database.loans ?? []).some((loan) => loan.id === loanId)) {
    throw new Error("El préstamo no existe.");
  }

  return {
    ...database,
    loans: database.loans.filter((loan) => loan.id !== loanId),
  };
}

function normalizeInstallments(installments) {
  if (!Array.isArray(installments) || installments.length < MIN_INSTALLMENTS || installments.length > MAX_INSTALLMENTS) {
    throw new Error("El préstamo debe tener de 1 a 6 cuotas.");
  }

  return installments.map((installment, index) => {
    const dueDate = String(installment.dueDate ?? "");
    if (!parseISODate(dueDate)) throw new Error(`La cuota ${index + 1} no tiene una fecha válida.`);

    const status = installment.status === "paid" ? "paid" : "pending";
    const capitalPart = roundMoney(installment.capitalPart);
    const interestPart = roundMoney(installment.interestPart);
    const amount = roundMoney(installment.amount);
    const lateFeeOverride = blankToNull(installment.lateFeeOverride);
    const lateFeeCharged = roundMoney(installment.lateFeeCharged);
    const paidAt = status === "paid" ? installment.paidAt || new Date().toISOString() : null;

    return {
      id: installment.id || crypto.randomUUID(),
      number: index + 1,
      dueDate,
      capitalPart,
      interestPart,
      amount,
      status,
      paidAt,
      paidDate: status === "paid" ? paidDateOf({ ...installment, paidAt }) ?? todayISODate() : null,
      paidAmount: status === "paid" ? roundMoney(installment.paidAmount) : null,
      lateFeeCharged: status === "paid" ? lateFeeCharged : 0,
      lateFeeOverride: status === "paid" ? null : lateFeeOverride,
    };
  });
}

function blankToNull(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return roundMoney(value);
}

export function installmentStatus(installment, today) {
  if (installment?.status === "paid") return "paid";
  return daysAfter(installment?.dueDate, today) > 0 ? "overdue" : "pending";
}

export function lateFeeForInstallment(installment, today) {
  if (!installment) return 0;
  if (installment.status === "paid") return roundMoney(installment.lateFeeCharged);
    if (installment.lateFeeOverride !== null && installment.lateFeeOverride !== undefined && String(installment.lateFeeOverride).trim() !== "") {
      return roundMoney(installment.lateFeeOverride);
    }
    const daysLate = daysAfter(installment.dueDate, today);
  return daysLate > 0 ? daysLate * LATE_FEE_PER_DAY : 0;
}

export function amountDue(installment, today) {
  return roundMoney(installment?.amount) + lateFeeForInstallment(installment, today);
}

export function outstandingBalance(loan, today) {
  return (loan?.installments ?? [])
    .filter((installment) => installment.status !== "paid")
    .reduce((sum, installment) => sum + amountDue(installment, today), 0);
}

export function collectedAmount(loan) {
  return (loan?.installments ?? [])
    .filter((installment) => installment.status === "paid")
    .reduce((sum, installment) => sum + roundMoney(installment.paidAmount), 0);
}

export function collectionDateForInstallment(installment) {
  if (installment?.status !== "paid") return installment?.dueDate;
  return paidDateOf(installment) ?? installment?.dueDate;
}

export function registerCollection(database, loanId, installmentId, collected, today) {
  const loans = database.loans ?? [];
  const loan = loans.find((item) => item.id === loanId);
  const installment = loan?.installments?.find((item) => item.id === installmentId);
  if (!loan || !installment) throw new Error("No se encontró la cuota.");

  const alreadyPaid = installment.status === "paid";
  if (collected === alreadyPaid) return database;

  const lateFee = collected ? lateFeeForInstallment({ ...installment, status: "pending", lateFeeCharged: 0 }, today) : 0;
  const installments = loan.installments.map((item) => {
    if (item.id !== installmentId) return item;
    if (!collected) {
      return { ...item, status: "pending", paidAt: null, paidDate: null, paidAmount: null, lateFeeCharged: 0 };
    }
    return {
      ...item,
      status: "paid",
      paidAt: new Date().toISOString(),
      paidDate: today,
      paidAmount: roundMoney(item.amount) + lateFee,
      lateFeeCharged: lateFee,
    };
  });

  return {
    ...database,
    loans: loans.map((item) => (item.id === loanId ? {
      ...item,
      installments,
      status: installments.every((entry) => entry.status === "paid") ? "paid" : "active",
      updatedAt: new Date().toISOString(),
    } : item)),
  };
}

function paidDateOf(installment) {
  if (parseISODate(installment?.paidDate)) return installment.paidDate;
  if (!installment?.paidAt) return null;
  const paidAt = new Date(installment.paidAt);
  return Number.isNaN(paidAt.getTime()) ? null : formatISODate(paidAt);
}

export function loanEntries(database) {
  return (database.loans ?? []).flatMap((loan) => (loan.installments ?? []).map((installment) => ({ loan, installment })));
}
