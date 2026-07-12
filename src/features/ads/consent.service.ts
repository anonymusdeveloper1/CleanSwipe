import { AdsConsent } from "react-native-google-mobile-ads";

/**
 * GDPR / UMP (User Messaging Platform) consent.
 *
 * Google requires gathering consent BEFORE initializing the Mobile Ads SDK and
 * loading ads. `gatherConsent()` requests the latest consent info and, when the
 * UMP rules require it (e.g. an EEA/UK user on first run), loads and shows the
 * consent form. Outside regulated regions it is effectively a no-op.
 *
 * This FAILS CLOSED: any error resolves to `false` so an ad request can never fire
 * without a confirmed UMP `canRequestAds`. Compliance (Google UMP / GDPR) takes
 * priority over showing ads — a consent failure simply means no ads this session,
 * never an unconsented ad request that could get the AdMob account flagged. The
 * app itself is never blocked (missing ads is non-fatal).
 *
 * Before a production release you must also configure the consent form and
 * privacy message in the AdMob console (Privacy & messaging → GDPR/CCPA).
 */
export const AdsConsentService = {
  /** Gather UMP consent. Returns whether ads may be requested (fail-closed). */
  async gather(): Promise<boolean> {
    try {
      const info = await AdsConsent.gatherConsent();
      return info.canRequestAds ?? false;
    } catch {
      return false; // fail closed: never request ads on a consent error
    }
  }
};
