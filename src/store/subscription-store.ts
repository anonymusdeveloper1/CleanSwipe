import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { FeatureAccessService } from "@/features/subscription/feature-access.service";
import { FeatureKey } from "@/features/subscription/feature-flags";
import { RevenueCatEntitlementState, RevenueCatSubscriptionService } from "@/features/subscription/revenuecat.service";
import {
  BillingPlans,
  SubscriptionPlan,
  SubscriptionSnapshot,
  SubscriptionSource,
  SubscriptionStatus
} from "@/features/subscription/subscription.types";

/**
 * Subscription state.
 *
 * RevenueCat is the real billing/entitlement source. This store keeps only a
 * compact app-owned snapshot plus lightweight UI state; no RevenueCat SDK
 * objects are persisted.
 */
type SubscriptionStore = {
  subscriptionStatus: SubscriptionStatus;
  plan: SubscriptionPlan;
  expiresAt?: string;
  source: SubscriptionSource;
  managementUrl?: string;
  // Test-only: set when the user "cancels" a Test Store subscription (which the
  // client SDK cannot truly cancel). Persisted + honored on every refresh so the
  // cancel sticks until the user buys again. Never set for real store subs.
  localCancelled: boolean;
  hasHydrated: boolean;
  billingInitialized: boolean;
  billingConfigured: boolean;
  offeringsLoading: boolean;
  purchaseInProgress: boolean;
  billingError?: string;
  plans: BillingPlans;

  setHasHydrated: (hasHydrated: boolean) => void;
  initializeBilling: () => Promise<SubscriptionSnapshot>;
  refreshSubscriptionStatus: () => Promise<SubscriptionSnapshot>;
  purchasePlan: (plan: Exclude<SubscriptionPlan, "none">) => Promise<SubscriptionSnapshot>;
  restorePurchases: () => Promise<SubscriptionSnapshot>;
  cancelSubscription: () => Promise<void>;
  getCurrentSubscription: () => SubscriptionSnapshot;
  isProUser: () => boolean;
};

let initializePromise: Promise<SubscriptionSnapshot> | undefined;

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      subscriptionStatus: "free",
      plan: "none",
      expiresAt: undefined,
      source: "none",
      managementUrl: undefined,
      localCancelled: false,
      hasHydrated: false,
      billingInitialized: false,
      billingConfigured: false,
      offeringsLoading: false,
      purchaseInProgress: false,
      billingError: undefined,
      plans: {},

      setHasHydrated(hasHydrated) {
        set({ hasHydrated });
      },

      async initializeBilling() {
        if (initializePromise) return initializePromise;

        initializePromise = (async () => {
          set({ offeringsLoading: true, billingError: undefined });
          try {
            const configured = await RevenueCatSubscriptionService.configure(handleCustomerInfoUpdate);
            if (!configured) {
              set({
                billingInitialized: true,
                billingConfigured: false,
                offeringsLoading: false,
                plans: {},
                billingError: "RevenueCat purchases are not configured for this build yet."
              });
              return get().getCurrentSubscription();
            }

            const [plans, entitlementState] = await Promise.all([
              RevenueCatSubscriptionService.getBillingPlans(),
              RevenueCatSubscriptionService.getCustomerState()
            ]);
            const reconciled = reconcileEntitlement(entitlementState, get().localCancelled);
            set({
              ...reconciled.entitlement,
              localCancelled: reconciled.localCancelled,
              plans,
              billingInitialized: true,
              billingConfigured: true,
              offeringsLoading: false,
              billingError: undefined
            });
          } catch (error) {
            set({
              billingInitialized: true,
              billingConfigured: false,
              offeringsLoading: false,
              plans: {},
              billingError: normalizeBillingError(error)
            });
          }

          return get().getCurrentSubscription();
        })().finally(() => {
          initializePromise = undefined;
        });

        return initializePromise;
      },

      async refreshSubscriptionStatus() {
        try {
          const configured = await RevenueCatSubscriptionService.configure(handleCustomerInfoUpdate);
          if (!configured) {
            set({
              billingInitialized: true,
              billingConfigured: false,
              billingError: "RevenueCat purchases are not configured for this build yet."
            });
            return get().getCurrentSubscription();
          }

          const entitlementState = await RevenueCatSubscriptionService.getCustomerState();
          const reconciled = reconcileEntitlement(entitlementState, get().localCancelled);
          set({
            ...reconciled.entitlement,
            localCancelled: reconciled.localCancelled,
            billingInitialized: true,
            billingConfigured: true,
            billingError: undefined
          });
        } catch (error) {
          set({
            billingInitialized: true,
            billingConfigured: false,
            billingError: normalizeBillingError(error)
          });
        }
        return get().getCurrentSubscription();
      },

      async purchasePlan(plan) {
        set({ purchaseInProgress: true, billingError: undefined });
        try {
          await get().initializeBilling();
          const entitlementState = await RevenueCatSubscriptionService.purchasePlan(plan);
          set({
            ...entitlementState,
            localCancelled: false,
            billingInitialized: true,
            billingConfigured: true,
            purchaseInProgress: false,
            billingError: undefined
          });
          return get().getCurrentSubscription();
        } catch (error) {
          if (RevenueCatSubscriptionService.isPurchaseCancelled(error)) {
            set({ purchaseInProgress: false, billingError: undefined });
            return get().getCurrentSubscription();
          }
          const message = normalizeBillingError(error);
          set({ purchaseInProgress: false, billingError: message });
          throw new Error(message);
        }
      },

      async restorePurchases() {
        set({ purchaseInProgress: true, billingError: undefined });
        try {
          await get().initializeBilling();
          const entitlementState = await RevenueCatSubscriptionService.restorePurchases();
          set({
            ...entitlementState,
            localCancelled: false,
            billingInitialized: true,
            billingConfigured: true,
            purchaseInProgress: false,
            billingError: undefined
          });
          return get().getCurrentSubscription();
        } catch (error) {
          const message = normalizeBillingError(error);
          set({ purchaseInProgress: false, billingError: message });
          throw new Error(message);
        }
      },

      async cancelSubscription() {
        const { managementUrl, source } = get();
        if (managementUrl?.trim() || source === "play_store" || source === "app_store") {
          // Real Play/App Store subscription: open the store's manage/cancel page
          // (the only compliant way to cancel a store subscription).
          await RevenueCatSubscriptionService.openManageSubscriptions(managementUrl);
          return;
        }
        // RevenueCat Test Store: the client SDK cannot cancel a test subscription
        // and there is no store page to open. Mark it cancelled locally and
        // downgrade; `localCancelled` is persisted and honored by
        // reconcileEntitlement on every refresh, so the cancel STICKS (no flip
        // back to Pro) until the user purchases again. This path runs only for
        // non-store subscriptions, so it never affects a real paying customer.
        set({ localCancelled: true, subscriptionStatus: "free", plan: "none", source: "none", expiresAt: undefined, managementUrl: undefined });
      },

      getCurrentSubscription() {
        return buildSubscriptionSnapshot(get());
      },

      isProUser() {
        return FeatureAccessService.isProUser(get());
      }
    }),
    {
      name: "swipeclean-subscription-store",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...((persistedState ?? {}) as Partial<SubscriptionStore>),
        billingInitialized: false,
        billingConfigured: false,
        offeringsLoading: false,
        purchaseInProgress: false,
        billingError: undefined,
        plans: {}
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("Failed to rehydrate subscription store", error);
        }
        (state ?? useSubscriptionStore.getState()).setHasHydrated(true);
      },
      partialize: (state) => ({
        subscriptionStatus: state.subscriptionStatus,
        plan: state.plan,
        expiresAt: state.expiresAt,
        source: state.source,
        localCancelled: state.localCancelled
      })
    }
  )
);

