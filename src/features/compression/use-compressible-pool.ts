import { useMemo } from "react";
import { useCompressionStore } from "@/features/compression/compression.store";
import { useAppStore } from "@/store/app-store";
import { useIndexedMediaAssets } from "@/store/media-index-store";

/**
 * The pool of compressible media not yet compressed — the single source the
 * Compress grid and the Compress filter sheet both draw from. Shared so the two
 * stay in sync (a month only appears in the filter if it has compressible items).
 * `doneSourceIds` (already-compressed source ids) is returned too for callers
 * that need to exclude them elsewhere.
 */
export function useCompressiblePool() {
  const photos = useIndexedMediaAssets();
  const compressedMedia = useAppStore((state) => state.compressedMedia);
  const completedCompressionMediaIds = useCompressionStore((state) => state.completedMediaIds);

  const doneSourceIds = useMemo(() => {
    const ids = new Set(compressedMedia.map((item) => item.sourceId));
    Object.keys(completedCompressionMediaIds).forEach((id) => ids.add(id));
    return ids;
  }, [completedCompressionMediaIds, compressedMedia]);

  const pool = useMemo(() => photos.filter((photo) => photo.compressible && !doneSourceIds.has(photo.id)), [doneSourceIds, photos]);

  return { pool, doneSourceIds };
}
