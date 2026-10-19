import { describe, expect, it } from "vitest";
import { buildReport } from "./reports";
import { compareBackup, backupReminder, inspectBackup, verifyBackupText } from "./backupVerify";
import { encryptBackupTextWithPin } from "./backupCrypto";
import { EMPTY_FILTERS, filterEntries, summarizeEntries } from "./collectionsFilter";
import { collectionDateForInstallment, lateFeeForInstallment, loanEntries, registerCollection, setLateFee } from "./loans";

const installment = (id, number, dueDate, status, extra = {}) => ({
  id, number, dueDate, status, amount: 400_000, capitalPart: 333_333, interestPart: 66_667,
  paidAmount: null, paidDate: null, paidAt: null, lateFeeCharged: 0, ...extra,
});

function sampleDatabase() {
  return {
    version: 1,
    updatedAt: null,
    auditLog: [],
    clients: [
      { id: "c1", firstName: "Ana", lastName: "Pérez", phone: "", dni: "", address: "", email: "", instagram: "", notes: "" },
      { id: "c2", firstName: "Luis", lastName: "Gómez", phone: "", dni: "", address: "", email: "", instagram: "", notes: "" },
    ],
    loans: [
      {
        id: "l1", clientId: "c1", status: "active", capital: 1_000_000, totalAmount: 1_200_000, totalInterest: 200_000, installmentCount: 3,
        installments: [
          installment("i1", 1, "2025-02-10", "paid", { paidAmount: 400_000, paidDate: "2025-02-10", paidAt: "2025-02-10T12:00:00.000Z" }),
          installment("i2", 2, "2025-03-10", "pending"),
          installment("i3", 3, "2025-04-10", "pending", { capitalPart: 333_334, interestPart: 66_666 }),
        ],
      },
      { id: "l2", clientId: "c2", status: "active", capital: 100_000, totalAmount: 120_000, totalInterest: 20_000, installmentCount: 1, installments: [installment("i4", 1, "2025-03-20", "pending", { capitalPart: 100_000, interestPart: 20_000, amount: 120_000 })] },
    ],
  };
}

describe("cobros con fecha real y mora editable", () => {
  const base = () => ({
    clients: [],
    loans: [{ id: "l", status: "active", installments: [{ id: "i", number: 1, dueDate: "2025-01-10", amount: 100_000, status: "pending" }] }],
  });

  it("registra un pago de meses anteriores con su fecha y mora a esa fecha", () => {
    const paid = registerCollection(base(), "l", "i", true, "2025-06-01", { paidDate: "2025-01-12" });
    expect(paid.loans[0].installments[0]).toMatchObject({ status: "paid", paidDate: "2025-01-12", lateFeeCharged: 20_000, paidAmount: 120_000 });
    expect(collectionDateForInstallment(paid.loans[0].installments[0])).toBe("2025-01-12");
  });

  it("permite quitar la mora al cobrar o antes de cobrar", () => {
    const noFee = registerCollection(base(), "l", "i", true, "2025-06-01", { paidDate: "2025-01-12", lateFee: 0 });
    expect(noFee.loans[0].installments[0]).toMatchObject({ lateFeeCharged: 0, paidAmount: 100_000 });
    const removed = setLateFee(base(), "l", "i", 0);
    expect(lateFeeForInstallment(removed.loans[0].installments[0], "2025-06-01")).toBe(0);
    const restored = setLateFee(removed, "l", "i", null);
    expect(lateFeeForInstallment(restored.loans[0].installments[0], "2025-01-12")).toBe(20_000);
  });

  it("rechaza fechas futuras o inválidas", () => {
    expect(() => registerCollection(base(), "l", "i", true, "2025-06-01", { paidDate: "2025-07-01" })).toThrow("futura");
    expect(() => registerCollection(base(), "l", "i", true, "2025-06-01", { paidDate: "2025-13-45" })).toThrow("válida");
  });
});

describe("reportes: capital y ganancias separados", () => {
  it("el dinero en la calle es solo el capital que falta recuperar", () => {
    const report = buildReport(sampleDatabase(), "2025-02-20");
    expect(report.streetMoney).toBe(report.capitalLent - report.recoveredCapital);
    expect(report.streetMoney).toBe(333_333 + 333_334 + 100_000);
    expect(report.realEarnings).toBe(66_667);
    expect(report.pendingInterestDue).toBe(66_667 + 66_666 + 20_000);
    expect(report.receivable).toBe(report.streetMoney + report.pendingInterestDue);
  });

  it("separa el capital de cuotas vencidas", () => {
    const report = buildReport(sampleDatabase(), "2025-03-15");
    expect(report.overdueCapital).toBe(333_333);
    expect(report.overdueCount).toBe(1);
  });
});

describe("filtros de cobros", () => {
  const today = "2025-03-15";
  const entries = loanEntries(sampleDatabase());

  it("filtra por cliente, estado y fechas", () => {
    expect(filterEntries(entries, EMPTY_FILTERS, today)).toHaveLength(4);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, clientId: "c2" }, today)).toHaveLength(1);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, status: "paid" }, today).map((e) => e.installment.id)).toEqual(["i1"]);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, status: "overdue" }, today).map((e) => e.installment.id)).toEqual(["i2"]);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, from: "2025-03-11", to: "2025-04-30" }, today).map((e) => e.installment.id)).toEqual(["i4", "i3"]);
  });

  it("resume cobrado, por cobrar y atrasado", () => {
    const summary = summarizeEntries(entries, today);
    expect(summary.collected).toBe(400_000);
    expect(summary.overdueCount).toBe(1);
    expect(summary.toCollectCount).toBe(3);
  });
});

describe("verificación de respaldos", () => {
  it("inspecciona conteos y detecta inconsistencias", () => {
    const database = sampleDatabase();
    expect(inspectBackup(database)).toMatchObject({ clients: 2, loans: 2, installments: 4, paid: 1, pending: 3, issues: [] });
    database.loans[0].clientId = "x";
    expect(inspectBackup(database).issues.length).toBe(1);
  });

  it("compara el archivo contra los datos actuales", () => {
    const current = sampleDatabase();
    const incoming = { ...sampleDatabase(), clients: [] };
    expect(compareBackup(current, incoming).clientsDelta).toBe(-2);
  });

  it("verifica que el archivo generado coincide y rechaza si no", async () => {
    const database = sampleDatabase();
    const text = await encryptBackupTextWithPin(database, "199526");
    await expect(verifyBackupText(text, "199526", database)).resolves.toMatchObject({ loans: 2 });
    await expect(verifyBackupText(text, "199526", { ...database, clients: [] })).rejects.toThrow("no coincide");
    await expect(verifyBackupText(text, "000000", database)).rejects.toThrow("no se pudo volver a abrir");
  });

  it("recuerda hacer respaldo a los 7 días o si nunca hubo", () => {
    const now = new Date("2025-03-15T12:00:00Z");
    expect(backupReminder(null, true, now)).toMatch("Todavía no");
    expect(backupReminder("2025-03-14T12:00:00Z", true, now)).toBeNull();
    expect(backupReminder("2025-03-07T12:00:00Z", true, now)).toMatch("8 días");
    expect(backupReminder(null, false, now)).toBeNull();
  });
});
