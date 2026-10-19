import { validateDatabase } from "./storage";

const FORMAT = "mindset-encrypted-backup";
const VERSION = 1;
const ITERATIONS = 600_000;
const SUPPORTED_ITERATIONS = new Set([310_000, ITERATIONS]);

export function isEncryptedBackupText(text) {
  try {
    return JSON.parse(text)?.format === FORMAT;
  } catch {
    return false;
  }
}

export async function encryptBackupText(state, passphrase) {
  validatePassphrase(passphrase);
  return encryptWithSecret(state, passphrase);
}

export async function encryptBackupTextWithPin(state, pin) {
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    throw new Error("Ingresa el PIN de 6 dígitos para cifrar el respaldo.");
  }
  return encryptWithSecret(state, pin);
}

async function encryptWithSecret(state, secret) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("El cifrado requiere un navegador actualizado y una conexión segura (HTTPS).");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt, ["encrypt"], ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(validateDatabase(state)));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  return JSON.stringify({
    format: FORMAT,
    version: VERSION,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  }, null, 2);
}

export async function decryptBackupText(text, passphrase) {
  validateBackupSecret(passphrase);
  let encrypted;
  try {
    encrypted = JSON.parse(text);
  } catch {
    throw new Error("El archivo cifrado no es un JSON válido.");
  }
  if (encrypted?.format !== FORMAT || encrypted.version !== VERSION
    || encrypted.algorithm !== "AES-GCM" || encrypted.kdf !== "PBKDF2-SHA-256"
    || !SUPPORTED_ITERATIONS.has(encrypted.iterations)) {
    throw new Error("El archivo cifrado no es compatible o está incompleto.");
  }

  try {
    const salt = fromBase64(encrypted.salt);
    const iv = fromBase64(encrypted.iv);
    const ciphertext = fromBase64(encrypted.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) {
      throw new Error("El archivo cifrado está dañado.");
    }
    const key = await deriveKey(passphrase, salt, ["decrypt"], encrypted.iterations);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const state = JSON.parse(new TextDecoder().decode(plaintext));
    return validateDatabase(state);
  } catch {
    throw new Error("No se pudo descifrar el respaldo. Verifica la contraseña o el archivo.");
  }
}

function validatePassphrase(passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < 10) {
    throw new Error("La contraseña del respaldo debe tener al menos 10 caracteres.");
  }
  if (!crypto.subtle) {
    throw new Error("El cifrado requiere un navegador actualizado y una conexión segura (HTTPS).");
  }
}

function validateBackupSecret(secret) {
  if (typeof secret !== "string" || !(/^\d{6}$/.test(secret) || secret.length >= 10)) {
    throw new Error("Ingresa el PIN de 6 dígitos o la contraseña del respaldo.");
  }
  if (!crypto.subtle) {
    throw new Error("El cifrado requiere un navegador actualizado y una conexión segura (HTTPS).");
  }
}

async function deriveKey(passphrase, salt, usages, iterations) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

function toBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value) {
  if (typeof value !== "string") throw new Error("Base64 no válido.");
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
