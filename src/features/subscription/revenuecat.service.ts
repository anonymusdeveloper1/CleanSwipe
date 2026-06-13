import { Linking, Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  CustomerInfoUpdateListener,
  PACKAGE_TYPE,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesError,
  PURCHASES_ERROR_CODE
} from "react-native-purchases";
import { BillingPlan, BillingPlans, SubscriptionPlan, SubscriptionSource, SubscriptionStatus } from "@/features/subscription/subscription.types";

// Must match the entitlement Identifier in the RevenueCat dashboard exactly.
export const REVENUECAT_ENTITLEMENT_ID = "CleanSwipe Pro";
export const REVENUECAT_OFFERING_ID = "default";

export type RevenueCatEntitlementState = {
  subscriptionStatus: SubscriptionStatus;
  plan: SubscriptionPlan;
  expiresAt?: string;
  source: SubscriptionSource;
  // Store-provided "manage subscriptions" deep link (Play/App Store). Apps cannot
  // cancel a subscription programmatically; this is where the user does it.
  managementUrl?: string;
};

export class RevenueCatConfigurationError extends Error {
  constructor() {
    super("RevenueCat purchases are not configured for this build yet.");
    this.name = "RevenueCatConfigurationError";
  }
}

let configured = false;
let configurePromise: Promise<boolean> | undefined;
let offeringsCache: PurchasesOffering | undefined;
let customerInfoListener: CustomerInfoUpdateListener | undefined;

export const RevenueCatSubscriptionService = {
  async configure(onCustomerInfoUpdated?: CustomerInfoUpdateListener) {
    if (!isUsableKey(getApiKey())) {
      return false;
    }

    if (configurePromise) {
      const ready = await configurePromise;
      attachCustomerInfoListener(onCustomerInfoUpdated);
      return ready;
    }

    configurePromise = (async () => {
      if (configured || (await Purchases.isConfigured().catch(() => false))) {
        configured = true;
        return true;
      }

      if (__DEV__) {
        void Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG).catch(() => undefined);
      }

      Purchases.configure({ apiKey: getApiKey() as string });
      configured = true;
      return true;
    })().finally(() => {
      configurePromise = undefined;
    });

    const ready = await configurePromise;
    attachCustomerInfoListener(onCustomerInfoUpdated);
    return ready;
  },

  async getBillingPlans() {
    await ensureConfigured();
    // Always pull fresh offerings here: this is the explicit "load the store
    // prices" entry point (Premium screen mount / billing init), so price or
    // offering changes surface without an app restart.
    const offering = await getOffering(true);
    return buildBillingPlans(offering);
  },

  async getCustomerState() {
    await ensureConfigured();
    const customerInfo = await Purchases.getCustomerInfo();
    return mapCustomerInfo(customerInfo);
  },

  async purchasePlan(plan: Exclude<SubscriptionPlan, "none">) {
    await ensureConfigured();
    const offering = await getOffering();
    const selectedPackage = findPackageForPlan(offering, plan);
    if (!selectedPackage) {
      throw new Error("This subscription plan is not available yet.");
    }

    const result = await Purchases.purchasePackage(selectedPackage);
    return mapCustomerInfo(result.customerInfo);
  },

  async restorePurchases() {
    await ensureConfigured();
    const customerInfo = await Purchases.restorePurchases();
    return mapCustomerInfo(customerInfo);
  },

  /**
   * Open the store's "manage subscriptions" page so the user can cancel. Prefers
   * RevenueCat's per-customer managementURL; falls back to the platform default.
   */
  async openManageSubscriptions(managementUrl?: string) {
    const fallback =
      Platform.OS === "ios"
        ? "https://apps.apple.com/account/subscriptions"
        : "https://play.google.com/store/account/subscriptions";
    await Linking.openURL(managementUrl?.trim() ? managementUrl : fallback);
  },

  isPurchaseCancelled(error: unknown) {
    const purchasesError = error as Partial<PurchasesError> | undefined;
    return (
      purchasesError?.userCancelled === true ||
      purchasesError?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    );
  },

  mapCustomerInfo
};

async function ensureConfigured() {
  if (await RevenueCatSubscriptionService.configure()) return;
  throw new RevenueCatConfigurationError();
}

