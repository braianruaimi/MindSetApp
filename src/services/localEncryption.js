const FORMAT = "mindset-local-encrypted";
const VERSION = 1;

export function isEncryptedLocalValue(value) {
  return value?.format === FORMAT && value.version === VERSION
    && typeof value.iv === "string" && typeof value.ciphertext === "string";
}

export async function encryptLocalValue(value, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    format: FORMAT,
    version: VERSION,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptLocalValue(envelope, key) {
  if (!isEncryptedLocalValue(envelope)) {
    throw new Error("El contenido local no tiene un formato cifrado compatible.");
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("No se pudieron descifrar los datos locales. Verifica el PIN y conserva tu respaldo.");
  }
}

export async function importDataKey(rawKey) {
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export function toBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function fromBase64(value) {
  if (typeof value !== "string") throw new Error("El dato cifrado no tiene formato Base64 válido.");
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
