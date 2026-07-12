import { useAdsConsentStore } from "@/features/ads/ads-consent-store";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";

/**
 * Ads visibility abstraction. This centralizes whether AdMob surfaces should
 * render.
 *
 * Rules:
 *   - Free users: ads can be shown.
 *   - Pro users: ads hidden.
 *   - AND only when UMP/GDPR consent allows requesting ads at all — a user who
 *     denied consent in a regulated region sees NO ads, including the banner.
 * `noAds` is a Pro feature flag, so "no ads" === "has the noAds entitlement".
 */
export function useAdsVisibility() {
  const { canUseFeature } = useFeatureAccess();
  const canRequestAds = useAdsConsentStore((state) => state.canRequestAds);
  const shouldShowAds = !canUseFeature("noAds") && canRequestAds;
  return { shouldShowAds };
}
