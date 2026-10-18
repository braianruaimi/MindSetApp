import { useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";
import { clientName, removeClient, saveClient } from "../services/clients";

const EMPTY_FORM = {
  id: "",
  firstName: "",
  lastName: "",
  phone: "",
  dni: "",
  address: "",
};

export function ClientsPage({ onOpenSettings }) {
  const { database, status, remoteMissing, syncing, commit } = useAppState();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const ready = status === "ready" && !remoteMissing;

  const clients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...(database.clients ?? [])]
      .sort((a, b) => clientName(a).localeCompare(clientName(b), "es"))
      .filter((client) => {
        if (!normalizedQuery) return true;
        return [clientName(client), client.dni, client.phone, client.address]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [database.clients, query]);

  function openCreate() {
    setError("");
    setForm(EMPTY_FORM);
  }

  function openEdit(client) {
    setError("");
    setPendingDeleteId("");
    setForm({
      id: client.id,
      firstName: client.firstName ?? "",
      lastName: client.lastName ?? "",
      phone: client.phone ?? "",
      dni: client.dni ?? "",
      address: client.address ?? "",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      const editing = Boolean(form.id);
      await commit((current) => saveClient(current, form), editing ? "edit: cliente" : "create: cliente");
      setForm(null);
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleDelete(clientId) {
    setError("");
    try {
      await commit((current) => removeClient(current, clientId), "delete: cliente");
      setPendingDeleteId("");
      setForm(null);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  if (status === "unconfigured") {
    return (
      <EmptyState
        title="Falta la configuración"
        text="Conecta el repositorio privado antes de cargar clientes."
        actionLabel="Abrir configuración"
        onAction={onOpenSettings}
      />
    );
  }

  if (remoteMissing) {
    return (
      <EmptyState
        title="Falta database.json"
        text="Crea el archivo remoto desde Inicio antes de guardar clientes."
      />
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-600">{database.clients.length} registrados</p>
        </div>
        <button type="button" onClick={openCreate} disabled={!ready || syncing} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">
          Nuevo
        </button>
      </header>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por nombre, DNI o teléfono"
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none ring-teal-700 focus:ring-2"
      />

      {form && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-medium text-slate-900">{form.id ? "Editar cliente" : "Nuevo cliente"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" name="firstName" value={form.firstName} onChange={updateField} required />
            <Field label="Apellido" name="lastName" value={form.lastName} onChange={updateField} required />
            <Field label="Teléfono" name="phone" value={form.phone} onChange={updateField} inputMode="tel" required />
            <Field label="DNI" name="dni" value={form.dni} onChange={updateField} inputMode="numeric" required />
          </div>
          <Field label="Dirección" name="address" value={form.address} onChange={updateField} required />
          {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={syncing} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">
              {syncing ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!form && error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <ul className="space-y-3">
        {clients.map((client) => (
          <li key={client.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{clientName(client)}</p>
                <p className="mt-1 text-sm text-slate-600">DNI {client.dni} · {client.phone}</p>
                <p className="mt-1 text-sm text-slate-500">{client.address}</p>
              </div>
              <button type="button" onClick={() => openEdit(client)} className="text-sm font-medium text-teal-800">
                Editar
              </button>
            </div>
            <div className="mt-3">
              {pendingDeleteId === client.id ? (
                <div className="flex gap-3 text-sm">
                  <button type="button" onClick={() => handleDelete(client.id)} disabled={syncing} className="font-medium text-rose-700 disabled:opacity-60">
                    Confirmar eliminación
                  </button>
                  <button type="button" onClick={() => setPendingDeleteId("")} className="text-slate-500">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setPendingDeleteId(client.id)} className="text-sm text-slate-500">
                  Eliminar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {clients.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          {query ? "Ningún cliente coincide con la búsqueda." : "Todavía no hay clientes."}
        </p>
      )}
    </section>
  );

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }
}

function Field({ label, ...props }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input {...props} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none ring-teal-700 focus:ring-2" />
    </label>
  );
}

function EmptyState({ title, text, actionLabel, onAction }) {
  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
      {actionLabel && (
        <button type="button" onClick={onAction} className="mt-4 rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white">
          {actionLabel}
        </button>
      )}
    </section>
  );
}
