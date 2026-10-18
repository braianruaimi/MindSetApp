export function parseMoney(value) {
  const raw = String(value ?? "").trim().replace(/\s/g, "").replace(/\$/g, "");
  if (!raw) return Number.NaN;
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replaceAll(".", ""));
  if (/^\d+,\d+$/.test(raw)) return Number(raw.replace(",", "."));
  return Number(raw);
}

export function parseRate(value) {
  const raw = String(value ?? "").trim().replace("%", "").replace(",", ".");
  if (!raw) return Number.NaN;
  return Number(raw);
}

export function roundMoney(value) {
  const amount = typeof value === "number" ? value : parseMoney(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount);
}

export function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(roundMoney(value));
}
