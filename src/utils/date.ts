import i18n from "@/i18n";

/**
 * Month bucket for assets that have no usable creation OR modification date.
 * Sorts to the very end (see the index sort: a missing time collapses to 0) and
 * renders as "Unknown date". A real month key is always `YYYY-MM`, so this
 * sentinel never collides.
 */
export const UNKNOWN_MONTH_KEY = "unknown";

export function getMonthKey(time?: number) {
  const date = time ? new Date(time) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Resolve an asset's sort time AND its month bucket together, so the two can
 * never disagree. `getMonthKey(falsy)` returns the CURRENT month while the index
 * sorts a missing time to the bottom — that mismatch put undated assets in a
 * bogus "current month" section at the END of the gallery ("July 2026" twice).
 * Prefer creationTime; fall back to modificationTime (recovers assets whose
 * creation metadata was lost); otherwise it's genuinely undated → UNKNOWN bucket.
 */
export function resolveMediaDate(
  creationTime?: number,
  modificationTime?: number
): { time?: number; monthKey: string } {
  const time =
    creationTime && creationTime > 0
      ? creationTime
      : modificationTime && modificationTime > 0
        ? modificationTime
        : undefined;
  return { time, monthKey: time ? getMonthKey(time) : UNKNOWN_MONTH_KEY };
}

/** Local-time day key (`YYYY-MM-DD`) — used for per-day quotas/limits. */
export function getDayKey(time?: number) {
  const date = time ? new Date(time) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  if (key === UNKNOWN_MONTH_KEY) return i18n.t("common.unknownDate");
  const [year, month] = key.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return i18n.t("common.unknownDate");
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

/** Weekday + day-of-month, e.g. "Mon 24" — used by the scrubber within a single month. */
export function formatWeekdayDay(time?: number | string) {
  if (!time) return "";
  const date = new Date(time);
  const weekday = date.toLocaleDateString(i18n.language, { weekday: "short" });
  return `${weekday} ${date.getDate()}`;
}

export function formatTime(time?: number | string) {
  if (!time) return "--:--";
  return new Date(time).toLocaleTimeString(i18n.language, {
    hour: "2-digit",
    minute: "2-digit"
  });
}
