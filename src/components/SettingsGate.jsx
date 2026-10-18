import { useState } from "react";
import { hasSettingsPin, isSettingsUnlocked, lockSettings, saveSettingsPin, unlockSettings } from "../services/settingsLock";

export function SettingsGate({ children }) {
  const [hasPin, setHasPin] = useState(() => hasSettingsPin());
  const [unlocked, setUnlocked] = useState(() => isSettingsUnlocked());
  const [changing, setChanging] = useState(false);

  if (!unlocked) {
    return (
      <PinForm
        title={hasPin ? "Ajustes protegidos" : "Protegé la configuración"}
        text={hasPin ? "Ingresá el PIN para ver el token y los backups." : "Creá un PIN de 4 a 6 dígitos. Se pide de nuevo en cada sesión."}
        submitLabel={hasPin ? "Desbloquear" : "Crear PIN"}
        requireCurrent={false}
        onSubmit={async (pin) => {
          if (hasPin) {
            const valid = await unlockSettings(pin);
            if (!valid) throw new Error("El PIN no coincide.");
          } else {
            await saveSettingsPin(pin);
            setHasPin(true);
          }
          setUnlocked(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-3 text-sm">
        <button type="button" onClick={() => setChanging((current) => !current)} className="font-medium text-teal-800">
          {changing ? "Cerrar" : "Cambiar PIN"}
        </button>
        <button type="button" onClick={() => { lockSettings(); setUnlocked(false); setChanging(false); }} className="text-slate-500">
          Bloquear
        </button>
      </div>
      {changing && (
        <PinForm
          title="Nuevo PIN"
          text="Confirmá el PIN actual y elegí uno nuevo."
          submitLabel="Actualizar PIN"
          requireCurrent
          onSubmit={async (pin, currentPin) => {
            await saveSettingsPin(pin, currentPin);
            setChanging(false);
          }}
        />
      )}
      {children}
    </div>
  );
}

function PinForm({ title, text, submitLabel, requireCurrent, onSubmit }) {
  const [pin, setPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(pin, currentPin);
      setPin("");
      setCurrentPin("");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-600">{text}</p>
      {requireCurrent && <PinField label="PIN actual" value={currentPin} onChange={setCurrentPin} />}
      <PinField label={requireCurrent ? "PIN nuevo" : "PIN"} value={pin} onChange={setPin} />
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">
        {saving ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}

function PinField({ label, value, onChange }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="\d{4,6}"
        minLength={4}
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 tracking-[0.3em] outline-none ring-teal-700 focus:ring-2"
        required
      />
    </label>
  );
}
