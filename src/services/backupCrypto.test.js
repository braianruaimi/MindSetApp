import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
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
    const database = { version: 1, clients: [{ id: "private-client" }], loans: [] };
    const encrypted = await encryptBackupTextWithPin(database, "199526");

    expect(encrypted).not.toContain("private-client");
    await expect(decryptBackupText(encrypted, "199526")).resolves.toMatchObject(database);
    await expect(decryptBackupText(encrypted, "000000")).rejects.toThrow("No se pudo descifrar");
  });
});
