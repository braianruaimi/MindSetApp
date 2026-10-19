import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { recordRestore } from "./audit";
import { decryptBackupText, encryptBackupText, encryptBackupTextWithPin, isEncryptedBackupText } from "./backupCrypto";

beforeAll(() => {
  if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
});

describe("encrypted JSON backups", () => {
  it("encrypts and restores valid data", async () => {
    const database = { version: 1, clients: [], loans: [] };
    const encrypted = await encryptBackupText(database, "frase segura de prueba");

    expect(isEncryptedBackupText(encrypted)).toBe(true);
    await expect(decryptBackupText(encrypted, "frase segura de prueba")).resolves.toMatchObject(database);
  });

  it("rejects a wrong passphrase and short passphrases", async () => {
    const encrypted = await encryptBackupText({ version: 1, clients: [], loans: [] }, "frase segura de prueba");

    await expect(decryptBackupText(encrypted, "otra frase completamente distinta")).rejects.toThrow(/no se pudo descifrar/i);
    await expect(encryptBackupText({ version: 1, clients: [], loans: [] }, "corta")).rejects.toThrow("al menos 10");
  });

  it("exports backups encrypted with the six-digit app PIN", async () => {
    const database = {
      version: 1,
      updatedAt: "2025-02-12T12:00:00.000Z",
      clients: [{
        id: "private-client",
        firstName: "Ana",
        lastName: "Pérez",
        phone: "123456",
        dni: "12345678",
        address: "Calle 1",
        email: "ana@example.com",
        instagram: "ana",
        notes: "Cliente habitual",
      }],
      loans: [{
        id: "private-loan",
        clientId: "private-client",
        status: "active",
        capital: 100_000,
        totalAmount: 120_000,
        installmentCount: 2,
        startDate: "2025-01-10",
        firstDueDate: "2025-02-10",
        installments: [
          {
            id: "paid-installment",
            number: 1,
            dueDate: "2025-02-10",
            capitalPart: 50_000,
            interestPart: 10_000,
            amount: 60_000,
            status: "paid",
            paidAmount: 70_000,
            paidAt: "2025-02-12T12:00:00.000Z",
            paidDate: "2025-02-12",
            lateFeeCharged: 10_000,
          },
          {
            id: "pending-installment",
            number: 2,
            dueDate: "2025-03-10",
            capitalPart: 50_000,
            interestPart: 10_000,
            amount: 60_000,
            status: "pending",
            paidAmount: null,
            paidAt: null,
            paidDate: null,
            lateFeeCharged: 0,
          },
        ],
      }],
      auditLog: [{ id: "operation-1", action: "collect", createdAt: "2025-02-12T12:00:00.000Z" }],
    };
    const encrypted = await encryptBackupTextWithPin(database, "199526");

    expect(encrypted).not.toContain("private-client");
    await expect(decryptBackupText(encrypted, "199526")).resolves.toEqual(database);
    await expect(decryptBackupText(encrypted, "000000")).rejects.toThrow("No se pudo descifrar");
  });

  it("restores clients, loans and installments exactly after data was deleted", async () => {
    const original = {
      version: 1,
      updatedAt: "2025-02-12T12:00:00.000Z",
      clients: [{ id: "c1", firstName: "Ana", lastName: "Pérez", phone: "1", dni: "1", address: "x", email: "a@b.co", instagram: "ana", notes: "n" }],
      loans: [{
        id: "l1",
        clientId: "c1",
        status: "active",
        capital: 100_000,
        totalAmount: 120_000,
        installments: [
          { id: "i1", number: 1, dueDate: "2025-02-10", amount: 60_000, status: "paid", paidAmount: 70_000, paidDate: "2025-02-12", paidAt: "2025-02-12T12:00:00.000Z", lateFeeCharged: 10_000 },
          { id: "i2", number: 2, dueDate: "2025-03-10", amount: 60_000, status: "pending", paidAmount: null, paidDate: null, paidAt: null, lateFeeCharged: 0 },
        ],
      }],
      auditLog: [],
    };
    const file = await encryptBackupTextWithPin(original, "199526");
    const afterDeletion = { version: 1, clients: [], loans: [], auditLog: [], updatedAt: null };

    const restored = recordRestore(afterDeletion, await decryptBackupText(file, "199526"), "restore: archivo importado");

    expect(restored.clients).toEqual(original.clients);
    expect(restored.loans).toEqual(original.loans);
  });
});
