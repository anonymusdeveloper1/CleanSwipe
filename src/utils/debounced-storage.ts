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
// Every debounced storage registers its flush here so the app can force ALL
// pending writes to disk at once when it backgrounds (before the OS suspends iOS
// or an aggressive OEM kills the Android task) — so an interrupted Smart Clean
// scan resumes from exactly where it stopped instead of losing trailing writes.
const flushers = new Set<() => Promise<void>>();

/** Write every debounced store's pending value to AsyncStorage immediately. */
export async function flushAllDebouncedStorages(): Promise<void> {
  await Promise.all([...flushers].map((flush) => flush()));
}

export function createDebouncedStorage(delayMs: number): StateStorage {
  const pendingWrites: Record<string, string> = {};
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};

  const flush = async () => {
    const names = Object.keys(pendingWrites);
    await Promise.all(
      names.map(async (name) => {
        const pendingValue = pendingWrites[name];
        if (timers[name]) {
          clearTimeout(timers[name]);
          delete timers[name];
        }
        delete pendingWrites[name];
        await AsyncStorage.setItem(name, pendingValue).catch(() => undefined);
      })
    );
  };
  flushers.add(flush);

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
