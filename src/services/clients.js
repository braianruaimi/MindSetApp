export function saveClient(database, input) {
  const client = normalizeClient(input);
  const clients = database.clients ?? [];
  const duplicate = clients.find((item) => item.dni === client.dni && item.id !== client.id);

  if (duplicate) {
    throw new Error("Ya existe un cliente con ese DNI.");
  }

  const now = new Date().toISOString();
  const exists = clients.some((item) => item.id === client.id);
  const nextClient = exists
    ? { ...clients.find((item) => item.id === client.id), ...client, updatedAt: now }
    : { ...client, id: client.id || crypto.randomUUID(), createdAt: now, updatedAt: now };

  return {
    ...database,
    clients: exists
      ? clients.map((item) => (item.id === nextClient.id ? nextClient : item))
      : [nextClient, ...clients],
  };
}

export function removeClient(database, clientId) {
  const hasLoans = (database.loans ?? []).some((loan) => loan.clientId === clientId);
  if (hasLoans) {
    throw new Error("No se puede eliminar un cliente que tiene préstamos.");
  }

  return {
    ...database,
    clients: (database.clients ?? []).filter((client) => client.id !== clientId),
  };
}

export function clientName(client) {
  return [client?.firstName, client?.lastName].filter(Boolean).join(" ");
}

function normalizeClient(input) {
  const client = {
    id: String(input?.id ?? "").trim(),
    firstName: clean(input?.firstName),
    lastName: clean(input?.lastName),
    phone: clean(input?.phone),
    dni: clean(input?.dni).replace(/[.\s]/g, ""),
    address: clean(input?.address),
    instagram: clean(input?.instagram).replace(/^@+/, ""),
    notes: String(input?.notes ?? "").trim(),
  };

  if (!client.firstName || !client.lastName) {
    throw new Error("El nombre y el apellido son obligatorios.");
  }
  if (!client.phone) {
    throw new Error("El teléfono es obligatorio.");
  }
  if (!client.dni) {
    throw new Error("El DNI es obligatorio.");
  }
  if (!client.address) {
    throw new Error("La dirección es obligatoria.");
  }

  return client;
}

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
