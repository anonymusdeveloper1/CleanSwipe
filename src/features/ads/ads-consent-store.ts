import { create } from "zustand";

/**
 * Holds the UMP/GDPR consent outcome for the current app session.
 *
 * `canRequestAds` mirrors `AdsConsentService.gather()` — whether AdMob may request
 * ANY ads at all. It defaults to `false` (fail-CLOSED) and is flipped to `true`
 * only after consent is gathered at launch, BEFORE the Mobile Ads SDK loads. This
 * closes the startup window where a regulated-region user who has NOT granted
 * consent could otherwise get a real ad request before `gather()` resolves. Ad
 * surfaces read it via `useAdsVisibility`, and the interstitial/rewarded services
 * gate on it too, so no ad is requested until consent is confirmed.
 *
 * Not persisted: consent is re-gathered every launch.
 */
type AdsConsentState = {
  canRequestAds: boolean;
  setCanRequestAds: (value: boolean) => void;
};

export const useAdsConsentStore = create<AdsConsentState>((set) => ({
  canRequestAds: false,
  setCanRequestAds: (value) => set({ canRequestAds: value })
}));
