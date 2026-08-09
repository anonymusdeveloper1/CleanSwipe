import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PersistStorage, StateStorage, StorageValue } from "zustand/middleware";

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

/**
 * Register a store-private debounced storage's flush so it participates in
 * `flushAllDebouncedStorages()`. Stores that hand-roll their own debounced
 * `PersistStorage` (the media index) MUST call this, or up to `delayMs` of
 * trailing writes are silently dropped when the app backgrounds.
 */
export function registerDebouncedFlusher(flush: () => Promise<void>): () => void {
  flushers.add(flush);
  return () => flushers.delete(flush);
}

/**
 * Object-based (`PersistStorage`) sibling of `createDebouncedStorage`.
 *
 * WHY THIS EXISTS: `createJSONStorage(() => createDebouncedStorage(n))` only
 * debounces the AsyncStorage WRITE — zustand-persist still runs `partialize` +
 * `JSON.stringify` on EVERY `set()`. For a store that sets once per asset during
 * a scan (the Smart Clean feature cache, the scan checkpointer) that is
 * O(store size) per asset, i.e. O(n^2) per scan and gigabytes of transient
 * strings on a large library. Holding the raw object and stringifying once at
 * flush time makes the whole burst cost O(store size) total.
 *
 * Same durability trade-off as the string version: only for derived/rebuildable
 * state, where losing <`delayMs` of trailing writes on a hard kill is cheap.
 */
export function createDebouncedObjectStorage<T>(delayMs: number): PersistStorage<T> {
  let pending: { name: string; value: StorageValue<T> } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const write = async () => {
    const queued = pending;
    pending = undefined;
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (!queued) return;
    await AsyncStorage.setItem(queued.name, JSON.stringify(queued.value)).catch(() => undefined);
  };
  flushers.add(write);

  return {
    async getItem(name) {
      const raw = await AsyncStorage.getItem(name);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StorageValue<T>;
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      // Last-call-wins: keep only the newest state; the stringify happens once,
      // in the trailing flush.
      pending = { name, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void write();
      }, delayMs);
    },
    removeItem(name) {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      pending = undefined;
      return AsyncStorage.removeItem(name);
    }
  };
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
