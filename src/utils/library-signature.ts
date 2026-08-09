/**
 * A cheap "has the device library changed?" fingerprint.
 *
 * WHY: new media (a download, a screenshot, a camera capture) has to show up in
 * the app the moment it lands, the way the system gallery does. Two things stood
 * in the way:
 *
 *  1. `MediaLibrary.addListener` is not a reliable instant signal. On Android the
 *     native observer only emits when the TOTAL ASSET COUNT for a media type
 *     changes (see `MediaStoreContentObserver.onChange` in expo-media-library
 *     18.2.1) — so an add+delete in the same window, a staged/pending MediaStore
 *     insert, or a count query racing the insert can swallow the event entirely.
 *     On iOS the event is richer but still not guaranteed to be prompt.
 *  2. The fallback poll ran every 45 s and did a FULL reconcile — a permission
 *     read plus a newest-page fetch that calls `getAssetInfoAsync` once per
 *     asset (80 native round-trips). Far too expensive to run often, which is
 *     exactly why it was set so slow.
 *
 * The fix is to separate DETECTION from RECONCILIATION. This fingerprint is one
 * `getAssetsAsync({ first: 1 })` — a single query, no per-asset info calls — so
 * it can run every few seconds for effectively nothing, and the expensive
 * reconcile only runs when it actually reports a change.
 *
 * Platform-neutral by construction: it uses only fields expo-media-library
 * returns on both Android and iOS, so there is no per-platform branch anywhere.
 */
export type LibrarySignature = {
  /** Total assets matching the query. Catches adds AND deletes. */
  totalCount: number;
  /** Newest asset id. Catches a same-count swap (one added, one removed). */
  newestId?: string;
  /**
   * Newest asset's modification time. Catches an in-place edit (crop, markup)
   * that changes neither the count nor the newest id.
   */
  newestModificationTime?: number;
};

/**
 * True when `next` describes a library state that differs from `previous`.
 *
 * A missing `previous` returns FALSE: the first probe after attaching only seeds
 * the baseline, it must not trigger a redundant refresh on top of the launch
 * reconcile that just ran.
 */
export function librarySignatureChanged(previous: LibrarySignature | undefined, next: LibrarySignature): boolean {
  if (!previous) return false;
  return (
    previous.totalCount !== next.totalCount ||
    previous.newestId !== next.newestId ||
    previous.newestModificationTime !== next.newestModificationTime
  );
}
