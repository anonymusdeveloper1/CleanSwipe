import { create } from "zustand";
import { PhotoAsset } from "@/models/photo";

/**
 * Tiny, non-persisted store that carries a USER-PICKED file into the
 * convert-run screen — the mirror of `useCustomCompressStore`. A picked file is
 * NOT in the media index, so convert-run can't resolve it by id; the picker
 * stores the synthetic PhotoAsset here (id `custom:<uri>`) and convert-run reads
 * it as a fallback.
 */
type CustomConvertStore = {
  target?: PhotoAsset;
  setTarget: (asset: PhotoAsset) => void;
  clear: () => void;
};

export const useCustomConvertStore = create<CustomConvertStore>((set) => ({
  target: undefined,
  setTarget: (asset) => set({ target: asset }),
  clear: () => set({ target: undefined })
}));
