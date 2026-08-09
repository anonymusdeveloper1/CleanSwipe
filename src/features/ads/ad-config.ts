import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

/**
 * AdMob ad unit IDs.
 *
 * SAFETY: in development (__DEV__) we ALWAYS serve Google's official test ads.
 * Loading or tapping a real ad unit on your own device is the #1 way to get an
 * AdMob account banned, so the real IDs are only used in production builds.
 *
 * The App ID lives in app.json (react-native-google-mobile-ads plugin), not here.
 * Android + iOS unit IDs are real and release-gated; __DEV__ always serves TestIds.
 * Both platforms' App IDs are real (app.json `androidAppId`/`iosAppId`).
 */

const ANDROID_BANNER = "ca-app-pub-5256708773143000/3772562348";
const ANDROID_INTERSTITIAL = "ca-app-pub-5256708773143000/2274476985";

// Real iOS ad units (wired 2026-07-17; __DEV__ still serves TestIds).
const IOS_BANNER = "ca-app-pub-5256708773143000/3231384714";
const IOS_INTERSTITIAL = "ca-app-pub-5256708773143000/1238957839";

// Real rewarded units (used in release; __DEV__ still serves test ads).
const ANDROID_REWARDED = "ca-app-pub-5256708773143000/4491543800";
const IOS_REWARDED = "ca-app-pub-5256708773143000/7964836642";

// Serve Google's official TEST ads whenever this is true. It is true in dev
// (__DEV__) AND in any build made with EXPO_PUBLIC_ADS_USE_TEST=1 — used for Play
// closed-testing builds so testers can NEVER load or tap a real ad (the #1 cause
// of AdMob account bans). Production builds leave the flag unset, so real units
// serve. A closed-testing AAB built with this flag must NOT be promoted to
// production — build production separately (flag unset, higher versionCode).
const FORCED_TEST_ADS = process.env.EXPO_PUBLIC_ADS_USE_TEST === "1";
const USE_TEST_ADS = __DEV__ || FORCED_TEST_ADS;

/**
 * TRUE when a RELEASE build is serving test ads because EXPO_PUBLIC_ADS_USE_TEST
 * was set at bundle time. Such a build earns $0 and must never be promoted to
 * production. Metro inlines EXPO_PUBLIC_* at BUILD time, so this cannot be
 * checked from outside the bundle — the value is baked in.
 *
 * Exported so `assertAdConfigIsProductionSafe()` can shout about it at startup,
 * and so a release-checklist test could assert it is false.
 */
export const IS_RELEASE_BUILD_WITH_TEST_ADS = !__DEV__ && FORCED_TEST_ADS;

/**
 * Log a loud, greppable banner when a release build was bundled with forced test
 * ads. This is the ONLY in-app signal that an AAB is a closed-testing artifact —
 * the repo has already produced one such bundle (versionCode 5) whose sole guard
 * was a source comment. Call once during ad initialisation.
 */
export function assertAdConfigIsProductionSafe(): void {
  if (!IS_RELEASE_BUILD_WITH_TEST_ADS) return;
  console.warn(
    "[ads] RELEASE BUILD IS SERVING TEST ADS — EXPO_PUBLIC_ADS_USE_TEST=1 was set at bundle time. " +
      "This build earns no revenue and MUST NOT be promoted to production. " +
      "Rebuild with the flag unset (and a higher versionCode) for a production release."
  );
}

export const BANNER_AD_UNIT_ID = USE_TEST_ADS
  ? TestIds.BANNER
  : Platform.select({ android: ANDROID_BANNER, ios: IOS_BANNER, default: TestIds.BANNER });

export const INTERSTITIAL_AD_UNIT_ID = USE_TEST_ADS
  ? TestIds.INTERSTITIAL
  : Platform.select({ android: ANDROID_INTERSTITIAL, ios: IOS_INTERSTITIAL, default: TestIds.INTERSTITIAL });

export const REWARDED_AD_UNIT_ID = USE_TEST_ADS
  ? TestIds.REWARDED
  : Platform.select({ android: ANDROID_REWARDED, ios: IOS_REWARDED, default: TestIds.REWARDED });
