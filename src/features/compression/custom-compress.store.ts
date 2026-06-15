import { create } from "zustand";
import { PhotoAsset } from "@/models/photo";

/**
 * Tiny, non-persisted store that carries a USER-PICKED file into the compress-run
 * screen. A custom file is NOT in the media index, so compress-run can't resolve
 * it by id from `useMediaIndexStore`; instead the picker stores the synthetic
 * PhotoAsset here (id `custom:<uri>`) and compress-run reads it as a fallback.
 *
 * Custom files are Keep-only (the "original" is a picker cache copy, not a
 * managed library asset), so the compress-run delete-original path is skipped.
 */
type CustomCompressStore = {
  target?: PhotoAsset;
  setTarget: (asset: PhotoAsset) => void;
  clear: () => void;
};

export const useCustomCompressStore = create<CustomCompressStore>((set) => ({
  target: undefined,
  setTarget: (asset) => set({ target: asset }),
  clear: () => set({ target: undefined })
}));
