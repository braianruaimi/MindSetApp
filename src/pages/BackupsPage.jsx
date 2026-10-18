import { useEffect, useRef, useState } from "react";
import { SettingsGate } from "../components/SettingsGate";
import { useAppState } from "../context/AppStateContext";
import { deleteSnapshot, downloadSnapshot, parseBackupText } from "../services/backups";
import { formatDisplayDate } from "../utils/dates";

export function BackupsPage() {
  const { database, status, syncing, backups, backupWarning, refreshBackups, restoreState } = useAppState();
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const fileInput = useRef(null);

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
      await restoreState(state, "restore: archivo importado");
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
      <SettingsGate>
      <section className="mx-auto w-full max-w-2xl space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Backups</h1>
        <p className="text-sm leading-6 text-slate-600">Cada cambio queda en este dispositivo, aparte de GitHub. Restaurar también vuelve a escribir database.json en el repositorio.</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => downloadSnapshot({ createdAt: new Date().toISOString(), state: database })} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white">Descargar estado actual</button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={syncing || status === "unconfigured"} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60">Importar JSON</button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
      </div>

      {status === "unconfigured" && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Para restaurar hace falta la configuración de GitHub. Descargar sigue disponible.</p>}
      {(error || backupWarning) && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error || backupWarning}</p>}

      <ul className="space-y-3">
        {backups.map((snapshot) => (
          <li key={snapshot.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-medium text-slate-900">{snapshot.message}</p>
            <p className="mt-1 text-sm text-slate-500">{formatSnapshotDate(snapshot.createdAt)} · {snapshot.clients} clientes · {snapshot.loans} préstamos</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <button type="button" onClick={() => downloadSnapshot(snapshot)} className="font-medium text-teal-800">Descargar</button>
              {pendingId === snapshot.id ? (
                <>
                  <button type="button" onClick={() => handleRestore(snapshot)} disabled={syncing || status !== "ready"} className="font-medium text-rose-700 disabled:opacity-60">Confirmar restauración</button>
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
        </SettingsGate>
      );
    }

function formatSnapshotDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${formatDisplayDate(iso)} ${time}`;
}
