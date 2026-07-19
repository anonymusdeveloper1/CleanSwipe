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

export const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : Platform.select({ android: ANDROID_BANNER, ios: IOS_BANNER, default: TestIds.BANNER });

export const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.select({ android: ANDROID_INTERSTITIAL, ios: IOS_INTERSTITIAL, default: TestIds.INTERSTITIAL });

export const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : Platform.select({ android: ANDROID_REWARDED, ios: IOS_REWARDED, default: TestIds.REWARDED });
