import { useRouter } from "expo-router";
import { useEffect } from "react";
import { FeatureKey } from "@/features/subscription/feature-flags";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";
import { useSubscriptionStore } from "@/store/subscription-store";
import { usePaywallStore } from "@/store/paywall-store";

/**
 * Route-level entitlement guard for Pro-only SCREENS.
 *
 * Why this exists: Pro features were gated only by the screen that *renders*
 * them — `PremiumScreen` returns `<StudioScreen/>` when `isPro`, and Studio hosts
 * Convert. But `app/convert-run.tsx`, `app/convert-batch.tsx` and
 * `app/smart-clean-review.tsx` are top-level expo-router routes, and the app
 * registers the `swipeclean://` scheme — so a Free user could reach a Pro flow
 * directly via a deep link and bypass the gate entirely. Each Pro route now
 * asserts its own entitlement instead of trusting its usual parent.
 *
 * On denial: send the user to the Premium tab and open the per-feature paywall,
 * which is exactly what an in-app denial does.
 *
 * Returns `allowed` so the screen can render null (or a spinner) for the frame
 * before the redirect lands, rather than flashing Pro UI.
 */
export function useRequireProFeature(featureKey: FeatureKey): boolean {
  const router = useRouter();
  const { canUseFeature } = useFeatureAccess();
  // Never redirect before the persisted entitlement has rehydrated, or a cold
  // deep-link launch would bounce a paying Pro user to the paywall.
  const hasHydrated = useSubscriptionStore((state) => state.hasHydrated);
  const allowed = canUseFeature(featureKey);

  useEffect(() => {
    if (!hasHydrated || allowed) return;
    usePaywallStore.getState().open(featureKey);
    router.replace("/(tabs)/premium");
  }, [allowed, featureKey, hasHydrated, router]);

  return allowed;
}
