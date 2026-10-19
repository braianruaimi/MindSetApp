import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptLocalValue, isEncryptedLocalValue } from "./localEncryption";
import { DATABASE_KEY, initializeEncryptedStorage, loadDatabase, saveDatabase } from "./storage";

function mockLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    removeItem: vi.fn((key) => values.delete(key)),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local storage safeguards", () => {
  it("does not overwrite corrupt data while loading", async () => {
    const storage = mockLocalStorage({ [DATABASE_KEY]: "{broken" });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("crypto", webcrypto);

    const result = await loadDatabase(await makeKey());

    expect(result.error).toContain("No se modificaron");
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem(DATABASE_KEY)).toBe("{broken");
  });

  it("encrypts the database at rest and decrypts it with the active key", async () => {
    const storage = mockLocalStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("crypto", webcrypto);
    const key = await makeKey();

    const saved = await saveDatabase({ version: 1, clients: [], loans: [] }, key);
    const stored = JSON.parse(storage.getItem(DATABASE_KEY));

    expect(isEncryptedLocalValue(stored)).toBe(true);
    expect(stored.ciphertext).not.toContain("clients");
    await expect(decryptLocalValue(stored, key)).resolves.toMatchObject({ clients: [], loans: [] });
    await expect(loadDatabase(key)).resolves.toMatchObject({ database: { clients: [], loans: [] }, error: null });
    expect(saved.updatedAt).toEqual(expect.any(String));
  });

  it("migrates existing plaintext data without changing its contents", async () => {
    const database = { version: 1, clients: [{ id: "client-1" }], loans: [], auditLog: [] };
    const storage = mockLocalStorage({ [DATABASE_KEY]: JSON.stringify(database) });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("crypto", webcrypto);

    const migrated = await initializeEncryptedStorage(await makeKey());

    expect(migrated.clients).toEqual(database.clients);
    expect(isEncryptedLocalValue(JSON.parse(storage.getItem(DATABASE_KEY)))).toBe(true);
  });
});

async function makeKey() {
  return crypto.subtle.importKey("raw", new Uint8Array(32).fill(7), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
