import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BACKUP_EVENT, emitMutation, listSnapshots, saveSnapshot } from "../services/backups";
import { getLastExportAt, loadDatabase, requestPersistentStorage, saveDatabase } from "../services/storage";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [database, setDatabase] = useState(() => loadDatabase());
  const [backups, setBackups] = useState([]);
  const [backupWarning, setBackupWarning] = useState("");
  const [lastExportAt, setLastExportAt] = useState(() => getLastExportAt());

  const refreshBackups = useCallback(async () => {
    const snapshots = await listSnapshots();
    setBackups(snapshots);
    return snapshots;
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      requestPersistentStorage();
      refreshBackups().catch((loadError) => setBackupWarning(loadError.message));
    }, 0);

    async function handleMutation(event) {
      try {
        await saveSnapshot(event.detail?.state, event.detail?.message);
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
  }, [refreshBackups]);

  const commit = useCallback(async (updater, message) => {
    const next = typeof updater === "function" ? updater(database) : updater;
    const saved = saveDatabase(next);
    setDatabase(saved);
    emitMutation(saved, message);
    return saved;
  }, [database]);

  const restoreState = useCallback(
    (state, message = "restore: backup") => commit(state, message),
    [commit],
  );

  const value = useMemo(() => ({
    database,
    backups,
    backupWarning,
    lastExportAt,
    setLastExportAt,
    refreshBackups,
    commit,
    restoreState,
  }), [database, backups, backupWarning, lastExportAt, refreshBackups, commit, restoreState]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState debe usarse dentro de AppStateProvider.");
  }
  return context;
}
