import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordMutation } from "./audit";

beforeEach(() => {
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "audit-id") });
});

describe("audit trail", () => {
  it("records client and loan changes with before/after loan details", () => {
    const previous = {
      clients: [],
      loans: [],
      auditLog: [],
    };
    const next = {
      clients: [{ id: "client-1", firstName: "Ana", lastName: "Pérez" }],
      loans: [{
        id: "loan-1",
        clientId: "client-1",
        capital: 50_000,
        interestRate: 10,
        installmentCount: 1,
        installments: [{ id: "part-1", number: 1, amount: 55_000, status: "pending" }],
      }],
    };

    const result = recordMutation(previous, next, "create: préstamo");

    expect(result.auditLog).toHaveLength(2);
    expect(result.auditLog.map(({ entity }) => entity)).toEqual(["client", "loan"]);
    expect(result.auditLog[1]).toMatchObject({
      label: "Préstamo · Ana Pérez",
      before: null,
      after: { capital: 50_000 },
    });
  });
});
