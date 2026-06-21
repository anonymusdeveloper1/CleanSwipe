/**
 * Small state holder for permission-triggered Smart Clean rescans.
 *
 * Permission, AppState, and media-library events can overlap. The pass that
 * notices a scope change may not be the pass that finishes rebuilding the media
 * index, so the rescan intent must outlive one reconcile invocation.
 */
export function createSmartCleanRescanIntent() {
  let pending = false;

  return {
    request(hadSmartCleanHistory: boolean) {
      if (hadSmartCleanHistory) pending = true;
    },
    clear() {
      pending = false;
    },
    isPending() {
      return pending;
    }
  };
}

/** Detects selected-media replacements even when the item count is unchanged. */
export function orderedMediaIdsChanged(previous: readonly string[], next: readonly string[]) {
  if (previous.length !== next.length) return true;
  return previous.some((id, index) => id !== next[index]);
}

/** Compact exact-scope fingerprint used by persisted Smart Clean checkpoints. */
export function mediaScopeFingerprint(accessLevel: string | undefined, orderedIds: readonly string[]) {
  let hash = 2166136261;
  for (const id of orderedIds) {
    for (let index = 0; index < id.length; index += 1) {
      hash ^= id.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 0xff;
    hash = Math.imul(hash, 16777619);
  }
  return `${accessLevel ?? "unknown"}|${orderedIds.length}|${(hash >>> 0).toString(36)}`;
}
