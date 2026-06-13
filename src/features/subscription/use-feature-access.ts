import { useCallback } from "react";
import { FeatureAccessService } from "@/features/subscription/feature-access.service";
import { FeatureKey } from "@/features/subscription/feature-flags";
import { useSubscriptionStore } from "@/store/subscription-store";

/**
 * The single hook screens/components use to gate features. NEVER read `isPro`
 * ad-hoc — call `canUseFeature(featureKey)` so the tier mapping stays in one
 * place (feature-flags.ts).
 *
 * It subscribes to exactly the field that affects access (`subscriptionStatus`),
 * so consumers re-render when the user's subscription becomes active or lapses.
 */
export function useFeatureAccess() {
  const subscriptionStatus = useSubscriptionStore((state) => state.subscriptionStatus);

  const isPro = FeatureAccessService.isProUser({ subscriptionStatus });

  const canUseFeature = useCallback(
    (featureKey: FeatureKey) => FeatureAccessService.canUseFeature(featureKey, { subscriptionStatus }),
    [subscriptionStatus]
  );

  return { isPro, canUseFeature };
}
