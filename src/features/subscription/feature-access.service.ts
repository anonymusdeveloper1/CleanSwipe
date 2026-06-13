import { FEATURE_TIER, FeatureKey } from "@/features/subscription/feature-flags";
import { SubscriptionAccessState } from "@/features/subscription/subscription.types";

/**
 * Pure feature-access logic. No React, no store import — it takes the relevant
 * subscription state as an argument so it can be unit-tested and reused from
 * both hooks and imperative code paths.
 *
 * Pro access is true ONLY when the real subscription is active. Entitlement
 * comes exclusively from RevenueCat feeding `subscriptionStatus === "active"`
 * — the in-app Test Store grants this exactly like a real Play/App Store
 * subscription, so the subscribe → Pro → cancel → Free lifecycle is testable
 * without any build-time or debug unlock shortcut.
 */
export const FeatureAccessService = {
  isProUser(state: SubscriptionAccessState): boolean {
    return state.subscriptionStatus === "active";
  },

  canUseFeature(featureKey: FeatureKey, state: SubscriptionAccessState): boolean {
    const tier = FEATURE_TIER[featureKey];
    // Unknown keys (shouldn't happen with the typed FeatureKey) fail closed.
    if (!tier) return false;
    if (tier === "free") return true;
    return this.isProUser(state);
  }
};
