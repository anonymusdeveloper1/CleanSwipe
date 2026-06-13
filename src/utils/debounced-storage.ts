import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

/**
 * A zustand `StateStorage` that debounces writes to AsyncStorage. zustand-persist
 * writes on EVERY `set()`; for stores that update many times in a burst (per-asset
 * feature hashing, scan checkpoints) that means a serialize + write per update.
 * Collapsing a burst into a single trailing write per key removes that overhead.
 *
 * Safe because these stores hold derived/rebuildable data: losing <`delayMs` of
 * trailing writes on a hard process kill just recomputes cheaply on next run.
 *
 * (Compression keeps its own private copy of this helper; this shared one is used
 * by the Smart Clean feature cache. Kept identical in behaviour on purpose.)
 */
export function createDebouncedStorage(delayMs: number): StateStorage {
  const pendingWrites: Record<string, string> = {};
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};

  return {
    getItem(name) {
      return AsyncStorage.getItem(name);
    },
    setItem(name, value) {
      pendingWrites[name] = value;
      if (timers[name]) {
        clearTimeout(timers[name]);
      }
      timers[name] = setTimeout(() => {
        const pendingValue = pendingWrites[name];
        delete pendingWrites[name];
        delete timers[name];
        void AsyncStorage.setItem(name, pendingValue).catch(() => undefined);
      }, delayMs);
    },
    removeItem(name) {
      if (timers[name]) {
        clearTimeout(timers[name]);
        delete timers[name];
      }
      delete pendingWrites[name];
      return AsyncStorage.removeItem(name);
    }
  };
}
