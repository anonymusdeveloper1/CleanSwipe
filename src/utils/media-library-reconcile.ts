/**
 * Returns indexed IDs that no longer exist in an authoritative device-library
 * snapshot. The input order is preserved so callers can remove deterministically.
 */
export function findMissingMediaIds(indexedIds: string[], existingIds: Iterable<string>) {
  const existing = existingIds instanceof Set ? existingIds : new Set(existingIds);
  return indexedIds.filter((id) => !existing.has(id));
}
