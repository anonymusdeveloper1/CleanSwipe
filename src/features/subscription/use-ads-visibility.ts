import { useFeatureAccess } from "@/features/subscription/use-feature-access";

/**
 * Ads visibility abstraction. This centralizes whether AdMob surfaces should
 * render.
 *
 * Rules:
 *   - Free users: ads can be shown.
 *   - Pro users: ads hidden.
 * `noAds` is a Pro feature flag, so "no ads" === "has the noAds entitlement".
 */
export function useAdsVisibility() {
  const { canUseFeature } = useFeatureAccess();
  const shouldShowAds = !canUseFeature("noAds");
  return { shouldShowAds };
}
