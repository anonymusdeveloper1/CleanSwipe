import i18n from "@/i18n";

export function getMonthKey(time?: number) {
  const date = time ? new Date(time) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Local-time day key (`YYYY-MM-DD`) — used for per-day quotas/limits. */
export function getDayKey(time?: number) {
  const date = time ? new Date(time) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1).toLocaleDateString(i18n.language, {
    month: "long",
    year: "numeric"
  });
}

export function formatDate(time?: number | string) {
  if (!time) return i18n.t("common.unknownDate");
  return new Date(time).toLocaleDateString(i18n.language, {
    month: "short",
    day: "2-digit",
    year: "numeric"
  });
}

export function formatTime(time?: number | string) {
  if (!time) return "--:--";
  return new Date(time).toLocaleTimeString(i18n.language, {
    hour: "2-digit",
    minute: "2-digit"
  });
}
