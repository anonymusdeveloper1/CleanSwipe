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
 * iOS has no native project yet; iOS unit IDs are placeholders for later.
 */

const ANDROID_BANNER = "ca-app-pub-5256708773143000/3772562348";
const ANDROID_INTERSTITIAL = "ca-app-pub-5256708773143000/2274476985";

// TODO: replace with real iOS ad unit IDs once an iOS app/build exists.
const IOS_BANNER = TestIds.BANNER;
const IOS_INTERSTITIAL = TestIds.INTERSTITIAL;

// TODO: create a real AdMob REWARDED unit (Android + iOS) before release; none
// exists yet, so we point at Google's test rewarded unit on every platform for now.
const ANDROID_REWARDED = TestIds.REWARDED;
const IOS_REWARDED = TestIds.REWARDED;

export const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : Platform.select({ android: ANDROID_BANNER, ios: IOS_BANNER, default: TestIds.BANNER });

export const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.select({ android: ANDROID_INTERSTITIAL, ios: IOS_INTERSTITIAL, default: TestIds.INTERSTITIAL });

export const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : Platform.select({ android: ANDROID_REWARDED, ios: IOS_REWARDED, default: TestIds.REWARDED });
