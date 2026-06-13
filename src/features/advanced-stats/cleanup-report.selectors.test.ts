import { describe, expect, it } from "vitest";
import { CleanupEvent, CleanupEventType } from "@/features/advanced-stats/cleanup-event.types";
import {
  buildCleanupHistory,
  buildCompressionHistory,
  buildReport,
  buildStorageTrend
} from "@/features/advanced-stats/cleanup-report.selectors";

const NOW = 1_700_000_000_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let seq = 0;
function event(type: CleanupEventType, extra: Partial<CleanupEvent> = {}): CleanupEvent {
  const at = extra.at ?? NOW;
  return { id: `${at}-${seq++}`, type, at, ...extra };
}

// Newest-first, like the real ledger.
const events: CleanupEvent[] = [
  event("itemDeleted", { count: 2, bytes: 100 }),
  event("itemCompressed", { bytes: 50 }),
  event("compressionFailed"),
  event("originalDeletedAfterCompression", { count: 1, bytes: 30 }),
  event("smartCleanActionConfirmed", { count: 3, bytes: 200 }),
  event("smartCleanSuggestionViewed"),
  event("itemDeleted", { count: 5, bytes: 9999, at: NOW - 10 * WEEK_MS }) // out of recent windows
];

describe("buildReport", () => {
  it("aggregates counts/bytes within range and treats Smart Clean confirmations as deletions", () => {
    const report = buildReport(events, 0, NOW + 1);
    expect(report.deletedCount).toBe(2 + 5 + 3); // two itemDeleted + smartCleanActionConfirmed
    expect(report.deletedBytes).toBe(100 + 9999 + 200);
    expect(report.compressedCount).toBe(1);
    expect(report.savedBytes).toBe(50);
    expect(report.originalsDeletedCount).toBe(1);
    expect(report.originalsDeletedBytes).toBe(30);
    expect(report.failedCount).toBe(1);
  });

  it("excludes events outside the range", () => {
    const report = buildReport(events, NOW - WEEK_MS, NOW + 1);
    // The 10-weeks-ago itemDeleted (count 5) is excluded.
    expect(report.deletedCount).toBe(2 + 3);
    expect(report.deletedBytes).toBe(100 + 200);
  });

  it("does not count funnel-only events (smartCleanSuggestionViewed)", () => {
    const report = buildReport([event("smartCleanSuggestionViewed", { bytes: 500 })], 0, NOW + 1);
    expect(report).toMatchObject({ deletedCount: 0, deletedBytes: 0, compressedCount: 0 });
  });
});

describe("buildStorageTrend", () => {
  it("sums only actually-reclaimed bytes into the current week bucket", () => {
    const trend = buildStorageTrend(events, NOW, 6);
    expect(trend).toHaveLength(6);
    const current = trend[trend.length - 1];
    expect(current.weeksAgo).toBe(0);
    // itemDeleted(100) + originalDeleted(30) + smartClean(200); compression/failure excluded.
    expect(current.reclaimedBytes).toBe(100 + 30 + 200);
    expect(trend[0].weeksAgo).toBe(5); // oldest first
  });
});

describe("history selectors", () => {
  it("buildCleanupHistory keeps only deletion-type events, newest-first, capped", () => {
    const history = buildCleanupHistory(events, 20);
    expect(history.every((e) => e.type === "itemDeleted" || e.type === "smartCleanActionConfirmed")).toBe(true);
    expect(history).toHaveLength(3); // two itemDeleted + one smartCleanActionConfirmed
    expect(buildCleanupHistory(events, 1)).toHaveLength(1);
  });

  it("buildCompressionHistory keeps only compression-type events", () => {
    const history = buildCompressionHistory(events, 20);
    expect(
      history.every(
        (e) =>
          e.type === "itemCompressed" ||
          e.type === "originalDeletedAfterCompression" ||
          e.type === "compressionFailed"
      )
    ).toBe(true);
    expect(history).toHaveLength(3);
  });
});