/**
 * Pure builder for the read-only subscription snapshot. Kept module-level (not
 * a store-returning-a-fresh-object selector) so React components can compute it
 * from individually-subscribed primitives without useSyncExternalStore loops.
 */
export function buildSubscriptionSnapshot(state: {
  subscriptionStatus: SubscriptionStatus;
  plan: SubscriptionPlan;
  expiresAt?: string;
  source: SubscriptionSource;
}): SubscriptionSnapshot {
  const isPro = FeatureAccessService.isProUser(state);
  return {
    isPro,
    subscriptionStatus: state.subscriptionStatus,
    plan: state.plan,
    expiresAt: state.expiresAt,
    source: state.source
  };
}

export function canUseFeatureNow(featureKey: FeatureKey): boolean {
  return FeatureAccessService.canUseFeature(featureKey, useSubscriptionStore.getState());
}

function handleCustomerInfoUpdate(customerInfo: Parameters<typeof RevenueCatSubscriptionService.mapCustomerInfo>[0]) {
  const entitlement = RevenueCatSubscriptionService.mapCustomerInfo(customerInfo);
  const reconciled = reconcileEntitlement(entitlement, useSubscriptionStore.getState().localCancelled);
  useSubscriptionStore.setState({
    ...reconciled.entitlement,
    localCancelled: reconciled.localCancelled,
    billingInitialized: true,
    billingConfigured: true,
    billingError: undefined
  });
}

/**
 * Honor a local Test Store "cancel": while `localCancelled` is set, a still-active
 * test entitlement is suppressed (kept Free) so the cancel sticks across refreshes
 * and the RevenueCat customer-info listener can't flip it back to Pro. Once the
 * real entitlement is no longer active, the override self-clears. Real store
 * subscriptions never set `localCancelled`, so this is a no-op in production.
 */
function reconcileEntitlement(
  entitlement: RevenueCatEntitlementState,
  localCancelled: boolean
): { entitlement: RevenueCatEntitlementState; localCancelled: boolean } {
  if (localCancelled && entitlement.subscriptionStatus === "active") {
    return {
      entitlement: { subscriptionStatus: "free", plan: "none", source: "none", expiresAt: undefined, managementUrl: undefined },
      localCancelled: true
    };
  }
  return { entitlement, localCancelled: false };
}

function normalizeBillingError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Billing is unavailable right now. Please try again.";
}
