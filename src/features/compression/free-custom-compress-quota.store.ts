import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getDayKey } from "@/utils/date";
import { createDebouncedStorage } from "@/utils/debounced-storage";

/** How many CUSTOM-file compressions a Free user gets per local-calendar day (via a rewarded ad). */
export const FREE_DAILY_CUSTOM_LIMIT = 1;

type FreeCustomCompressQuotaStore = {
  dayKey: string;
  count: number;
  /** Custom-file compressions a Free user still has today (rolls over at local midnight). */
  remainingToday: () => number;
  /** Record one rewarded custom-file compression. */
  recordCustomCompression: () => void;
};

export const useFreeCustomCompressQuotaStore = create<FreeCustomCompressQuotaStore>()(
  persist(
    (set, get) => ({
      dayKey: getDayKey(),
      count: 0,
      remainingToday() {
        const today = getDayKey();
        const used = get().dayKey === today ? get().count : 0;
        return Math.max(0, FREE_DAILY_CUSTOM_LIMIT - used);
      },
      recordCustomCompression() {
        const today = getDayKey();
        set((state) => (state.dayKey === today ? { count: state.count + 1 } : { dayKey: today, count: 1 }));
      }
    }),
    {
      name: "swipeclean-free-custom-compress-quota",
      storage: createJSONStorage(() => createDebouncedStorage(400)),
      partialize: (state) => ({ dayKey: state.dayKey, count: state.count })
    }
  )
);
