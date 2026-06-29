import { create } from "zustand";
import { MediaTypeFilter } from "@/models/photo";

/**
 * The Compress screen's month + media-type filter. A tiny non-persisted store so
 * the filter can live in a native form-sheet route (`/compress-filter`) while the
 * Compress grid (history-screen) reads the same selection.
 */
type CompressFilterState = {
  monthKey: string;
  mediaType: MediaTypeFilter;
  /** Changing the media type resets the month (a month may not exist in the new scope). */
  setMediaType: (mediaType: MediaTypeFilter) => void;
  setMonthKey: (monthKey: string) => void;
};

export const useCompressFilterStore = create<CompressFilterState>((set) => ({
  monthKey: "all",
  mediaType: "all",
  setMediaType: (mediaType) => set({ mediaType, monthKey: "all" }),
  setMonthKey: (monthKey) => set({ monthKey })
}));
