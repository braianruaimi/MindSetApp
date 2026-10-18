import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BACKUP_EVENT, emitMutation, listSnapshots, saveSnapshot } from "../services/backups";
import {
  clearGithubConfig,
  EMPTY_DATABASE,
  getGithubConfig,
  readDatabase,
  saveGithubConfig,
  writeDatabase,
} from "../services/githubSync";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [config, setConfig] = useState(() => getGithubConfig());
  const [database, setDatabase] = useState(EMPTY_DATABASE);
  const [sha, setSha] = useState(null);
  const [status, setStatus] = useState(() => (getGithubConfig() ? "loading" : "unconfigured"));
  const [error, setError] = useState("");
  const [remoteMissing, setRemoteMissing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [backups, setBackups] = useState([]);
  const [backupWarning, setBackupWarning] = useState("");
  const databaseRef = useRef(database);
  const shaRef = useRef(sha);

  useEffect(() => {
    databaseRef.current = database;
  }, [database]);

  useEffect(() => {
    shaRef.current = sha;
  }, [sha]);

  const refreshBackups = useCallback(async () => {
    const snapshots = await listSnapshots();
    setBackups(snapshots);
    return snapshots;
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      refreshBackups().catch((loadError) => setBackupWarning(loadError.message));
    }, 0);

    async function handleMutation(event) {
      try {
        await saveSnapshot(event.detail?.state, event.detail?.message);
        await refreshBackups();
        setBackupWarning("");
      } catch (backupError) {
        setBackupWarning(backupError.message || "No se pudo guardar el backup local.");
      }
    }

    window.addEventListener(BACKUP_EVENT, handleMutation);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(BACKUP_EVENT, handleMutation);
    };
  }, [refreshBackups]);

  const reload = useCallback(async () => {
    const stored = getGithubConfig();
    setConfig(stored);
    if (!stored) {
      setDatabase(EMPTY_DATABASE);
      setSha(null);
      setRemoteMissing(false);
      setStatus("unconfigured");
      setError("");
      return null;
    }

    setStatus("loading");
    setError("");
    try {
      const result = await readDatabase(stored);
      setDatabase(result.state);
      setSha(result.sha);
      setRemoteMissing(result.missing);
      setStatus("ready");
      return result;
    } catch (loadError) {
      setStatus("error");
      setError(loadError.message);
      throw loadError;
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      reload().catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [reload]);

  const saveConfig = useCallback(async (input) => {
    const next = saveGithubConfig(input);
    setConfig(next);
    await reload();
    return next;
  }, [reload]);

  const disconnect = useCallback(() => {
    clearGithubConfig();
    setConfig(null);
    setDatabase(EMPTY_DATABASE);
    setSha(null);
    setRemoteMissing(false);
    setError("");
    setStatus("unconfigured");
  }, []);

  const commit = useCallback(async (updater, message) => {
    const current = databaseRef.current;
    const next = typeof updater === "function" ? updater(current) : updater;
    setSyncing(true);
    setError("");
    try {
          try {
            await saveSnapshot(next, message);
            emitMutation(next, message);
          } catch (backupError) {
            setBackupWarning(backupError.message || "No se pudo guardar el backup local.");
          }
          const result = await writeDatabase(next, { message, sha: shaRef.current });
      setDatabase(result.state);
      setSha(result.sha);
      setRemoteMissing(false);
      setStatus("ready");
      return result;
    } catch (saveError) {
      setError(saveError.message);
      throw saveError;
    } finally {
      setSyncing(false);
    }
  }, []);

  const initializeRemote = useCallback(async () => {
    return commit(databaseRef.current, "chore: crear database.json");
  }, [commit]);

    const restoreState = useCallback(async (state, message = "restore: backup") => {
      if (!getGithubConfig()) {
        throw new Error("Configura GitHub antes de restaurar. La restauración también actualiza el repositorio.");
      }
      return commit(state, message);
    }, [commit]);

  const value = useMemo(() => ({
    config,
    database,
    sha,
    status,
    error,
    remoteMissing,
    syncing,
        backups,
        backupWarning,
        reload,
        refreshBackups,
        saveConfig,
        disconnect,
        commit,
        initializeRemote,
        restoreState,
      }), [config, database, sha, status, error, remoteMissing, syncing, backups, backupWarning, reload, refreshBackups, saveConfig, disconnect, commit, initializeRemote, restoreState]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState debe usarse dentro de AppStateProvider.");
  }
  return context;
}
