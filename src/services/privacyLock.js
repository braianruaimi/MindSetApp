import { fromBase64, importDataKey, toBase64 } from "./localEncryption";

const DEFAULT_TIMEOUT = 5;
const PIN_ITERATIONS = 600_000;
const DEFAULT_SALT = "bWluZHNldC12Mi1waW4tc2FsdA==";
const LEGACY_DEFAULT_SALT = "bWluZHNldC1kZWZhdWx0LXBpbi12MQ==";
const LEGACY_PIN_1995_HASH = "bbLPK86MJZt/jl3gBT14BjI2mXXUIOBi8cGha7zLaq0=";

export const PRIVACY_STORAGE_KEY = "mindset.privacy";
export const DEFAULT_PRIVACY_CONFIG = Object.freeze({
  salt: DEFAULT_SALT,
  hash: "Y60I297cjn8FQ3e5JY0u1kJqogZ8r7/3hNdWFS8GK/I=",
  timeoutMinutes: DEFAULT_TIMEOUT,
  wrappedKey: null,
});

export function readPrivacyConfig() {
  try {
    const raw = localStorage.getItem(PRIVACY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRIVACY_CONFIG };

    const parsed = JSON.parse(raw);
    if (parsed.salt === LEGACY_DEFAULT_SALT && parsed.hash === LEGACY_PIN_1995_HASH && !parsed.wrappedKey) {
      return { ...DEFAULT_PRIVACY_CONFIG };
    }
    if (typeof parsed?.salt === "string" && typeof parsed?.hash === "string") {
      return { ...parsed, timeoutMinutes: normalizeTimeout(parsed.timeoutMinutes) };
    }
    throw new Error("La configuración de privacidad no tiene el formato esperado.");
  } catch (error) {
    console.error("No se pudo leer la configuración de privacidad; se usará el PIN inicial.", error);
    return { ...DEFAULT_PRIVACY_CONFIG };
  }
}

export async function createPrivacyConfig(pin, timeoutMinutes = DEFAULT_TIMEOUT, dataKeyBytes) {
  validatePin(pin);
  const rawKey = dataKeyBytes ?? crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltBase64 = toBase64(salt);
  const { verifier, keyEncryptionKey } = await derivePinSecrets(pin, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKey = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyEncryptionKey, rawKey);

  return {
    config: {
      salt: saltBase64,
      hash: verifier,
      timeoutMinutes: normalizeTimeout(timeoutMinutes),
      wrappedKey: { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(wrappedKey)) },
    },
    key: await importDataKey(rawKey),
    dataKeyBytes: rawKey,
  };
}

export async function unlockPrivacyConfig(pin, config) {
  validatePin(pin);
  const { verifier, keyEncryptionKey } = await derivePinSecrets(pin, fromBase64(config.salt));
  if (verifier !== config.hash) throw new Error("El PIN no es correcto.");

  let dataKeyBytes;
  let wrappedKey = config.wrappedKey;
  if (wrappedKey) {
    try {
      const raw = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(wrappedKey.iv) },
        keyEncryptionKey,
        fromBase64(wrappedKey.ciphertext),
      );
      dataKeyBytes = new Uint8Array(raw);
      if (dataKeyBytes.length !== 32) throw new Error("Clave local inválida.");
    } catch {
      throw new Error("No se pudo abrir la clave de cifrado. Conserva un respaldo JSON cifrado.");
    }
  } else {
    dataKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyEncryptionKey, dataKeyBytes);
    wrappedKey = { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
  }

  return {
    key: await importDataKey(dataKeyBytes),
    dataKeyBytes,
    config: wrappedKey === config.wrappedKey ? config : { ...config, wrappedKey },
  };
}

export async function verifyPrivacyPin(pin, config) {
  if (typeof pin !== "string" || !config?.salt || !config?.hash) return false;
  try {
    const { verifier } = await derivePinSecrets(pin, fromBase64(config.salt));
    return verifier === config.hash;
  } catch (error) {
    throw new Error(`No se pudo verificar el PIN. (${error.message})`);
  }
}

export function normalizeTimeout(value) {
  const minutes = Number(value);
  return [1, 5, 15, 30].includes(minutes) ? minutes : DEFAULT_TIMEOUT;
}

function validatePin(pin) {
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    throw new Error("El PIN de cifrado debe tener exactamente 6 dígitos.");
  }
}

async function derivePinSecrets(pin, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("El cifrado requiere un navegador actualizado y una conexión segura (HTTPS).");
  }
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PIN_ITERATIONS, hash: "SHA-256" },
    material,
    512,
  ));
  const verifier = toBase64(derived.subarray(0, 32));
  const keyEncryptionKey = await crypto.subtle.importKey(
    "raw",
    derived.subarray(32),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return { verifier, keyEncryptionKey };
}
