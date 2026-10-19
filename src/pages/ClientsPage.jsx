import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AtSign, MapPin, Pencil, Phone, Plus, Search, StickyNote, Trash2, UserRound, X } from "lucide-react";
import { useAppState } from "../context/AppStateContext";
import { clientName, removeClient, saveClient } from "../services/clients";

const EMPTY_FORM = {
  id: "",
  firstName: "",
  lastName: "",
  phone: "",
  dni: "",
  address: "",
  instagram: "",
  notes: "",
};

export function ClientsPage() {
  const { database, commit } = useAppState();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");

  const clients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...(database.clients ?? [])]
      .sort((a, b) => clientName(a).localeCompare(clientName(b), "es"))
      .filter((client) => {
        if (!normalizedQuery) return true;
        return [clientName(client), client.dni, client.phone, client.address, client.instagram, client.notes]
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
      instagram: client.instagram ?? "",
      notes: client.notes ?? "",
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

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Cartera</p>
          <h1 className="text-2xl font-semibold text-white">Clientes</h1>
          <p className="mt-1 text-sm text-slate-400">{database.clients.length} registrados</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:brightness-110">
          <Plus size={18} /> <span className="hidden sm:inline">Nuevo cliente</span><span className="sm:hidden">Nuevo</span>
        </button>
      </header>

      <label className="relative block">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, DNI o teléfono"
          className="w-full rounded-2xl border border-white/10 bg-slate-900/50 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10"
        />
      </label>

      {form && (
        <form onSubmit={handleSubmit} className="glass space-y-4 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300"><UserRound size={20} /></span>
            <div>
              <h2 className="font-semibold text-white">{form.id ? "Editar cliente" : "Nuevo cliente"}</h2>
              <p className="text-xs text-slate-400">Completa los datos de contacto e identificación</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" name="firstName" value={form.firstName} onChange={updateField} required />
            <Field label="Apellido" name="lastName" value={form.lastName} onChange={updateField} required />
            <Field label="Teléfono" name="phone" value={form.phone} onChange={updateField} inputMode="tel" required />
            <Field label="DNI" name="dni" value={form.dni} onChange={updateField} inputMode="numeric" required />
          </div>
          <Field label="Dirección" name="address" value={form.address} onChange={updateField} required />
          <Field label="Instagram" name="instagram" value={form.instagram} onChange={updateField} placeholder="@usuario" autoCapitalize="none" />
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-slate-300">Notas</span>
            <textarea name="notes" value={form.notes} onChange={updateField} rows={3} className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10" />
          </label>
          {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110">
              <UserRound size={16} /> Guardar cliente
            </button>
            <button type="button" onClick={() => setForm(null)} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5">
              <X size={16} /> Cancelar
            </button>
          </div>
        </form>
      )}

      {!form && error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {clients.map((client) => (
          <motion.li key={client.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} className="glass rounded-2xl p-4 transition">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sm font-semibold uppercase text-sky-300">
                {`${client.firstName?.[0] ?? ""}${client.lastName?.[0] ?? ""}`}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{clientName(client)}</p>
                <p className="mt-1 text-xs text-slate-400">DNI {client.dni}</p>
              </div>
              <button type="button" aria-label={`Editar ${clientName(client)}`} onClick={() => openEdit(client)} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-emerald-300">
                <Pencil size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm text-slate-400">
              <p className="flex items-center gap-2"><Phone size={14} className="text-slate-500" />{client.phone}</p>
              <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-500" />{client.address}</p>
                            {client.instagram && (
                              <p className="flex items-center gap-2"><AtSign size={14} className="text-slate-500" />
                                <a href={`https://instagram.com/${encodeURIComponent(client.instagram)}`} target="_blank" rel="noreferrer" className="hover:text-emerald-300">{client.instagram}</a>
                              </p>
                            )}
                            {client.notes && <p className="flex items-start gap-2 whitespace-pre-line"><StickyNote size={14} className="mt-0.5 shrink-0 text-slate-500" />{client.notes}</p>}
                          </div>
            <div className="mt-3 min-h-8">
              {pendingDeleteId === client.id ? (
                <div className="flex items-center gap-3 text-sm">
                  <button type="button" onClick={() => handleDelete(client.id)} className="font-medium text-rose-300 hover:text-rose-200">
                    Confirmar eliminación
                  </button>
                  <button type="button" onClick={() => setPendingDeleteId("")} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-300">
                    <X size={14} /> Cancelar
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setPendingDeleteId(client.id)} className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-rose-300">
                  <Trash2 size={14} /> Eliminar cliente
                </button>
              )}
            </div>
          </motion.li>
        ))}
      </ul>

      {clients.length === 0 && (
        <div className="glass flex flex-col items-center rounded-3xl border-dashed px-5 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400"><UserRound size={22} /></span>
          <p className="mt-3 font-medium text-slate-200">{query ? "Sin resultados" : "Tu cartera empieza aquí"}</p>
          <p className="mt-1 text-sm text-slate-400">{query ? "No encontramos clientes con esos datos." : "Agrega tu primer cliente para empezar a gestionar préstamos."}</p>
          {!query && <button type="button" onClick={openCreate} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-300"><Plus size={16} />Crear cliente</button>}
        </div>
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
      <span className="font-medium text-slate-300">{label}</span>
      <input {...props} className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10" />
    </label>
  );
}
