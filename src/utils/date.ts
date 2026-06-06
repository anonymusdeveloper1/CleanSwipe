export function getMonthKey(time?: number) {
  const date = time ? new Date(time) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
}

export function formatDate(time?: number | string) {
  if (!time) return "Unknown date";
  return new Date(time).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric"
  });
}

export function formatTime(time?: number | string) {
  if (!time) return "--:--";
  return new Date(time).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
}
