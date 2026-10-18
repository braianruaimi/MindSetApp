const PIN_KEY = "mindset.settings.pin";
const PIN_VERSION = "mindset.settings.pin.version";
const UNLOCK_KEY = "mindset.settings.unlocked";
const DEFAULT_PIN_HASH = "b9a439eac63015ff867267a6f8cc4b3e9fcd7b3433ac42baa831b1f35a5b203b";

export async function applyDefaultPin() {
  if (localStorage.getItem(PIN_VERSION) === "1") return;
  localStorage.setItem(PIN_KEY, DEFAULT_PIN_HASH);
  localStorage.setItem(PIN_VERSION, "1");
  sessionStorage.removeItem(UNLOCK_KEY);
}

export function hasSettingsPin() {
  return Boolean(localStorage.getItem(PIN_KEY));
}

export function isSettingsUnlocked() {
  return hasSettingsPin() && sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export function lockSettings() {
  sessionStorage.removeItem(UNLOCK_KEY);
}

export async function saveSettingsPin(pin, currentPin = "") {
  assertPin(pin);
  if (hasSettingsPin()) {
    const valid = await unlockSettings(currentPin);
    if (!valid) throw new Error("El PIN actual no coincide.");
  }
  localStorage.setItem(PIN_KEY, await hashPin(pin));
  sessionStorage.setItem(UNLOCK_KEY, "1");
}

export async function unlockSettings(pin) {
  const stored = localStorage.getItem(PIN_KEY);
  if (!stored) return false;
  const valid = (await hashPin(pin)) === stored;
  if (valid) sessionStorage.setItem(UNLOCK_KEY, "1");
  return valid;
}

function assertPin(pin) {
  if (!/^\d{4,6}$/.test(String(pin ?? ""))) {
    throw new Error("El PIN debe tener entre 4 y 6 dígitos.");
  }
}

async function hashPin(pin) {
  const bytes = new TextEncoder().encode(`mindset-settings:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
