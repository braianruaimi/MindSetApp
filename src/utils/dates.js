export function parseISODate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISODate(now = new Date()) {
  return formatISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addMonths(isoDate, months) {
  const date = parseISODate(isoDate);
  if (!date) throw new Error("La fecha no es válida.");

  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return formatISODate(target);
}

export function daysAfter(isoDate, today = todayISODate()) {
  const due = parseISODate(isoDate);
  const current = parseISODate(today);
  if (!due || !current) return 0;
  const utcDue = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const utcCurrent = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
  return Math.round((utcCurrent - utcDue) / 86_400_000);
}

export function monthCells(year, month) {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => formatISODate(new Date(year, month, index + 1))),
  ];
}

export function formatDisplayDate(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) return isoDate || "—";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
