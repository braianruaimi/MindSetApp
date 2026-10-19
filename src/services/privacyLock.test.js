import { afterEach, describe, expect, it, vi } from "vitest";
import { createPrivacyConfig, DEFAULT_PRIVACY_CONFIG, readPrivacyConfig, unlockPrivacyConfig, verifyPrivacyPin } from "./privacyLock";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("default privacy lock", () => {
  it("uses the configured initial PIN on first launch", async () => {
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null) });

    const config = readPrivacyConfig();

    expect(config).toEqual(DEFAULT_PRIVACY_CONFIG);
    await expect(verifyPrivacyPin("199526", config)).resolves.toBe(true);
    await expect(verifyPrivacyPin("0000", config)).resolves.toBe(false);
  });

  it("wraps the data-encryption key so the PIN can unlock it and rotate safely", async () => {
    const rawDataKey = new Uint8Array(32).fill(11);
    const changed = await createPrivacyConfig("123456", 5, rawDataKey);
    const reopened = await unlockPrivacyConfig("123456", changed.config);

    expect(reopened.dataKeyBytes).toEqual(rawDataKey);
    await expect(unlockPrivacyConfig("654321", changed.config)).rejects.toThrow("no es correcto");
  });

  it("creates a wrapped data key for the default six-digit PIN on first unlock", async () => {
    const firstUnlock = await unlockPrivacyConfig("199526", DEFAULT_PRIVACY_CONFIG);
    expect(firstUnlock.config.wrappedKey).toMatchObject({ iv: expect.any(String), ciphertext: expect.any(String) });

    const nextUnlock = await unlockPrivacyConfig("199526", firstUnlock.config);
    expect(nextUnlock.dataKeyBytes).toEqual(firstUnlock.dataKeyBytes);
  });
});
