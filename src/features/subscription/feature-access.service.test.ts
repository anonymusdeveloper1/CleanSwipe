import { describe, expect, it } from "vitest";
import { FeatureAccessService } from "@/features/subscription/feature-access.service";
import { FeatureKey } from "@/features/subscription/feature-flags";
import { SubscriptionStatus } from "@/features/subscription/subscription.types";

const FREE_FEATURE: FeatureKey = "photoCompression";
const PRO_FEATURE: FeatureKey = "smartClean";

describe("FeatureAccessService.isProUser", () => {
  it("is true only for an active subscription", () => {
    expect(FeatureAccessService.isProUser({ subscriptionStatus: "active" })).toBe(true);
  });

  it.each<SubscriptionStatus>(["free", "expired", "cancelled"])("is false for %s", (status) => {
    expect(FeatureAccessService.isProUser({ subscriptionStatus: status })).toBe(false);
  });
});

describe("FeatureAccessService.canUseFeature", () => {
  it("allows free features regardless of subscription status", () => {
    expect(FeatureAccessService.canUseFeature(FREE_FEATURE, { subscriptionStatus: "free" })).toBe(true);
    expect(FeatureAccessService.canUseFeature(FREE_FEATURE, { subscriptionStatus: "active" })).toBe(true);
  });

  it("gates pro features behind an active subscription", () => {
    expect(FeatureAccessService.canUseFeature(PRO_FEATURE, { subscriptionStatus: "active" })).toBe(true);
    expect(FeatureAccessService.canUseFeature(PRO_FEATURE, { subscriptionStatus: "free" })).toBe(false);
    expect(FeatureAccessService.canUseFeature(PRO_FEATURE, { subscriptionStatus: "expired" })).toBe(false);
  });

  it("fails closed for an unknown feature key", () => {
    const unknown = "not-a-real-feature" as FeatureKey;
    expect(FeatureAccessService.canUseFeature(unknown, { subscriptionStatus: "active" })).toBe(false);
  });
});
