import { Text, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AdsService } from "@/services/ads-service";

export function AdBanner() {
  const theme = useAppTheme();
  return (
    <View style={{ minHeight: 36, borderRadius: 8, backgroundColor: theme.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
      <Text selectable style={{ color: theme.muted, fontSize: 12, fontWeight: "600" }}>
        {AdsService.getBannerLabel()}
      </Text>
    </View>
  );
}
