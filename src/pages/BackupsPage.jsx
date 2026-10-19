import { useEffect, useRef, useState } from "react";
import { AlertTriangle, DatabaseBackup, Download, FileUp, History, LockKeyhole, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useAppState } from "../context/AppStateContext";
import { usePrivacyLock } from "../context/usePrivacyLock";
import { deleteSnapshot, downloadBackupText, downloadSnapshot, parseBackupText } from "../services/backups";
import { decryptBackupText, encryptBackupText, isEncryptedBackupText } from "../services/backupCrypto";
import { markExported } from "../services/storage";
import { compareBackup, verifyBackupText } from "../services/backupVerify";
import { formatDisplayDate } from "../utils/dates";
import { formatMoney } from "../utils/money";

function describeSummary(summary) {
  return `${summary.clients} clientes, ${summary.loans} préstamos, ${summary.installments} cuotas, ${summary.paid} cobros`;
}

export function BackupsPage() {
  const { database, backups, backupWarning, storageError, persistentStorage, lastExportAt, setLastExportAt, refreshBackups, restoreState } = useAppState();
  const privacy = usePrivacyLock();
  const [error, setError] = useState("");
  const [verified, setVerified] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const [pendingEncryptedText, setPendingEncryptedText] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [backupPassphraseConfirm, setBackupPassphraseConfirm] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const fileInput = useRef(null);
  const activity = [...(database.auditLog ?? [])].reverse().slice(0, 30);

  async function handleDownload(snapshot) {
    setError("");
    setVerified("");
    const pin = await privacy.confirmPin("Ingresa tu PIN para cifrar y descargar este respaldo.");
    if (!pin) return;
    try {
      const summary = await downloadSnapshot(snapshot, pin);
      const timestamp = markExported();
      setLastExportAt(timestamp);
      setVerified(`Respaldo verificado: se volvió a abrir y coincide con tus datos (${describeSummary(summary)}).`);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  useEffect(() => {
    refreshBackups().catch((loadError) => setError(loadError.message));
  }, [refreshBackups]);

  async function handleRestore(snapshot) {
    setError("");
    const pin = await privacy.confirmPin("Ingresa tu PIN para restaurar este respaldo local.");
    if (!pin) return;
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
    const pin = await privacy.confirmPin("Ingresa tu PIN para abrir este respaldo.");
    if (!pin) return;
    try {
      const text = await file.text();
      if (isEncryptedBackupText(text)) {
        try {
          setPendingImport(await decryptBackupText(text, pin));
          setPendingEncryptedText("");
          setImportPassphrase("");
        } catch {
          setPendingEncryptedText(text);
          setPendingImport(null);
          setImportPassphrase("");
          setError("El archivo no se abrió con el PIN de la app. Si lo cifraste con otra contraseña, ingrésala debajo.");
        }
        return;
      }
      const state = parseBackupText(text);
      setPendingImport(state);
    } catch (importError) {
      setError(importError.message);
    }
  }

  async function handleDecryptImport() {
    setError("");
    try {
      const state = await decryptBackupText(pendingEncryptedText, importPassphrase);
      setPendingImport(state);
      setPendingEncryptedText("");
      setImportPassphrase("");
    } catch (decryptError) {
      setError(decryptError.message);
    }
  }

  async function handleEncryptedDownload() {
    setError("");
    setVerified("");
    if (backupPassphrase !== backupPassphraseConfirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!(await privacy.confirmPin("Ingresa tu PIN para descargar el respaldo cifrado."))) return;
    try {
      const text = await encryptBackupText(database, backupPassphrase);
      const summary = await verifyBackupText(text, backupPassphrase, database);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      downloadBackupText(text, `mindset-backup-cifrado-${stamp}.json`);
      setLastExportAt(markExported());
      setVerified(`Respaldo verificado: se volvió a abrir y coincide con tus datos (${describeSummary(summary)}).`);
      setBackupPassphrase("");
      setBackupPassphraseConfirm("");
    } catch (encryptError) {
      setError(encryptError.message);
    }
  }

  async function handleSavePin(event) {
    event.preventDefault();
    setError("");
    if (newPin !== newPinConfirm) {
      setError("Los PIN no coinciden.");
      return;
    }
    try {
      await privacy.setPin(newPin, privacy.timeoutMinutes, currentPin);
      setNewPin("");
      setNewPinConfirm("");
      setCurrentPin("");
    } catch (pinError) {
      setError(pinError.message);
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
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Seguridad local</p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white"><DatabaseBackup size={23} className="text-emerald-300" /> Respaldo</h1>
        <p className="text-sm leading-6 text-slate-400">El respaldo incluye todos tus clientes, préstamos y cuotas, con importes, vencimientos, estados y fechas de cobro, mora, datos de contacto e historial de operaciones. Se descarga cifrado con tu PIN para que puedas recuperar la base completa si se borra el almacenamiento del sitio.</p>
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={14} />{lastExportAt ? `Última descarga: ${formatSnapshotDate(lastExportAt)}` : "Todavía no descargaste ningún respaldo."}</p>
      </header>

      <section className="glass space-y-4 rounded-3xl p-4 sm:p-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><LockKeyhole size={17} className="text-emerald-300" />Bloqueo de privacidad</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">PIN inicial: 199526. Cifra la base y el historial local; los respaldos descargados también se cifran con el PIN. Si lo olvidas, no podrás abrir esos datos ni esos respaldos. Para una copia recuperable por separado, usa una contraseña distinta en “Respaldo cifrado opcional”.</p>
        </div>
        <form onSubmit={handleSavePin} className="space-y-3">
          {privacy.enabled && <input type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, ""))} placeholder="PIN actual (6 dígitos)" aria-label="PIN actual" className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm" />}
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ""))} placeholder="Nuevo PIN (6 dígitos)" aria-label="Nuevo PIN" className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm" />
            <input type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={newPinConfirm} onChange={(event) => setNewPinConfirm(event.target.value.replace(/\D/g, ""))} placeholder="Confirmar PIN" aria-label="Confirmar PIN" className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15">{privacy.enabled ? "Cambiar PIN" : "Activar PIN"}</button>
            {privacy.enabled && (
              <>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  Bloqueo automático
                  <select value={privacy.timeoutMinutes} onChange={(event) => privacy.updateTimeout(event.target.value)} className="rounded-lg border border-white/10 px-2 py-2 text-slate-200">
                    {[1, 5, 15, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => privacy.lock()} className="text-sm text-emerald-300 hover:text-emerald-200">Bloquear ahora</button>
              </>
            )}
          </div>
        </form>
      </section>

      {persistentStorage !== "granted" && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          {persistentStorage === "checking"
            ? "Comprobando la protección del almacenamiento…"
            : persistentStorage === "unsupported"
              ? "Este navegador no ofrece almacenamiento persistente. Descarga respaldos JSON con frecuencia."
              : "El navegador no garantizó que conserve los datos del sitio. Descarga respaldos JSON con frecuencia."}
        </p>
      )}
      {storageError && <p role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{storageError}</p>}

      <div className="glass grid gap-3 rounded-3xl p-4 sm:grid-cols-2 sm:p-5">
        <button type="button" onClick={() => handleDownload({ createdAt: new Date().toISOString(), state: database })} className="flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:brightness-110"><Download size={17} />Descargar respaldo completo (.json)</button>
        <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"><FileUp size={17} />Cargar respaldo JSON</button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
      </div>

      <section className="glass space-y-3 rounded-3xl p-4 sm:p-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck size={17} className="text-sky-300" />Respaldo cifrado opcional</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">Usa una contraseña de al menos 10 caracteres. No se guarda en este dispositivo; si la olvidas, no será posible recuperar el archivo.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input type="password" autoComplete="new-password" value={backupPassphrase} onChange={(event) => setBackupPassphrase(event.target.value)} placeholder="Contraseña (mínimo 10 caracteres)" aria-label="Contraseña del respaldo" className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm" />
          <input type="password" autoComplete="new-password" value={backupPassphraseConfirm} onChange={(event) => setBackupPassphraseConfirm(event.target.value)} placeholder="Confirmar contraseña" aria-label="Confirmar contraseña del respaldo" className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm" />
        </div>
        <button type="button" onClick={handleEncryptedDownload} disabled={!backupPassphrase || !backupPassphraseConfirm} className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-300/15 disabled:opacity-50"><LockKeyhole size={16} />Descargar respaldo cifrado con otra clave (.json)</button>
      </section>

      {pendingEncryptedText && (
        <section className="glass space-y-3 rounded-2xl p-4">
          <p className="text-sm text-slate-200">Este archivo está cifrado. Introduce su contraseña para validar el contenido antes de reemplazar tus datos.</p>
          <input type="password" autoComplete="current-password" value={importPassphrase} onChange={(event) => setImportPassphrase(event.target.value)} placeholder="Contraseña del archivo" aria-label="Contraseña del archivo cifrado" className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm" />
          <div className="flex gap-4">
            <button type="button" onClick={handleDecryptImport} disabled={!importPassphrase} className="font-semibold text-emerald-300 disabled:opacity-50">Descifrar y validar</button>
            <button type="button" onClick={() => { setPendingEncryptedText(""); setImportPassphrase(""); }} className="text-slate-400">Cancelar</button>
          </div>
        </section>
      )}

      {pendingImport && (() => {
        const comparison = compareBackup(database, pendingImport);
        const { incoming, current } = comparison;
        return (
          <div className="space-y-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            <p className="font-medium">Archivo verificado. Revisa qué cambiará antes de reemplazar tus datos:</p>
            <table className="w-full text-left text-xs">
              <thead className="text-amber-200/70"><tr><th className="py-1 font-normal"></th><th className="font-normal">Ahora</th><th className="font-normal">Archivo</th></tr></thead>
              <tbody>
                {[
                  ["Clientes", current.clients, incoming.clients],
                  ["Préstamos", current.loans, incoming.loans],
                  ["Cuotas", current.installments, incoming.installments],
                  ["Cobros registrados", current.paid, incoming.paid],
                  ["Cuotas pendientes", current.pending, incoming.pending],
                  ["Operaciones", current.auditEntries, incoming.auditEntries],
                ].map(([label, now, next]) => (
                  <tr key={label} className="border-t border-white/10"><td className="py-1">{label}</td><td>{now}</td><td className={next < now ? "font-semibold text-rose-300" : "font-semibold text-white"}>{next}</td></tr>
                ))}
              </tbody>
            </table>
            {incoming.issues.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-orange-200">
                {incoming.issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            )}
            {(comparison.clientsDelta < 0 || comparison.loansDelta < 0 || comparison.paidDelta < 0) && (
              <p className="text-xs text-rose-300">Atención: el archivo tiene menos datos que la app actual. Se guardará un punto de recuperación antes de reemplazar.</p>
            )}
            <div className="flex gap-4">
              <button type="button" onClick={confirmImport} className="font-semibold text-rose-300 transition hover:text-rose-200">Reemplazar datos</button>
              <button type="button" onClick={() => setPendingImport(null)} className="text-slate-400 transition hover:text-white">Cancelar</button>
            </div>
          </div>
        );
      })()}
      {verified && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{verified}</p>}
      {(error || backupWarning) && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error || backupWarning}</p>}

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200"><History size={16} className="text-sky-300" />Registro de operaciones</h2>
          <p className="mt-1 text-xs text-slate-500">Se conservan hasta 300 operaciones en la base y en el JSON exportado.</p>
        </div>
        {activity.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">Todavía no hay operaciones registradas.</p>
        ) : (
          <ul className="space-y-2">
            {activity.map((entry) => (
              <li key={entry.id} className="glass rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{entry.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{actionLabel(entry.action)}{entry.detail ? ` · ${entry.detail}` : ""}</p>
                  </div>
                  <time className="text-xs text-slate-500">{formatSnapshotDate(entry.createdAt)}</time>
                </div>
                {(entry.before || entry.after) && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-teal-800">Ver detalle conservado</summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {entry.before && <LoanAuditSnapshot title="Antes" loan={entry.before} />}
                      {entry.after && <LoanAuditSnapshot title="Después" loan={entry.after} />}
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="flex items-center gap-2 pt-2 text-sm font-semibold text-slate-200"><DatabaseBackup size={16} className="text-sky-300" />Historial reciente en este dispositivo</h2>
      <ul className="space-y-3">
        {backups.map((snapshot) => (
          <li key={snapshot.id} className="glass rounded-2xl p-4">
            <p className="font-medium text-slate-900">{snapshot.message}</p>
            <p className="mt-1 text-sm text-slate-500">{formatSnapshotDate(snapshot.createdAt)} · {snapshot.clients} clientes · {snapshot.loans} préstamos</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <button type="button" onClick={() => handleDownload(snapshot)} className="inline-flex items-center gap-1.5 font-medium text-emerald-300"><Download size={14} />Descargar</button>
              {pendingId === snapshot.id ? (
                <>
                  <button type="button" onClick={() => handleRestore(snapshot)} className="inline-flex items-center gap-1.5 font-medium text-rose-300"><RotateCcw size={14} />Confirmar restauración</button>
                  <button type="button" onClick={() => setPendingId("")} className="text-slate-500">Cancelar</button>
                </>
              ) : (
                <button type="button" onClick={() => setPendingId(snapshot.id)} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200"><RotateCcw size={14} />Restaurar</button>
              )}
              <button type="button" onClick={() => handleDelete(snapshot.id)} aria-label="Borrar respaldo local" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-rose-300"><Trash2 size={14} />Borrar</button>
            </div>
          </li>
        ))}
      </ul>
      {backups.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Todavía no hay cambios en el historial local.</p>}
    </section>
  );
}

function formatSnapshotDate(value) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return dateOnly ? formatDisplayDate(iso) : `${formatDisplayDate(iso)} ${time}`;
}

function actionLabel(action) {
  const labels = {
    "collect: cuota": "Cobro registrado",
    "revert: cuota": "Cobro revertido",
    "edit: mora": "Mora modificada",
    "create: préstamo": "Préstamo creado",
    "edit: préstamo": "Préstamo editado",
    "delete: préstamo": "Préstamo eliminado",
    "create: cliente": "Cliente creado",
    "edit: cliente": "Cliente editado",
    "delete: cliente": "Cliente eliminado",
    "restore: archivo importado": "Respaldo importado",
    "restore: backup": "Respaldo restaurado",
  };
  return labels[action] ?? action ?? "Cambio";
}

function LoanAuditSnapshot({ title, loan }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="font-medium text-slate-700">{title} · capital {formatMoney(loan.capital)}</p>
      <ul className="mt-2 space-y-1 text-xs text-slate-500">
        {(loan.installments ?? []).map((installment) => (
          <li key={installment.id}>
            Cuota {installment.number} · {installment.status === "paid" ? "cobrada" : "pendiente"} · {formatSnapshotDate(installment.dueDate)}
            {installment.status === "paid" && ` · ${formatMoney(installment.paidAmount)}${installment.paidAt ? ` · pagada ${formatSnapshotDate(installment.paidAt)}` : ""}`}
            {installment.lateFeeCharged > 0 && ` · mora ${formatMoney(installment.lateFeeCharged)}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
