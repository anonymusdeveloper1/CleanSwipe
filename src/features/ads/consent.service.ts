import { AdsConsent } from "react-native-google-mobile-ads";

/**
 * GDPR / UMP (User Messaging Platform) consent.
 *
 * Google requires gathering consent BEFORE initializing the Mobile Ads SDK and
 * loading ads. `gatherConsent()` requests the latest consent info and, when the
 * UMP rules require it (e.g. an EEA/UK user on first run), loads and shows the
 * consent form. Outside regulated regions it is effectively a no-op.
 *
 * This FAILS OPEN: any error resolves to `true` so a consent failure can never
 * block ad initialization or strand the app. (Where consent is required but not
 * obtained, AdMob still serves limited/non-personalized ads.)
 *
 * Before a production release you must also configure the consent form and
 * privacy message in the AdMob console (Privacy & messaging → GDPR/CCPA).
 */
export const AdsConsentService = {
  /** Gather UMP consent. Returns whether ads may be requested (best-effort). */
  async gather(): Promise<boolean> {
    try {
      const info = await AdsConsent.gatherConsent();
      return info.canRequestAds ?? true;
    } catch {
      return true; // never block ads on a consent error
    }
  }
};
