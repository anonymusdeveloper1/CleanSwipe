/**
 * Shared cooldown across ALL full-screen ads (interstitial + rewarded).
 *
 * Both ad types stamp `markFullScreenAdShown()` when they display. The
 * interstitial checks `canShowFullScreenAd()` before showing, which buys two
 * behaviours for free:
 *   - a post-compression interstitial is SKIPPED right after a rewarded video
 *     (never two full-screen ads back-to-back), and
 *   - compressing many photos quickly surfaces at most one interstitial per
 *     window instead of stacking them.
 * The rewarded ad is user-initiated, so it never checks the cooldown (it always
 * shows on request) but it DOES stamp it.
 */

export const FULL_SCREEN_AD_MIN_INTERVAL_MS = 3 * 60 * 1000;

let lastFullScreenAdAt = 0;

export function markFullScreenAdShown() {
  lastFullScreenAdAt = Date.now();
}

export function canShowFullScreenAd(minIntervalMs: number = FULL_SCREEN_AD_MIN_INTERVAL_MS) {
  return Date.now() - lastFullScreenAdAt >= minIntervalMs;
}
