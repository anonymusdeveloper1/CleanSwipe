import { describe, expect, it } from "vitest";
import { buildGalleryLayout, buildMonthSpans, hitTestGridIndex, hitTestSectionedIndex, photoIndexAtOffset, rangeIndices } from "@/utils/gallery-grid";

const m = (monthKey: string) => ({ monthKey });
const mb = (monthKey: string, sizeBytes = 0) => ({ monthKey, sizeBytes });

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

describe("buildGalleryLayout", () => {
  it("returns an empty layout for no photos", () => {
    expect(buildGalleryLayout([], { numColumns: 3, rowHeight: 100, headerHeight: 40 })).toEqual({
      rows: [],
      monthOffsets: [],
      contentHeight: 0,
      total: 0
    });
  });

  it("emits a header + photo rows per month with absolute tops", () => {
    // 2 in June (1 row of 2) then 4 in May (2 full rows) at 3 columns.
    const photos = [mb("2026-06", 10), mb("2026-06", 20), mb("2026-05"), mb("2026-05"), mb("2026-05"), mb("2026-05")];
    const layout = buildGalleryLayout(photos, { numColumns: 3, rowHeight: 100, headerHeight: 40 });

    expect(layout.rows).toEqual([
      { type: "header", key: "h:2026-06:0", monthKey: "2026-06", count: 2, bytes: 30, top: 0, height: 40 },
      { type: "photos", key: "p:0", startIndex: 0, count: 2, top: 40, height: 100 },
      { type: "header", key: "h:2026-05:2", monthKey: "2026-05", count: 4, bytes: 0, top: 140, height: 40 },
      { type: "photos", key: "p:2", startIndex: 2, count: 3, top: 180, height: 100 },
      { type: "photos", key: "p:5", startIndex: 5, count: 1, top: 280, height: 100 }
    ]);
    expect(layout.monthOffsets).toEqual([
      { key: "2026-06", y: 0 },
      { key: "2026-05", y: 140 }
    ]);
    expect(layout.contentHeight).toBe(380);
    expect(layout.total).toBe(6);
  });
});

describe("hitTestSectionedIndex", () => {
  // 3 columns, 100px square tiles, 40px headers: 2 (June) then 4 (May).
  const layout = buildGalleryLayout(
    [mb("2026-06"), mb("2026-06"), mb("2026-05"), mb("2026-05"), mb("2026-05"), mb("2026-05")],
    { numColumns: 3, rowHeight: 100, headerHeight: 40 }
  );
  const geo = { rows: layout.rows, numColumns: 3, rowHeight: 100 };

  it("maps a tile in the first month's photo row", () => {
    // contentY 40..140 is the June photo row; x 0..100 → col 0 → index 0.
    expect(hitTestSectionedIndex(20, 60, geo)).toBe(0);
    // col 1 → index 1.
    expect(hitTestSectionedIndex(150, 60, geo)).toBe(1);
  });

  it("maps tiles across the second month accounting for the header offset", () => {
    // May photo row 1 starts at top 180; x col 2 → index 2 + 2 = 4.
    expect(hitTestSectionedIndex(250, 200, geo)).toBe(4);
    // May photo row 2 (top 280), col 0 → index 5.
    expect(hitTestSectionedIndex(10, 300, geo)).toBe(5);
  });

  it("returns null over a header row", () => {
    expect(hitTestSectionedIndex(20, 10, geo)).toBeNull(); // June header (0..40)
    expect(hitTestSectionedIndex(20, 150, geo)).toBeNull(); // May header (140..180)
  });

  it("returns null past a month's partial last row and past the columns", () => {
    expect(hitTestSectionedIndex(150, 300, geo)).toBeNull(); // col 1 but row only has 1 tile
    expect(hitTestSectionedIndex(320, 60, geo)).toBeNull(); // col 3 → out of range
  });

  it("returns null below all content and for degenerate geometry", () => {
    expect(hitTestSectionedIndex(20, 9999, geo)).toBeNull();
    expect(hitTestSectionedIndex(20, 60, { rows: layout.rows, numColumns: 3, rowHeight: 0 })).toBeNull();
    expect(hitTestSectionedIndex(20, 60, { rows: [], numColumns: 3, rowHeight: 100 })).toBeNull();
  });
});

describe("photoIndexAtOffset", () => {
  // June (2 photos: rows header@0, photos@40), May (4: header@140, photos@180, @280).
  const layout = buildGalleryLayout(
    [mb("2026-06"), mb("2026-06"), mb("2026-05"), mb("2026-05"), mb("2026-05"), mb("2026-05")],
    { numColumns: 3, rowHeight: 100, headerHeight: 40 }
  );
  const geo = { rows: layout.rows, total: layout.total };

  it("returns 0 at or before the top", () => {
    expect(photoIndexAtOffset(0, geo)).toBe(0);
    expect(photoIndexAtOffset(-50, geo)).toBe(0);
    expect(photoIndexAtOffset(60, geo)).toBe(0); // inside June's photo row
  });

  it("resolves a header offset to that month's first photo", () => {
    expect(photoIndexAtOffset(150, geo)).toBe(2); // May header (140..180) → first May photo
  });

  it("maps deeper offsets to the right photo row", () => {
    expect(photoIndexAtOffset(200, geo)).toBe(2); // May row 1 (180..280)
    expect(photoIndexAtOffset(300, geo)).toBe(5); // May row 2 (280..380)
  });

  it("clamps past-the-end offsets and handles empty", () => {
    expect(photoIndexAtOffset(99999, geo)).toBe(5);
    expect(photoIndexAtOffset(10, { rows: [], total: 0 })).toBe(-1);
  });
});
