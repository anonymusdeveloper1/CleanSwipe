/**
 * Subscription state model.
 *
 * RevenueCat populates these fields from Play Store / App Store entitlements
 * without changing the feature-access layer that sits on top.
 */

export type SubscriptionStatus = "free" | "active" | "expired" | "cancelled";

export type SubscriptionPlan = "none" | "monthly" | "yearly";

/**
 * Where the entitlement came from.
 *
 * `test_store` and `promotional` are carried through DELIBERATELY rather than
 * being collapsed into `none`. Cancellation behaviour differs per source and
 * used to be inferred from "not a known store", which silently lumped a
 * dashboard-granted (PROMOTIONAL) entitlement in with a Test Store one — see
 * `cancelSubscription`. Anything genuinely unknown/other still maps to `none`.
 */
export type SubscriptionSource = "none" | "play_store" | "app_store" | "test_store" | "promotional";

/**
 * A read-only snapshot of the user's subscription, including the derived
 * `isPro` flag. This is what `getCurrentSubscription()` returns and what the
 * feature-access layer consumes.
 */
export type SubscriptionSnapshot = {
  isPro: boolean;
  subscriptionStatus: SubscriptionStatus;
  plan: SubscriptionPlan;
  expiresAt?: string;
  source: SubscriptionSource;
};

export type BillingPlan = {
  plan: Exclude<SubscriptionPlan, "none">;
  packageIdentifier: string;
  productIdentifier: string;
  priceString: string;
  title?: string;
  period?: string;
};

export type BillingPlans = Partial<Record<Exclude<SubscriptionPlan, "none">, BillingPlan>>;

/**
 * The minimal fields the pure feature-access functions need. Both the live
 * store and any test fixture satisfy this shape, so the access logic stays
 * decoupled from zustand/React.
 */
export type SubscriptionAccessState = {
  subscriptionStatus: SubscriptionStatus;
};
