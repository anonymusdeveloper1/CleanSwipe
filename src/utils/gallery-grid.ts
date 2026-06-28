import { PhotoAsset } from "@/models/photo";

/**
 * Pure geometry/grouping helpers for the dense gallery grid (selected-photos
 * screen). Deliberately free of i18n/native imports so they stay unit-testable
 * — the scrubber resolves `key` → localized label via `monthLabel` at render.
 */

/** A contiguous run of one month within a newest-first photo list. */
export type MonthSpan = {
  /** `YYYY-MM` month key. */
  key: string;
  /** Absolute index of the run's first item in the (filtered) photo list. */
  startIndex: number;
  /** Number of items in the run. */
  count: number;
};

/**
 * Collapse a newest-first photo list into contiguous month runs for the
 * fast-scroll scrubber. The media index is sorted by creationTime desc, so
 * months are normally already contiguous. Guard: if a monthKey reappears after
 * a gap (out-of-order metadata), we fold those stragglers into the FIRST span
 * for that month rather than emitting a second, non-contiguous entry — the
 * scrubber needs a strictly increasing, de-duplicated startIndex list.
 */
export function buildMonthSpans(photos: Pick<PhotoAsset, "monthKey">[]): MonthSpan[] {
  const spans: MonthSpan[] = [];
  const indexByKey = new Map<string, number>();

  for (let i = 0; i < photos.length; i++) {
    const key = photos[i].monthKey;
    const last = spans[spans.length - 1];
    if (last && last.key === key) {
      last.count += 1;
      continue;
    }
    const existing = indexByKey.get(key);
    if (existing !== undefined) {
      // Non-contiguous reappearance — count it against the original span.
      spans[existing].count += 1;
      continue;
    }
    indexByKey.set(key, spans.length);
    spans.push({ key, startIndex: i, count: 1 });
  }

  return spans;
}

export type GridGeometry = {
  /** Square cell edge in px (includes neither inter-cell gap; gap is added via padding). */
  cellSize: number;
  numColumns: number;
  /** Gap between cells in px; the content container is inset by gap/2 on every edge. */
  gap: number;
  /** Total item count (to reject hits in a partial final row / overscroll). */
  total: number;
};

/**
 * Map a touch point to the absolute grid index, or null when the point misses a
 * real cell. `x`/`y` are relative to the LIST's top-left; `scrollY` is the
 * current vertical content offset. Assumes a uniform square grid whose content
 * container is inset by `gap/2` on every edge (so cell column = floor((x-gap/2)/cellSize)).
 * Rejects: left/top gutter, columns past the grid, and indices past the last item.
 */
export function hitTestGridIndex(x: number, y: number, scrollY: number, geo: GridGeometry): number | null {
  const { cellSize, numColumns, gap, total } = geo;
  if (cellSize <= 0 || numColumns <= 0 || total <= 0) return null;

  const pad = gap / 2;
  const localX = x - pad;
  const localY = y + scrollY - pad;
  if (localX < 0 || localY < 0) return null;

  const col = Math.floor(localX / cellSize);
  if (col < 0 || col >= numColumns) return null;

  const row = Math.floor(localY / cellSize);
  const index = row * numColumns + col;
  if (index < 0 || index >= total) return null;
  return index;
}

/** Inclusive integer range between two indices (order-independent). */
export function rangeIndices(a: number, b: number): number[] {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) out.push(i);
  return out;
}
