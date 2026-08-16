export type RevenueCatSupportIdentity = {
  /** Server-returned primary identifier for the merged RevenueCat customer. */
  supportId: string;
  /** This installation's SDK identifier when it is a different customer alias. */
  deviceAlias?: string;
};

function normalizeId(id?: string | null) {
  const normalized = id?.trim();
  return normalized || undefined;
}

/**
 * Prefer RevenueCat's server customer identifier for dashboard lookup while
 * retaining the local SDK identifier when RevenueCat has merged it as an alias.
 */
export function resolveRevenueCatSupportIdentity(
  originalAppUserId?: string | null,
  deviceAppUserId?: string | null
): RevenueCatSupportIdentity | undefined {
  const serverId = normalizeId(originalAppUserId);
  const deviceId = normalizeId(deviceAppUserId);
  const supportId = serverId ?? deviceId;
  if (!supportId) return undefined;

  return {
    supportId,
    deviceAlias: deviceId && deviceId !== supportId ? deviceId : undefined
  };
}
