import { normalizeDatabase } from "./githubSync";

export const BACKUP_EVENT = "mindset:data-mutated";
const DB_NAME = "mindset-backups";
const STORE = "snapshots";
const MAX_SNAPSHOTS = 30;

let lastSignature = "";

export function emitMutation(state, message) {
  window.dispatchEvent(new CustomEvent(BACKUP_EVENT, { detail: { state, message } }));
}

export async function saveSnapshot(state, message = "cambio") {
  const normalized = normalizeDatabase(state);
  const signature = JSON.stringify(normalized);
  if (signature === lastSignature) return null;

  const snapshot = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    message: String(message || "cambio"),
    clients: normalized.clients.length,
    loans: normalized.loans.length,
    state: normalized,
  };
  const db = await openDatabase();
  await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).add(snapshot));
  await pruneSnapshots(db);
  lastSignature = signature;
  return snapshot;
}

export async function listSnapshots() {
  const db = await openDatabase();
  const snapshots = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
  return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteSnapshot(id) {
  const db = await openDatabase();
  await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
}

export function downloadSnapshot(snapshot) {
  const stamp = String(snapshot.createdAt ?? new Date().toISOString()).slice(0, 19).replace(/[:T]/g, "-");
  const blob = new Blob([JSON.stringify(snapshot.state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mindset-backup-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseBackupText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }

  const state = parsed?.state && typeof parsed.state === "object" ? parsed.state : parsed;
  if (!state || typeof state !== "object" || (!Object.hasOwn(state, "clients") && !Object.hasOwn(state, "loans"))) {
    throw new Error("El archivo no tiene el formato de la base de MindSet.");
  }
  return normalizeDatabase(state);
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
