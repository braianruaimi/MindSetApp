import { decryptLocalValue, encryptLocalValue, isEncryptedLocalValue } from "./localEncryption";

export const DATABASE_KEY = "mindset.database";
export const LAST_EXPORT_KEY = "mindset.lastExportAt";
export const MAX_AUDIT_ENTRIES = 300;

export const EMPTY_DATABASE = {
  version: 1,
  clients: [],
  loans: [],
  auditLog: [],
  updatedAt: null,
};

export function normalizeDatabase(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: 1,
    clients: Array.isArray(source.clients) ? source.clients : [],
    loans: Array.isArray(source.loans) ? source.loans : [],
    auditLog: Array.isArray(source.auditLog) ? source.auditLog.slice(-MAX_AUDIT_ENTRIES) : [],
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

export function validateDatabase(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Los datos no tienen el formato esperado.");
  }
  if (value.version !== undefined && value.version !== 1) {
    throw new Error("Esta copia usa una versión de datos no compatible.");
  }
  if (!Array.isArray(value.clients) || !Array.isArray(value.loans)) {
    throw new Error("La base debe incluir listas válidas de clientes y préstamos.");
  }
  if (value.auditLog !== undefined && !Array.isArray(value.auditLog)) {
    throw new Error("El historial de operaciones tiene un formato no válido.");
  }
  if (value.auditLog?.some((entry) => !entry || typeof entry !== "object" || typeof entry.id !== "string" || typeof entry.action !== "string" || typeof entry.createdAt !== "string")) {
    throw new Error("El historial contiene una operación no válida.");
  }
  if (value.clients.some((client) => !client || typeof client !== "object" || Array.isArray(client))) {
    throw new Error("La lista de clientes contiene datos no válidos.");
  }
  if (value.loans.some((loan) => !loan || typeof loan !== "object" || Array.isArray(loan) || (loan.installments !== undefined && !Array.isArray(loan.installments)))) {
    throw new Error("La lista de préstamos contiene datos no válidos.");
  }
  return normalizeDatabase(value);
}

export async function initializeEncryptedStorage(key) {
  try {
    const raw = localStorage.getItem(DATABASE_KEY);
    const value = raw ? JSON.parse(raw) : structuredClone(EMPTY_DATABASE);
    const database = validateDatabase(isEncryptedLocalValue(value) ? await decryptLocalValue(value, key) : value);

    if (!isEncryptedLocalValue(value)) {
      const encrypted = await encryptLocalValue(database, key);
      localStorage.setItem(DATABASE_KEY, JSON.stringify(encrypted));
    }
    return database;
  } catch (error) {
    throw new Error(`No se pudo preparar el cifrado de los datos locales. No se reemplazaron datos. (${error.message})`);
  }
}

export async function loadDatabase(key) {
  try {
    const raw = localStorage.getItem(DATABASE_KEY);
    const lastExportAt = localStorage.getItem(LAST_EXPORT_KEY);
    if (!raw) {
      throw new Error("No se encontró la base local cifrada. Intenta desbloquear nuevamente o restaura un respaldo.");
    }
    const stored = JSON.parse(raw);
    if (!isEncryptedLocalValue(stored)) {
      throw new Error("Los datos todavía no están cifrados. Desbloquea la app para migrarlos.");
    }
    return { database: validateDatabase(await decryptLocalValue(stored, key)), error: null, lastExportAt };
  } catch (error) {
    return {
      database: structuredClone(EMPTY_DATABASE),
      error: `No pude leer los datos guardados (${error.message}). No se modificaron. Abre Respaldo e importa una copia JSON válida.`,
      lastExportAt: null,
    };
  }
}

export async function saveDatabase(state, key) {
  const next = { ...validateDatabase(state), updatedAt: new Date().toISOString() };
  try {
    if (!key) throw new Error("No hay una clave de cifrado activa.");
    localStorage.setItem(DATABASE_KEY, JSON.stringify(await encryptLocalValue(next, key)));
  } catch (error) {
    throw new Error(`No se pudo guardar en este dispositivo. Revisa el espacio disponible o descarga un respaldo. (${error.message})`);
  }
  return next;
}

export function markExported() {
  const timestamp = new Date().toISOString();
  try {
    localStorage.setItem(LAST_EXPORT_KEY, timestamp);
  } catch (error) {
    throw new Error(`El archivo se descargó, pero no se pudo registrar la fecha del respaldo. (${error.message})`);
  }
  return timestamp;
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) {
    return { supported: false, granted: false };
  }
  try {
    return { supported: true, granted: await navigator.storage.persist() };
  } catch (error) {
    return { supported: true, granted: false, error: error.message };
  }
}
