import { AdEventType, RewardedAd, RewardedAdEventType } from "react-native-google-mobile-ads";
import { REWARDED_AD_UNIT_ID } from "@/features/ads/ad-config";
import { markFullScreenAdShown } from "@/features/ads/full-screen-ad-gate";
import { canUseFeatureNow } from "@/store/subscription-store";

/**
 * Rewarded (full-screen, opt-in) ad. Free users watch one to start a single
 * video compression (capped per day elsewhere). Pro users never load it.
 *
 * `showForReward()` resolves true ONLY if the user earned the reward (watched
 * far enough); false if the ad wasn't ready, was dismissed early, or errored —
 * the caller must not grant the reward in that case.
 */

let rewarded: RewardedAd | undefined;
let loaded = false;

function ensureCreated() {
  if (rewarded) return rewarded;
  const ad = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true
  });
  ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    loaded = true;
  });
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    loaded = false;
    ad.load(); // preload the next one
  });
  ad.addAdEventListener(AdEventType.ERROR, () => {
    loaded = false;
  });
  rewarded = ad;
  return ad;
}

export const RewardedAdService = {
  /** Create + preload the first rewarded ad. Call once after SDK init. */
  preload() {
    if (canUseFeatureNow("noAds")) return; // Pro: don't even load
    ensureCreated().load();
  },

  isReady() {
    return loaded;
  },

  /**
   * Show the rewarded ad for a user-initiated action. Resolves true only when
   * the reward is earned. Safe to call from anywhere; never throws.
   */
  showForReward(): Promise<boolean> {
    return new Promise((resolve) => {
      const ad = ensureCreated();
      if (!loaded) {
        ad.load(); // not ready this time; warm it for next attempt
        resolve(false);
        return;
      }

      let earned = false;
      const unsubs: Array<() => void> = [];
      const cleanup = () => {
        unsubs.forEach((u) => u());
        unsubs.length = 0;
      };

      unsubs.push(
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
        })
      );
      unsubs.push(
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          cleanup();
          resolve(earned);
        })
      );
      unsubs.push(
        ad.addAdEventListener(AdEventType.ERROR, () => {
          cleanup();
          resolve(false);
        })
      );

      markFullScreenAdShown(); // suppress a back-to-back interstitial
      try {
        ad.show();
      } catch {
        cleanup();
        loaded = false;
        ad.load();
        resolve(false);
      }
    });
  }
};
