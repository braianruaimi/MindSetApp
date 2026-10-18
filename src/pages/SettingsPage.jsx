import { useState } from "react";
import { SettingsGate } from "../components/SettingsGate";
import { useAppState } from "../context/AppStateContext";
import { testGithubConnection } from "../services/githubSync";

const INITIAL_FORM = {
  token: "",
  username: "",
  repo: "",
  branch: "main",
};

export function SettingsPage({ onOpenBackups }) {
  const { config, saveConfig, disconnect, status, syncing } = useAppState();
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    username: config?.owner ?? "",
    repo: config?.repo ?? "",
    branch: config?.branch ?? "main",
  }));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleTest(event) {
    event.preventDefault();
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const result = await testGithubConnection({
        ...form,
        token: form.token || config?.token,
      });
      const visibility = result.private ? "privado" : "público";
      setMessage(`Conexión correcta con ${result.fullName} (${visibility}). Rama por defecto: ${result.defaultBranch}.`);
    } catch (testError) {
      setError(testError.message);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await saveConfig({
        token: form.token || config?.token,
        username: form.username,
        repo: form.repo,
        branch: form.branch,
      });
      setForm((current) => ({ ...current, token: "" }));
      setMessage("Configuración guardada en este navegador. La base se está leyendo desde GitHub.");
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
      <SettingsGate>
      <section className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
        <p className="text-sm leading-6 text-slate-600">
          El token queda solo en el almacenamiento local de este dispositivo. Usa un repositorio privado y un PAT con permiso de contenido.
        </p>
      </header>

      <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={handleSave}>
        <Field
          label="Personal Access Token"
          name="token"
          type="password"
          value={form.token}
          onChange={updateField}
          placeholder={config ? "Dejar vacío para conservar el token guardado" : "github_pat_..."}
          autoComplete="off"
          required={!config}
        />
        <Field label="Usuario de GitHub" name="username" value={form.username} onChange={updateField} placeholder="tu-usuario" required />
        <Field label="Repositorio privado" name="repo" value={form.repo} onChange={updateField} placeholder="prestamos-db" required />
        <Field label="Rama" name="branch" value={form.branch} onChange={updateField} placeholder="main" required />

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={syncing || status === "loading"} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">
            Guardar y sincronizar
          </button>
          <button type="button" onClick={handleTest} disabled={testing} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60">
            {testing ? "Probando..." : "Probar conexión"}
          </button>
        </div>
      </form>

      {message && <p className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">{message}</p>}
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="flex flex-col gap-3">
              <button type="button" onClick={onOpenBackups} className="w-fit rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                Historial de backups
        </button>
              {config && (
                <button type="button" onClick={disconnect} className="w-fit text-sm font-medium text-rose-700">
                  Olvidar configuración de este navegador
                </button>
              )}
            </div>
    </section>
        </SettingsGate>
      );
    }

function Field({ label, ...props }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input {...props} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none ring-teal-700 focus:ring-2" />
    </label>
  );
}
