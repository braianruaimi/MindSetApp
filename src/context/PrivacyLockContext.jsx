import { useCallback, useEffect, useMemo, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { PrivacyLockContext } from "./privacyLockContext";
import { createPrivacyConfig, normalizeTimeout, PRIVACY_STORAGE_KEY, readPrivacyConfig, unlockPrivacyConfig, verifyPrivacyPin } from "../services/privacyLock";
import { migrateSnapshots } from "../services/backups";
import { initializeEncryptedStorage } from "../services/storage";

const DEFAULT_TIMEOUT = 5;

export function PrivacyLockProvider({ children }) {
  const [config, setConfig] = useState(readPrivacyConfig);
  const [locked, setLocked] = useState(() => {
    const initial = readPrivacyConfig();
    return Boolean(initial.salt && initial.hash);
  });
  const [prompt, setPrompt] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const enabled = Boolean(config.salt && config.hash);

  const persistConfig = useCallback((next) => {
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(next));
      setConfig(next);
    } catch (storageError) {
      throw new Error(`No se pudo guardar la configuración de privacidad. (${storageError.message})`);
    }
  }, []);

  const setPin = useCallback(async (pin, timeoutMinutes = config.timeoutMinutes ?? DEFAULT_TIMEOUT, currentPin = "") => {
    if (enabled && !(await verifyPrivacyPin(currentPin, config))) throw new Error("El PIN actual no es correcto.");
    const unlocked = await unlockPrivacyConfig(currentPin, config);
    const next = await createPrivacyConfig(pin, timeoutMinutes, unlocked.dataKeyBytes);
    persistConfig(next.config);
    setEncryptionKey(next.key);
    setLocked(false);
  }, [config, enabled, persistConfig]);

  const confirmPin = useCallback((reason) => new Promise((resolve) => {
    setPrompt({ reason, resolve });
  }), []);

  const resolvePrompt = useCallback((result) => {
    setPrompt((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  const unlock = useCallback(async (pin) => {
    const unlocked = await unlockPrivacyConfig(pin, config);
    if (unlocked.config !== config) persistConfig(unlocked.config);
    try {
      await initializeEncryptedStorage(unlocked.key);
    } catch (error) {
      console.error("No se pudo cifrar la base local.", error);
    }
    try {
      await migrateSnapshots(unlocked.key);
    } catch (error) {
      console.error("No se pudo cifrar el historial local.", error);
    }
    setEncryptionKey(unlocked.key);
    setLocked(false);
  }, [config, persistConfig]);

  const updateTimeout = useCallback((minutes) => {
    if (!enabled) return;
    persistConfig({ ...config, timeoutMinutes: normalizeTimeout(minutes) });
  }, [config, enabled, persistConfig]);

  const lock = useCallback(() => {
    if (!enabled) return;
    setEncryptionKey(null);
    setLocked(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || locked) return undefined;
    let timeoutId;
    const lockAfterInactivity = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(lock, (config.timeoutMinutes ?? DEFAULT_TIMEOUT) * 60_000);
    };
    const events = ["pointerdown", "keydown", "touchstart", "mousemove"];
    events.forEach((event) => window.addEventListener(event, lockAfterInactivity, { passive: true }));
    lockAfterInactivity();
    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, lockAfterInactivity));
    };
  }, [config.timeoutMinutes, enabled, locked, lock]);

  const value = useMemo(() => ({
    enabled,
    locked: enabled && locked,
    encryptionKey,
    timeoutMinutes: config.timeoutMinutes ?? DEFAULT_TIMEOUT,
    setPin,
    confirmPin,
    unlock,
    updateTimeout,
    lock,
  }), [config.timeoutMinutes, confirmPin, enabled, encryptionKey, locked, lock, setPin, unlock, updateTimeout]);

  async function verifyPrompt(pin) {
    if (!(await verifyPrivacyPin(pin, config))) throw new Error("El PIN no es correcto.");
    resolvePrompt(pin);
  }

  return (
    <PrivacyLockContext.Provider value={value}>
      {enabled && locked ? <UnlockScreen onUnlock={unlock} /> : children}
      {prompt && !locked && (
        <PinPrompt reason={prompt.reason} onVerify={verifyPrompt} onCancel={() => resolvePrompt(false)} />
      )}
    </PrivacyLockContext.Provider>
  );
}

function PinPrompt({ reason, onVerify, onCancel }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onVerify(pin);
    } catch (verifyError) {
      setError(verifyError.message);
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Confirmar PIN" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="glass w-full max-w-sm space-y-4 rounded-3xl bg-slate-900/90 p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300"><LockKeyhole size={22} /></div>
        <div>
          <h2 className="text-lg font-semibold text-white">Confirma tu PIN</h2>
          <p className="mt-1 text-sm text-slate-400">{reason}</p>
        </div>
        <input
          autoFocus
          autoComplete="current-password"
          inputMode="numeric"
          pattern="[0-9]*"
          type="password"
          value={pin}
          maxLength={6}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
          className="w-full rounded-xl border border-white/10 px-4 py-3 text-center text-xl tracking-[0.4em]"
          aria-label="PIN"
        />
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">Cancelar</button>
          <button disabled={busy || pin.length !== 6} className="flex-1 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? "Verificando…" : "Confirmar"}</button>
        </div>
      </form>
    </div>
  );
}

function UnlockScreen({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onUnlock(pin);
      setPin("");
    } catch (unlockError) {
      setError(unlockError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <form onSubmit={handleSubmit} className="glass w-full max-w-sm space-y-5 rounded-3xl p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300"><LockKeyhole /></div>
        <div>
          <h1 className="text-xl font-semibold text-white">MindSet está bloqueado</h1>
          <p className="mt-2 text-sm text-slate-400">Ingresa tu PIN para continuar.</p>
        </div>
        <input
          autoFocus
          autoComplete="current-password"
          inputMode="numeric"
          pattern="[0-9]*"
          type="password"
          value={pin}
          maxLength={6}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
          className="w-full rounded-xl border border-white/10 px-4 py-3 text-center text-xl tracking-[0.4em]"
          aria-label="PIN"
        />
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <button disabled={busy || pin.length !== 6} className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">
          {busy ? "Verificando…" : "Desbloquear"}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={14} />El PIN cifra los datos locales. Conserva el PIN y un respaldo seguro.</p>
      </form>
    </main>
  );
}
