const pad = (n) => String(n).padStart(2, "0");

export const localDate = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const localMonth = (value = new Date()) => localDate(value).slice(0, 7);

export const localDateTime = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
