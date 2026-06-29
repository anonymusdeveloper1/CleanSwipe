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

// ── Sectioned (month-grouped) gallery layout ────────────────────────────────
// The dense gallery groups photos under per-month text headers, so the list is
// NO LONGER a uniform grid: header rows and photo rows have different heights.
// To keep drag-select hit-testing and the fast-scroll scrubber accurate we
// precompute every row's absolute top offset here (pure, unit-tested) instead
// of trusting the list's internal layout.

/** A full-width month section header row. */
export type GalleryHeaderRow = {
  type: "header";
  /** Stable list key. */
  key: string;
  /** `YYYY-MM` month key (label resolved via `monthLabel` at render). */
  monthKey: string;
  /** Items in the month (full month total). */
  count: number;
  /** Summed `sizeBytes` for the month. */
  bytes: number;
  /** Absolute content-Y of the row's top, in px. */
  top: number;
  /** Row height in px. */
  height: number;
};

/** A row of up to `numColumns` square photo tiles. */
export type GalleryPhotoRow = {
  type: "photos";
  key: string;
  /** Absolute index (into the filtered photo list) of this row's first tile. */
  startIndex: number;
  /** Tiles in this row (1..numColumns; a month's last row may be partial). */
  count: number;
  top: number;
  height: number;
};

export type GalleryRow = GalleryHeaderRow | GalleryPhotoRow;

export type GalleryLayout = {
  /** Flattened header/photo rows in render order (tops strictly increasing). */
  rows: GalleryRow[];
  /** Header top offset per month (ascending) — the scrubber maps scroll↔month. */
  monthOffsets: { key: string; y: number }[];
  /** Total height of all rows in px (excludes any external paddingBottom). */
  contentHeight: number;
  /** Total photo count. */
  total: number;
};

/**
 * Flatten a newest-first photo list into month sections: a header row followed
 * by `ceil(count / numColumns)` photo rows per contiguous month run. Months are
 * grouped by contiguous runs (the media index is creationTime-desc, so months
 * are already contiguous); a rare out-of-order reappearance would start a new
 * section — harmless for geometry. Returns every row's absolute top so callers
 * can hit-test and scrub without measuring the native list.
 */
export function buildGalleryLayout(
  photos: Pick<PhotoAsset, "monthKey" | "sizeBytes">[],
  opts: { numColumns: number; rowHeight: number; headerHeight: number }
): GalleryLayout {
  const { numColumns, rowHeight, headerHeight } = opts;
  const rows: GalleryRow[] = [];
  const monthOffsets: { key: string; y: number }[] = [];
  const total = photos.length;
  if (numColumns < 1 || total === 0) return { rows, monthOffsets, contentHeight: 0, total };

  let top = 0;
  let i = 0;
  while (i < total) {
    const monthKey = photos[i].monthKey;
    const start = i;
    let count = 0;
    let bytes = 0;
    while (i < total && photos[i].monthKey === monthKey) {
      bytes += photos[i].sizeBytes ?? 0;
      count += 1;
      i += 1;
    }
    monthOffsets.push({ key: monthKey, y: top });
    rows.push({ type: "header", key: `h:${monthKey}:${start}`, monthKey, count, bytes, top, height: headerHeight });
    top += headerHeight;
    for (let offset = 0; offset < count; offset += numColumns) {
      const rowCount = Math.min(numColumns, count - offset);
      rows.push({ type: "photos", key: `p:${start + offset}`, startIndex: start + offset, count: rowCount, top, height: rowHeight });
      top += rowHeight;
    }
  }

  return { rows, monthOffsets, contentHeight: top, total };
}

/**
 * Map a touch to an absolute photo index in the sectioned layout, or null when
 * the point misses a real tile (header row, gap past a month's last row, or
 * beyond the columns). `x` is relative to the list's left edge; `contentY` is
 * the absolute content offset (finger-Y + current scrollY). Tiles are square
 * with a `rowHeight` slot pitch, so the column is `floor(x / rowHeight)`.
 */
export function hitTestSectionedIndex(
  x: number,
  contentY: number,
  layout: { rows: GalleryRow[]; numColumns: number; rowHeight: number }
): number | null {
  const { rows, numColumns, rowHeight } = layout;
  if (rows.length === 0 || numColumns < 1 || rowHeight <= 0 || x < 0 || contentY < 0) return null;

  // Binary-search the row whose [top, top+height) band contains contentY.
  let lo = 0;
  let hi = rows.length - 1;
  let row: GalleryRow | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const candidate = rows[mid];
    if (contentY < candidate.top) hi = mid - 1;
    else if (contentY >= candidate.top + candidate.height) lo = mid + 1;
    else {
      row = candidate;
      break;
    }
  }
  if (!row || row.type !== "photos") return null;

  const col = Math.floor(x / rowHeight);
  if (col < 0 || col >= row.count) return null;
  return row.startIndex + col;
}

/**
 * The photo index at a given absolute content offset — used by the scrubber to
 * label the thumb with the DATE of the item at the top of the viewport. Binary-
 * searches the rows; a header offset resolves to that month's first photo.
 * Always returns a valid index in [0, total-1], or -1 when the list is empty.
 */
export function photoIndexAtOffset(offset: number, layout: { rows: GalleryRow[]; total: number }): number {
  const { rows, total } = layout;
  if (total === 0 || rows.length === 0) return -1;
  if (offset <= 0) return 0;

  let lo = 0;
  let hi = rows.length - 1;
  let foundRow = rows.length - 1; // offset past the end → resolve against the last row
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const candidate = rows[mid];
    if (offset < candidate.top) hi = mid - 1;
    else if (offset >= candidate.top + candidate.height) lo = mid + 1;
    else {
      foundRow = mid;
      break;
    }
  }
  // Resolve a header row to its month's first photo row.
  for (let i = foundRow; i < rows.length; i++) {
    if (rows[i].type === "photos") return Math.min(total - 1, (rows[i] as GalleryPhotoRow).startIndex);
  }
  return total - 1;
}
