import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getDayKey } from "@/utils/date";
import { createDebouncedStorage } from "@/utils/debounced-storage";

/** How many videos a Free user can compress per local-calendar day (via rewarded ad). */
export const FREE_DAILY_VIDEO_LIMIT = 2;

type FreeVideoQuotaStore = {
  dayKey: string;
  videoCount: number;
  /** Video compressions a Free user still has today (rolls over at local midnight). */
  remainingToday: () => number;
  /** Record one rewarded video compression. */
  recordVideoCompression: () => void;
};

export const useFreeVideoQuotaStore = create<FreeVideoQuotaStore>()(
  persist(
    (set, get) => ({
      dayKey: getDayKey(),
      videoCount: 0,
      remainingToday() {
        const today = getDayKey();
        const used = get().dayKey === today ? get().videoCount : 0;
        return Math.max(0, FREE_DAILY_VIDEO_LIMIT - used);
      },
      recordVideoCompression() {
        const today = getDayKey();
        set((state) => (state.dayKey === today ? { videoCount: state.videoCount + 1 } : { dayKey: today, videoCount: 1 }));
      }
    }),
    {
      name: "swipeclean-free-video-quota",
      storage: createJSONStorage(() => createDebouncedStorage(400)),
      partialize: (state) => ({ dayKey: state.dayKey, videoCount: state.videoCount })
    }
  )
);
