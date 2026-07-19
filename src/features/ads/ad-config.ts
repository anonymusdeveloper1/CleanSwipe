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
 * PENDING before an iOS release: the real iOS AdMob App ID — app.json `iosAppId`
 * (and Info.plist GADApplicationIdentifier) is still Google's sample ~1458002511.
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
const USE_TEST_ADS = __DEV__ || process.env.EXPO_PUBLIC_ADS_USE_TEST === "1";

export const BANNER_AD_UNIT_ID = USE_TEST_ADS
  ? TestIds.BANNER
  : Platform.select({ android: ANDROID_BANNER, ios: IOS_BANNER, default: TestIds.BANNER });

export const INTERSTITIAL_AD_UNIT_ID = USE_TEST_ADS
  ? TestIds.INTERSTITIAL
  : Platform.select({ android: ANDROID_INTERSTITIAL, ios: IOS_INTERSTITIAL, default: TestIds.INTERSTITIAL });

export const REWARDED_AD_UNIT_ID = USE_TEST_ADS
  ? TestIds.REWARDED
  : Platform.select({ android: ANDROID_REWARDED, ios: IOS_REWARDED, default: TestIds.REWARDED });
