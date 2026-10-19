import { normalizeDatabase, validateDatabase } from "./storage";
import { decryptLocalValue, encryptLocalValue, isEncryptedLocalValue } from "./localEncryption";
import { encryptBackupTextWithPin } from "./backupCrypto";
import { verifyBackupText } from "./backupVerify";

export const BACKUP_EVENT = "mindset:data-mutated";
const DB_NAME = "mindset-backups";
const STORE = "snapshots";
const MAX_SNAPSHOTS = 30;

let lastSignature = "";

export function emitMutation(state, message) {
  window.dispatchEvent(new CustomEvent(BACKUP_EVENT, { detail: { state, message } }));
}

export async function saveSnapshot(state, message, key) {
  const normalized = normalizeDatabase(state);
  const signature = JSON.stringify(normalized);
  if (signature === lastSignature) return null;
  if (!key) throw new Error("No hay una clave de cifrado activa para guardar el historial.");

  const snapshot = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payload: await encryptLocalValue({
      message: String(message || "cambio"),
      clients: normalized.clients.length,
      loans: normalized.loans.length,
      state: normalized,
    }, key),
  };
  const db = await openDatabase();
  await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).add(snapshot));
  await pruneSnapshots(db);
  lastSignature = signature;
  return snapshot;
}

export async function listSnapshots(key) {
  if (!key) throw new Error("No hay una clave de cifrado activa para leer el historial local.");
  const db = await openDatabase();
  const snapshots = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
  const decrypted = await Promise.all(snapshots.map(async (snapshot) => {
    if (!isEncryptedLocalValue(snapshot.payload)) {
      throw new Error("El historial local todavía no está cifrado.");
    }
    const payload = await decryptLocalValue(snapshot.payload, key);
    return { id: snapshot.id, createdAt: snapshot.createdAt, ...payload };
  }));
  return decrypted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function migrateSnapshots(key) {
  const db = await openDatabase();
  const snapshots = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
  const migrated = await Promise.all(snapshots.map(async (snapshot) => {
    if (isEncryptedLocalValue(snapshot.payload)) {
      await decryptLocalValue(snapshot.payload, key);
      return snapshot;
    }
    const state = isEncryptedLocalValue(snapshot.state)
      ? await decryptLocalValue(snapshot.state, key)
      : snapshot.state;
    return {
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      payload: await encryptLocalValue({
        message: snapshot.message || "cambio",
        clients: snapshot.clients ?? state?.clients?.length ?? 0,
        loans: snapshot.loans ?? state?.loans?.length ?? 0,
        state,
      }, key),
    };
  }));
  if (migrated.every((snapshot, index) => snapshot === snapshots[index])) return;

  const transaction = db.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  await Promise.all(migrated.map((snapshot) => requestToPromise(store.put(snapshot))));
}

export async function deleteSnapshot(id) {
  const db = await openDatabase();
  await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
}

export async function downloadSnapshot(snapshot, pin) {
  const stamp = String(snapshot.createdAt ?? new Date().toISOString()).slice(0, 19).replace(/[:T]/g, "-");
  const text = await encryptBackupTextWithPin(snapshot.state, pin);
  const summary = await verifyBackupText(text, pin, snapshot.state);
  downloadBackupText(text, `mindset-backup-${stamp}-cifrado.json`);
  return summary;
}

export function downloadBackupText(text, filename) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseBackupText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }

  const state = parsed?.state && typeof parsed.state === "object" ? parsed.state : parsed;
  try {
    return validateDatabase(state);
  } catch (error) {
    throw new Error(`El archivo no tiene una base de MindSet válida. ${error.message}`);
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el historial local."));
  });
}

async function pruneSnapshots(db) {
  const snapshots = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
  const excess = snapshots.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, Math.max(0, snapshots.length - MAX_SNAPSHOTS));
  if (excess.length === 0) return;

  const store = db.transaction(STORE, "readwrite").objectStore(STORE);
  await Promise.all(excess.map((snapshot) => requestToPromise(store.delete(snapshot.id))));
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falló la operación de backup."));
  });
}
