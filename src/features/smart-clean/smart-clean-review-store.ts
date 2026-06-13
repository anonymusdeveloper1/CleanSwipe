import { create } from "zustand";
import { SmartCleanGroup } from "@/features/smart-clean/smart-clean.types";

/**
 * Tiny, non-persisted store that drives the Smart Clean review sheet. A single
 * <SmartCleanReviewSheet /> is mounted in the ROOT layout (above the tab
 * navigator) and renders from this state — the same global-overlay pattern as
 * ProUpgradeSheet / CompressionCompleteSheet.
 *
 * Mounting at the root is what lets the sheet render ON TOP OF the bottom tab
 * bar (an overlay rendered inside a tab screen is painted under the tab bar).
 * It is an in-tree absolute overlay, NOT an RN <Modal>, so safe-area insets are
 * read correctly and the expo-image sizing fixes keep working.
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
