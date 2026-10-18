export const DATABASE_KEY = "mindset.database";
export const LAST_EXPORT_KEY = "mindset.lastExportAt";

export const EMPTY_DATABASE = {
  version: 1,
  clients: [],
  loans: [],
  updatedAt: null,
};

export function normalizeDatabase(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: 1,
    clients: Array.isArray(source.clients) ? source.clients : [],
    loans: Array.isArray(source.loans) ? source.loans : [],
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

export function loadDatabase() {
  try {
    const raw = localStorage.getItem(DATABASE_KEY);
    return raw ? normalizeDatabase(JSON.parse(raw)) : structuredClone(EMPTY_DATABASE);
  } catch {
    return structuredClone(EMPTY_DATABASE);
  }
}

export function saveDatabase(state) {
  const next = { ...normalizeDatabase(state), updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(next));
  } catch {
    throw new Error("No se pudo guardar en este dispositivo. Revisa el espacio disponible del navegador.");
  }
  return next;
}

export function getLastExportAt() {
  return localStorage.getItem(LAST_EXPORT_KEY);
}

export function markExported() {
  localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
}

export async function requestPersistentStorage() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Sin soporte: los datos siguen guardándose igual.
  }
}
