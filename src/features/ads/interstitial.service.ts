import { AdEventType, InterstitialAd } from "react-native-google-mobile-ads";
import { INTERSTITIAL_AD_UNIT_ID } from "@/features/ads/ad-config";
import { canShowFullScreenAd, markFullScreenAdShown } from "@/features/ads/full-screen-ad-gate";
import { canUseFeatureNow } from "@/store/subscription-store";

/**
 * Interstitial (full-screen) ad shown at natural task-end break points
 * (e.g. after a permanent delete). Never shown mid-task.
 *
 * Rules:
 *  - Pro users (the `noAds` entitlement) never see it.
 *  - Frequency-capped so a heavy session doesn't stack interstitials.
 *  - Preloaded so `maybeShow` can display instantly, then reloaded after close.
 */

let interstitial: InterstitialAd | undefined;
let loaded = false;

function ensureCreated() {
  if (interstitial) return interstitial;
  const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true
  });
  ad.addAdEventListener(AdEventType.LOADED, () => {
    loaded = true;
  });
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    loaded = false;
    ad.load(); // preload the next one
  });
  ad.addAdEventListener(AdEventType.ERROR, () => {
    loaded = false;
  });
  interstitial = ad;
  return ad;
}

export const InterstitialAdService = {
  /** Create + preload the first interstitial. Call once after SDK init. */
  preload() {
    if (canUseFeatureNow("noAds")) return; // Pro: don't even load
    ensureCreated().load();
  },

  /**
   * Show an interstitial if allowed (not Pro, past the cap, and one is loaded).
   * Safe to call from any task-end handler; it self-gates and never throws.
   */
  maybeShow() {
    if (canUseFeatureNow("noAds")) return;
    // Shared cooldown across all full-screen ads: skips right after a rewarded
    // video and de-dupes rapid back-to-back compressions.
    if (!canShowFullScreenAd()) return;

    const ad = ensureCreated();
    if (!loaded) {
      ad.load(); // not ready this time; warm it for next break point
      return;
    }
    markFullScreenAdShown();
    try {
      ad.show();
    } catch {
      // Showing can fail if the ad expired between load and show; reload silently.
      loaded = false;
      ad.load();
    }
  }
};
