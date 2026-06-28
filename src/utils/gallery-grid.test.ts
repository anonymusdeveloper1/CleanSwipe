import { describe, expect, it } from "vitest";
import { buildMonthSpans, hitTestGridIndex, rangeIndices } from "@/utils/gallery-grid";

const m = (monthKey: string) => ({ monthKey });

describe("buildMonthSpans", () => {
  it("returns no spans for an empty list", () => {
    expect(buildMonthSpans([])).toEqual([]);
  });

  it("collapses contiguous months into runs with start index + count", () => {
    const photos = [
      m("2026-06"),
      m("2026-06"),
      m("2026-05"),
      m("2026-05"),
      m("2026-05"),
      m("2026-04")
    ];
    expect(buildMonthSpans(photos)).toEqual([
      { key: "2026-06", startIndex: 0, count: 2 },
      { key: "2026-05", startIndex: 2, count: 3 },
      { key: "2026-04", startIndex: 5, count: 1 }
    ]);
  });

  it("emits a single span per month and strictly increasing start indices", () => {
    const photos = [m("2026-06"), m("2026-05"), m("2026-04")];
    const spans = buildMonthSpans(photos);
    expect(spans.map((s) => s.key)).toEqual(["2026-06", "2026-05", "2026-04"]);
    expect(spans.map((s) => s.startIndex)).toEqual([0, 1, 2]);
  });

  it("folds a non-contiguous reappearance into the original span (no duplicate key)", () => {
    // Out-of-order metadata: 2026-06 reappears after 2026-05.
    const photos = [m("2026-06"), m("2026-05"), m("2026-06"), m("2026-04")];
    const spans = buildMonthSpans(photos);
    expect(spans.map((s) => s.key)).toEqual(["2026-06", "2026-05", "2026-04"]);
    // startIndex stays strictly increasing — required by the scrubber.
    expect(spans.map((s) => s.startIndex)).toEqual([0, 1, 3]);
    // The straggler is counted against the first 2026-06 span.
    expect(spans[0].count).toBe(2);
  });
});

describe("hitTestGridIndex", () => {
  // 3 columns, 100px cells, 10px gap → 5px content inset on every edge.
  const geo = { cellSize: 100, numColumns: 3, gap: 10, total: 12 };

  it("maps the first cell (top-left, no scroll)", () => {
    expect(hitTestGridIndex(20, 20, 0, geo)).toBe(0);
  });

  it("maps a cell in a later column on the first row", () => {
    // x ≈ start of column 2 (5 inset + 2*100 = 205) → col 2, row 0 → index 2.
    expect(hitTestGridIndex(210, 30, 0, geo)).toBe(2);
  });

  it("accounts for scroll offset when computing the row", () => {
    // y 30 + scroll 200 - 5 inset = 225 → row 2; col 0 → index 6.
    expect(hitTestGridIndex(20, 30, 200, geo)).toBe(6);
  });

  it("returns null in the left/top gutter", () => {
    expect(hitTestGridIndex(2, 2, 0, geo)).toBeNull();
  });

  it("returns null past the last column (right gutter / RTL safety)", () => {
    // x beyond 3 columns (5 + 3*100 = 305).
    expect(hitTestGridIndex(320, 20, 0, geo)).toBeNull();
  });

  it("returns null for indices past the last item (partial final row / overscroll)", () => {
    // total 12 → max index 11. Row 4 (y 405) col 0 → index 12 → out of range.
    expect(hitTestGridIndex(20, 410, 0, geo)).toBeNull();
  });

  it("returns null for degenerate geometry", () => {
    expect(hitTestGridIndex(20, 20, 0, { cellSize: 0, numColumns: 3, gap: 10, total: 12 })).toBeNull();
    expect(hitTestGridIndex(20, 20, 0, { cellSize: 100, numColumns: 3, gap: 10, total: 0 })).toBeNull();
  });
});

describe("rangeIndices", () => {
  it("is inclusive and order-independent", () => {
    expect(rangeIndices(2, 5)).toEqual([2, 3, 4, 5]);
    expect(rangeIndices(5, 2)).toEqual([2, 3, 4, 5]);
    expect(rangeIndices(4, 4)).toEqual([4]);
  });
});