function getApiKey() {
  if (process.env.EXPO_PUBLIC_REVENUECAT_USE_TEST_STORE === "1") {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  }
  if (Platform.OS === "android") return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  if (Platform.OS === "ios") return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  return undefined;
}

function isUsableKey(key?: string) {
  if (!key) return false;
  const normalized = key.trim();
  return Boolean(normalized) && !normalized.includes("YOUR_") && !normalized.includes("REVENUECAT_");
}

function attachCustomerInfoListener(onCustomerInfoUpdated?: CustomerInfoUpdateListener) {
  if (!onCustomerInfoUpdated || customerInfoListener === onCustomerInfoUpdated) return;
  if (customerInfoListener) {
    Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
  }
  customerInfoListener = onCustomerInfoUpdated;
  Purchases.addCustomerInfoUpdateListener(customerInfoListener);
}

async function getOffering(forceRefresh = false) {
  if (!forceRefresh && offeringsCache) return offeringsCache;
  const offerings = await Purchases.getOfferings();
  const offering = offerings.all[REVENUECAT_OFFERING_ID] ?? offerings.current;
  if (!offering) {
    throw new Error("No RevenueCat offering is available.");
  }
  offeringsCache = offering;
  return offering;
}

function buildBillingPlans(offering: PurchasesOffering): BillingPlans {
  const monthly = findPackageForPlan(offering, "monthly");
  const yearly = findPackageForPlan(offering, "yearly");
  return {
    monthly: monthly ? toBillingPlan("monthly", monthly) : undefined,
    yearly: yearly ? toBillingPlan("yearly", yearly) : undefined
  };
}

function findPackageForPlan(offering: PurchasesOffering, plan: Exclude<SubscriptionPlan, "none">) {
  if (plan === "monthly") {
    return (
      offering.monthly ??
      offering.availablePackages.find((item) => item.packageType === PACKAGE_TYPE.MONTHLY) ??
      offering.availablePackages.find((item) => /month/i.test(item.identifier))
    );
  }

  return (
    offering.annual ??
    offering.availablePackages.find((item) => item.packageType === PACKAGE_TYPE.ANNUAL) ??
    offering.availablePackages.find((item) => /(year|annual)/i.test(item.identifier))
  );
}

function toBillingPlan(plan: Exclude<SubscriptionPlan, "none">, purchasesPackage: PurchasesPackage): BillingPlan {
  return {
    plan,
    packageIdentifier: purchasesPackage.identifier,
    productIdentifier: purchasesPackage.product.identifier,
    priceString: purchasesPackage.product.priceString,
    title: purchasesPackage.product.title,
    period: purchasesPackage.product.subscriptionPeriod ?? undefined
  };
}

function mapCustomerInfo(customerInfo: CustomerInfo): RevenueCatEntitlementState {
  const activeEntitlement = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
  const knownEntitlement = activeEntitlement ?? customerInfo.entitlements.all[REVENUECAT_ENTITLEMENT_ID];
  const subscriptionStatus = getSubscriptionStatus(knownEntitlement);
  return {
    subscriptionStatus,
    plan: subscriptionStatus === "active" ? inferPlan(knownEntitlement?.productIdentifier, knownEntitlement?.productPlanIdentifier) : "none",
    expiresAt: knownEntitlement?.expirationDate ?? customerInfo.latestExpirationDate ?? undefined,
    source: mapSource(knownEntitlement?.store),
    managementUrl: customerInfo.managementURL ?? undefined
  };
}

function getSubscriptionStatus(entitlement: CustomerInfo["entitlements"]["all"][string] | undefined): SubscriptionStatus {
  if (!entitlement) return "free";
  if (entitlement.isActive) return "active";
  if (entitlement.unsubscribeDetectedAt) return "cancelled";
  if (entitlement.expirationDate) return "expired";
  return "free";
}

function inferPlan(productIdentifier?: string, productPlanIdentifier?: string | null): SubscriptionPlan {
  const planKey = `${productIdentifier ?? ""} ${productPlanIdentifier ?? ""}`.toLowerCase();
  if (/(year|annual)/.test(planKey)) return "yearly";
  if (/month/.test(planKey)) return "monthly";
  return "none";
}

function mapSource(store?: string): SubscriptionSource {
  if (store === "PLAY_STORE") return "play_store";
  if (store === "APP_STORE" || store === "MAC_APP_STORE") return "app_store";
  return "none";
}
