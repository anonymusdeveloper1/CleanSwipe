import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CleanupEvent, CleanupEventInput } from "@/features/advanced-stats/cleanup-event.types";

/**
 * Cleanup events ledger (Advanced Stats / Pro).
 *
 * Append-only, NEWEST-FIRST, bounded to EVENT_CAP entries so AsyncStorage can
 * never grow unbounded. Events are emitted imperatively from terminal,
 * low-frequency success paths (permanent delete, verified compression) via the
 * exported `recordCleanupEvent` helper — NEVER from hot paths like compression
 * progress updates.
 *
 * IMPORTANT: this store deliberately exposes NO getReport()/getWeeklyReport()
 * method. All report derivation lives in PURE selector functions
 * (cleanup-report.selectors.ts) consumed via useMemo over the stable `events`
 * array — subscribing a selector to a freshly-built object/array would loop
 * useSyncExternalStore and crash (the Stage 1 footgun).
 */

const EVENT_CAP = 2000;

// Monotonic-ish suffix so two events created in the same millisecond get
// distinct ids. Wraps to keep the string short; uniqueness only needs to hold
// within a single ms which this comfortably satisfies.
let seq = 0;

function makeEvent(input: CleanupEventInput): CleanupEvent {
  const at = input.at ?? Date.now();
  seq = (seq + 1) % 100000;
  const { at: _ignored, ...rest } = input;
  return { id: `${at}-${seq}`, at, ...rest };
}

type CleanupEventsStore = {
  events: CleanupEvent[];
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  recordEvent: (input: CleanupEventInput) => void;
  clearEvents: () => void;
};

export const useCleanupEventsStore = create<CleanupEventsStore>()(
  persist(
    (set) => ({
      events: [],
      hasHydrated: false,

      setHasHydrated(hasHydrated) {
        set({ hasHydrated });
      },

      recordEvent(input) {
        set((state) => ({ events: [makeEvent(input), ...state.events].slice(0, EVENT_CAP) }));
      },

      clearEvents() {
        set({ events: [] });
      }
    }),
    {
      name: "swipeclean-cleanup-events-store",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("Failed to rehydrate cleanup events store", error);
        }
        // Always clear the hydration gate, even on error (state is undefined
        // then), so the advanced-stats section never strands on a loader.
        (state ?? useCleanupEventsStore.getState()).setHasHydrated(true);
      },
      partialize: (state) => ({ events: state.events })
    }
  )
);

/**
 * Imperative emit helper for use from store actions / services (non-React).
 * Using this instead of a hook guarantees emission never participates in a
 * React subscription.
 */
export function recordCleanupEvent(input: CleanupEventInput) {
  useCleanupEventsStore.getState().recordEvent(input);
}
