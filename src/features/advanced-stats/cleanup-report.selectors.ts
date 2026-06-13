import { CleanupEvent, CleanupReport, StorageTrendBucket } from "@/features/advanced-stats/cleanup-event.types";

/**
 * PURE report derivations over the cleanup events ledger. No React, no store
 * import — each is a single O(n) pass with `?? 0` / `?? 1` guards so optional
 * fields never produce NaN. Consume these via useMemo over the stable `events`
 * array (mirrors buildSubscriptionSnapshot) — never inside a Zustand selector.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function emptyReport(): CleanupReport {
  return {
    deletedCount: 0,
    deletedBytes: 0,
    compressedCount: 0,
    savedBytes: 0,
    originalsDeletedCount: 0,
    originalsDeletedBytes: 0,
    failedCount: 0
  };
}

/** Aggregate counting/byte totals for events whose `at` is within [start, end]. */
export function buildReport(events: CleanupEvent[], rangeStart: number, rangeEnd: number): CleanupReport {
  const report = emptyReport();
  for (const event of events) {
    if (event.at < rangeStart || event.at > rangeEnd) continue;
    const count = event.count ?? 1;
    const bytes = event.bytes ?? 0;
    switch (event.type) {
      case "itemDeleted":
        report.deletedCount += count;
        report.deletedBytes += bytes;
        break;
      case "itemCompressed":
        report.compressedCount += count;
        report.savedBytes += bytes;
        break;
      case "originalDeletedAfterCompression":
        report.originalsDeletedCount += count;
        report.originalsDeletedBytes += bytes;
        break;
      case "compressionFailed":
        report.failedCount += count;
        break;
      case "smartCleanActionConfirmed":
        // A confirmed Smart Clean deletion IS a real reclamation (it suppresses
        // permanentlyDeleteMarked's itemDeleted event), so it counts toward
        // items removed / space reclaimed.
        report.deletedCount += count;
        report.deletedBytes += bytes;
        break;
      default:
        // smartCleanSuggestionViewed is a funnel event; not part of totals.
        break;
    }
  }
  return report;
}

export function buildWeeklyReport(events: CleanupEvent[], now: number): CleanupReport {
  return buildReport(events, now - WEEK_MS, now);
}

/** Rolling 30-day window (not calendar month) so it always reflects recent activity. */
export function buildMonthlyReport(events: CleanupEvent[], now: number): CleanupReport {
  return buildReport(events, now - 30 * DAY_MS, now);
}

/**
 * Fixed-length, zero-filled weekly buckets ordered oldest -> newest so the
 * trend has a stable X axis even with sparse data. reclaimedBytes sums space
 * ACTUALLY freed: manual deletes + Smart Clean deletions + originals deleted
 * after compression (whose bytes equal the net savedBytes). itemCompressed is
 * intentionally excluded — compression alone (original kept) frees nothing, and
 * counting it alongside originalDeletedAfterCompression would double-count a
 * compress+delete.
 */
export function buildStorageTrend(events: CleanupEvent[], now: number, buckets = 6): StorageTrendBucket[] {
  const totalsByWeeksAgo = new Array<number>(buckets).fill(0);
  const windowStart = now - buckets * WEEK_MS;
  for (const event of events) {
    if (event.at < windowStart || event.at > now) continue;
    if (
      event.type !== "itemDeleted" &&
      event.type !== "originalDeletedAfterCompression" &&
      event.type !== "smartCleanActionConfirmed"
    ) {
      continue;
    }
    const weeksAgo = Math.min(buckets - 1, Math.max(0, Math.floor((now - event.at) / WEEK_MS)));
    totalsByWeeksAgo[weeksAgo] += event.bytes ?? 0;
  }
  // Oldest first: index 0 => (buckets-1) weeks ago, last => this week.
  return Array.from({ length: buckets }, (_unused, index) => {
    const weeksAgo = buckets - 1 - index;
    return { weeksAgo, reclaimedBytes: totalsByWeeksAgo[weeksAgo] };
  });
}

const CLEANUP_HISTORY_TYPES = new Set<CleanupEvent["type"]>(["itemDeleted", "smartCleanActionConfirmed"]);
const COMPRESSION_HISTORY_TYPES = new Set<CleanupEvent["type"]>([
  "itemCompressed",
  "originalDeletedAfterCompression",
  "compressionFailed"
]);

/** Events are already stored newest-first, so filter + slice preserves order. */
export function buildCleanupHistory(events: CleanupEvent[], limit = 20): CleanupEvent[] {
  return events.filter((event) => CLEANUP_HISTORY_TYPES.has(event.type)).slice(0, limit);
}

export function buildCompressionHistory(events: CleanupEvent[], limit = 20): CleanupEvent[] {
  return events.filter((event) => COMPRESSION_HISTORY_TYPES.has(event.type)).slice(0, limit);
}
