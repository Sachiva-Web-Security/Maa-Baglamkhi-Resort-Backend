// Shared formatting / date-window helpers for the finance report pages.

export function formatINR(amount) {
  const value = Number(amount);
  return `Rs. ${(Number.isFinite(value) ? value : 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function toISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function todayISO() {
  return toISODate(new Date());
}

export function startOfMonthISO() {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function endOfMonthISO() {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

export function formatDay(iso) {
  if (!iso) return "--";
  const stamp = String(iso).slice(0, 10);
  const [y, m, d] = stamp.split("-");
  if (!y || !m || !d) return stamp;
  const date = new Date(`${y}-${m}-${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return stamp;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// Loosest-first matching: the backend spells money columns several different ways.
export function pickNumber(row, keys, fallback = 0) {
  if (!row) return Number(fallback) || 0;
  for (const key of keys) {
    if (key in row && row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== "") {
      const value = Number(row[key]);
      if (Number.isFinite(value)) return value;
    }
  }
  return Number(fallback) || 0;
}

export function pickText(row, keys) {
  if (!row) return "";
  for (const key of keys) {
    if (key in row && row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== "") {
      return String(row[key]);
    }
  }
  return "";
}

export function normalizeDay(value) {
  if (!value) return "";
  if (value instanceof Date) return toISODate(value);
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : toISODate(date);
}
