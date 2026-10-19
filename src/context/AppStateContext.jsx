import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { recordMutation, recordRestore } from "../services/audit";
import { BACKUP_EVENT, emitMutation, listSnapshots, saveSnapshot } from "../services/backups";
import { EMPTY_DATABASE, loadDatabase, requestPersistentStorage, saveDatabase, validateDatabase } from "../services/storage";
import { usePrivacyLock } from "./usePrivacyLock";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const { encryptionKey } = usePrivacyLock();
  const [database, setDatabase] = useState(EMPTY_DATABASE);
  const [storageError, setStorageError] = useState(null);
  const [backups, setBackups] = useState([]);
  const [backupWarning, setBackupWarning] = useState("");
  const [lastExportAt, setLastExportAt] = useState(null);
  const [persistentStorage, setPersistentStorage] = useState("checking");
  const [hydrated, setHydrated] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const refreshBackups = useCallback(async () => {
    const snapshots = await listSnapshots(encryptionKey);
    setBackups(snapshots);
    return snapshots;
  }, [encryptionKey]);

  useEffect(() => {
    let active = true;
    loadDatabase(encryptionKey).then((result) => {
      if (!active) return;
      setDatabase(result.database);
      setStorageError(result.error);
      setLastExportAt(result.lastExportAt);
      setInitialized(true);
    });
    return () => {
      active = false;
    };
  }, [encryptionKey]);

  useEffect(() => {
    if (!initialized) return undefined;
    const timeoutId = window.setTimeout(() => {
      requestPersistentStorage().then((result) => {
        setPersistentStorage(result.granted ? "granted" : result.supported ? "denied" : "unsupported");
        if (result.error) {
          setBackupWarning(`El navegador no confirmó la protección del almacenamiento: ${result.error}`);
        }
      });
      refreshBackups()
        .catch((loadError) => setBackupWarning(loadError.message))
        .finally(() => setHydrated(true));
    }, 0);

    async function handleMutation(event) {
      try {
        await saveSnapshot(event.detail?.state, event.detail?.message, encryptionKey);
        await refreshBackups();
        setBackupWarning("");
      } catch (backupError) {
        setBackupWarning(backupError.message || "No se pudo guardar el historial local.");
      }
    }

    window.addEventListener(BACKUP_EVENT, handleMutation);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(BACKUP_EVENT, handleMutation);
    };
  }, [encryptionKey, initialized, refreshBackups]);

  const commit = useCallback(async (updater, message) => {
    if (storageError) {
      throw new Error("No se pueden guardar cambios mientras haya un problema con los datos locales. Restaura un JSON válido desde Respaldo.");
    }
    const next = typeof updater === "function" ? updater(database) : updater;
    const saved = await saveDatabase(recordMutation(database, next, message), encryptionKey);
    setDatabase(saved);
    emitMutation(saved, message);
    return saved;
  }, [database, encryptionKey, storageError]);

  const restoreState = useCallback(async (state, message = "restore: backup") => {
    const restored = validateDatabase(state);
    if (!storageError) {
      await saveSnapshot(database, "Punto de recuperación antes de restaurar", encryptionKey);
    }
    const saved = await saveDatabase(recordRestore(database, restored, message), encryptionKey);
    setDatabase(saved);
    setStorageError(null);
    emitMutation(saved, message);
    return saved;
  }, [database, encryptionKey, storageError]);

  const value = useMemo(() => ({
    database,
    storageError,
    backups,
    backupWarning,
    hydrated,
    persistentStorage,
    lastExportAt,
    setLastExportAt,
    refreshBackups,
    commit,
    restoreState,
  }), [database, storageError, backups, backupWarning, hydrated, persistentStorage, lastExportAt, refreshBackups, commit, restoreState]);

  return (
    <AppStateContext.Provider value={value}>
      {initialized ? children : <div className="px-4 py-16 text-center text-sm text-slate-400">Descifrando datos locales…</div>}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState debe usarse dentro de AppStateProvider.");
  }
  return context;
}
