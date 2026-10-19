import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSchedule, lateFeeForInstallment, registerCollection } from "./loans";

beforeEach(() => {
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => `id-${Math.random()}`),
  });
});

describe("loan schedules and collections", () => {
  it("builds the requested number of monthly installments and preserves the capital", () => {
    const schedule = buildSchedule({
      capital: 100_000,
      interestRate: 5,
      installmentCount: 3,
      firstDueDate: "2025-01-31",
    });

    expect(schedule.installments).toHaveLength(3);
    expect(schedule.installments.map(({ dueDate }) => dueDate)).toEqual(["2025-01-31", "2025-02-28", "2025-03-31"]);
    expect(schedule.installments.reduce((sum, item) => sum + item.capitalPart, 0)).toBe(100_000);
    expect(schedule.totalInterest).toBe(15_000);
    expect(schedule.totalAmount).toBe(115_000);
  });

  it("rejects installment counts outside the supported range", () => {
    expect(() => buildSchedule({
      capital: 100_000,
      interestRate: 0,
      installmentCount: 7,
      firstDueDate: "2025-01-01",
    })).toThrow("de 1 a 6");
  });

  it("adds 10,000 per late day and keeps paid fees fixed", () => {
    const pending = { dueDate: "2025-02-10", amount: 20_000, status: "pending" };
    expect(lateFeeForInstallment(pending, "2025-02-13")).toBe(30_000);
    expect(lateFeeForInstallment({ ...pending, status: "paid", lateFeeCharged: 20_000 }, "2025-03-01")).toBe(20_000);
  });

  it("registers and reverses a collection with its late fee", () => {
    const database = {
      clients: [],
      loans: [{
        id: "loan-1",
        status: "active",
        installments: [{ id: "installment-1", number: 1, dueDate: "2025-02-10", amount: 20_000, status: "pending" }],
      }],
    };

    const collected = registerCollection(database, "loan-1", "installment-1", true, "2025-02-12");
    expect(collected.loans[0].installments[0]).toMatchObject({
      status: "paid",
      paidAmount: 40_000,
      lateFeeCharged: 20_000,
    });
    const reverted = registerCollection(collected, "loan-1", "installment-1", false, "2025-02-12");
    expect(reverted.loans[0].installments[0]).toMatchObject({
      status: "pending",
      paidAmount: null,
      lateFeeCharged: 0,
    });
  });
});
