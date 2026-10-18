import { useEffect, useRef, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import { deleteSnapshot, downloadSnapshot, parseBackupText } from "../services/backups";
import { markExported } from "../services/storage";
import { formatDisplayDate } from "../utils/dates";

export function BackupsPage() {
  const { database, backups, backupWarning, lastExportAt, setLastExportAt, refreshBackups, restoreState } = useAppState();
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const fileInput = useRef(null);

  function handleDownloadCurrent() {
    downloadSnapshot({ createdAt: new Date().toISOString(), state: database });
    markExported();
    setLastExportAt(new Date().toISOString());
  }

  useEffect(() => {
    refreshBackups().catch((loadError) => setError(loadError.message));
  }, [refreshBackups]);

  async function handleRestore(snapshot) {
    setError("");
    try {
      await restoreState(snapshot.state, `restore: ${snapshot.message}`);
      setPendingId("");
    } catch (restoreError) {
      setError(restoreError.message);
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const state = parseBackupText(await file.text());
      setPendingImport(state);
    } catch (importError) {
      setError(importError.message);
    }
  }

  async function confirmImport() {
    setError("");
    try {
      await restoreState(pendingImport, "restore: archivo importado");
      setPendingImport(null);
    } catch (importError) {
      setError(importError.message);
    }
  }

  async function handleDelete(id) {
    setError("");
    try {
      await deleteSnapshot(id);
      await refreshBackups();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Respaldo</h1>
        <p className="text-sm leading-6 text-slate-600">Todo se guarda automáticamente en este dispositivo. Descarga el JSON seguido: si se borran los datos del navegador, lo importas y recuperas todo.</p>
        <p className="text-xs text-slate-500">{lastExportAt ? `Última descarga: ${formatSnapshotDate(lastExportAt)}` : "Todavía no descargaste ningún respaldo."}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={handleDownloadCurrent} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white">Descargar respaldo (.json)</button>
        <button type="button" onClick={() => fileInput.current?.click()} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700">Cargar respaldo JSON</button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
      </div>

      {pendingImport && (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>El archivo tiene {pendingImport.clients.length} clientes y {pendingImport.loans.length} préstamos. Reemplazará los datos actuales.</p>
          <div className="flex gap-4">
            <button type="button" onClick={confirmImport} className="font-medium text-rose-700">Reemplazar datos</button>
            <button type="button" onClick={() => setPendingImport(null)} className="text-slate-600">Cancelar</button>
          </div>
        </div>
      )}
      {(error || backupWarning) && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error || backupWarning}</p>}

      <h2 className="pt-2 text-sm font-medium text-slate-700">Historial reciente en este dispositivo</h2>
      <ul className="space-y-3">
        {backups.map((snapshot) => (
          <li key={snapshot.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-medium text-slate-900">{snapshot.message}</p>
            <p className="mt-1 text-sm text-slate-500">{formatSnapshotDate(snapshot.createdAt)} · {snapshot.clients} clientes · {snapshot.loans} préstamos</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <button type="button" onClick={() => downloadSnapshot(snapshot)} className="font-medium text-teal-800">Descargar</button>
              {pendingId === snapshot.id ? (
                <>
                  <button type="button" onClick={() => handleRestore(snapshot)} className="font-medium text-rose-700">Confirmar restauración</button>
                  <button type="button" onClick={() => setPendingId("")} className="text-slate-500">Cancelar</button>
                </>
              ) : (
                <button type="button" onClick={() => setPendingId(snapshot.id)} className="text-slate-600">Restaurar</button>
              )}
              <button type="button" onClick={() => handleDelete(snapshot.id)} className="text-slate-400">Borrar</button>
            </div>
          </li>
        ))}
      </ul>
      {backups.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Todavía no hay cambios en el historial local.</p>}
    </section>
  );
}

function formatSnapshotDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${formatDisplayDate(iso)} ${time}`;
}
