import { View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { BANNER_AD_UNIT_ID } from "@/features/ads/ad-config";
import { useAdsVisibility } from "@/features/subscription/use-ads-visibility";

export function AdBanner() {
  const { shouldShowAds } = useAdsVisibility();
  // Pro users hide ads entirely.
  if (!shouldShowAds) return null;
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}
