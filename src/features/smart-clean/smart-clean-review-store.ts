import { create } from "zustand";
import { SmartCleanGroup } from "@/features/smart-clean/smart-clean.types";

/**
 * Tiny, non-persisted store that drives the Smart Clean review flow. Smart
 * Clean's "Review" actions set the target here, then push the full-screen
 * `SmartCleanReviewScreen` (route `/smart-clean-review`), which renders from this
 * state. (It used to be a root-mounted bottom sheet, but FlashList won't
 * recycle/measure inside an animated content-sized overlay — it collapsed to 0
 * height — so the review is now a real screen.) `close()` resets this store and
 * the screen pops itself in response. `preview` still drives the root-mounted
 * full-screen viewer overlay shown above the screen on long-press.
 */
type ReviewPayload = {
  title: string;
  groups: SmartCleanGroup[];
  onConfirm: (ids: string[], bytes: number) => void;
};

type SmartCleanReviewStore = {
  visible: boolean;
  title: string;
  groups: SmartCleanGroup[];
  busy: boolean;
  // Full-screen viewer shown ABOVE the review sheet (long-press a cell to open).
  preview?: { uri: string; isVideo: boolean };
  onConfirm?: (ids: string[], bytes: number) => void;
  open: (payload: ReviewPayload) => void;
  setBusy: (busy: boolean) => void;
  close: () => void;
  openPreview: (item: { uri: string; mediaType?: "photo" | "video" | "unknown" }) => void;
  closePreview: () => void;
};

export const useSmartCleanReviewStore = create<SmartCleanReviewStore>((set) => ({
  visible: false,
  title: "",
  groups: [],
  busy: false,
  preview: undefined,
  onConfirm: undefined,
  open: ({ title, groups, onConfirm }) => set({ visible: true, title, groups, onConfirm, busy: false, preview: undefined }),
  setBusy: (busy) => set({ busy }),
  close: () => set({ visible: false, groups: [], onConfirm: undefined, busy: false, preview: undefined }),
  openPreview: (item) => set({ preview: { uri: item.uri, isVideo: item.mediaType === "video" } }),
  closePreview: () => set({ preview: undefined })
}));
