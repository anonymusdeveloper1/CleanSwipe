import { Alert, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { BarChart3, Bolt, BrushCleaning, Headphones, Images, Palette, ShieldOff, Star } from "lucide-react-native";
import { AdBanner } from "@/components/ad-banner";
import { AppHeader } from "@/components/app-header";
import { PremiumCard } from "@/components/premium-card";
import { useAppTheme } from "@/hooks/use-app-theme";

export function PremiumScreen() {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 380 ? 18 : 22;
  const contentWidth = Math.min(width - horizontalPadding * 2, 680);
  const useSingleColumn = contentWidth < 360;
  const featureGap = 10;
  const featureWidth = useSingleColumn ? "100%" : (contentWidth - featureGap) / 2;
  const heroIconSize = width < 360 ? 62 : 76;
  const titleSize = width < 360 ? 28 : width > 600 ? 38 : 32;
  const benefits = [
    { icon: ShieldOff, title: "Remove ads" },
    { icon: BarChart3, title: "Advanced stats" },
    { icon: Bolt, title: "Faster cleanup" },
    { icon: Images, title: "Smart largest-photo finder" },
    { icon: Palette, title: "More themes" },
    { icon: Headphones, title: "Priority support" }
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 28 }}>
      <AppHeader />
      <View style={{ width: contentWidth, alignSelf: "center", gap: 18 }}>
        <View style={{ gap: 16, alignItems: "center", paddingTop: 2 }}>
          <View
            style={{
              width: heroIconSize,
              height: heroIconSize,
              borderRadius: heroIconSize / 2,
              backgroundColor: theme.accent,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 26px rgba(7, 94, 200, 0.22)"
            }}
          >
            <Star size={heroIconSize * 0.48} color="#fff" fill="#fff" />
          </View>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Text selectable numberOfLines={2} adjustsFontSizeToFit style={{ color: theme.text, fontSize: titleSize, lineHeight: titleSize + 5, fontWeight: "900", textAlign: "center" }}>
              SwipeClean Pro
            </Text>
            <Text selectable style={{ color: theme.muted, fontSize: width < 360 ? 16 : 18, lineHeight: width < 360 ? 22 : 25, textAlign: "center", maxWidth: 520 }}>
              A cleaner, faster version for people who want to review media without ads or friction.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <MetricPill label="No ads" value="Clean focus" />
          <MetricPill label="Tools" value="More control" />
        </View>

        <PremiumCard compact={width < 380} onPress={() => Alert.alert("SwipeClean Pro is coming soon.")} />

        <View style={{ gap: 12 }}>
          <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "900" }}>
            What's included
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: featureGap }}>
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <View
                  key={benefit.title}
                  style={{
                    width: featureWidth,
                    minHeight: 88,
                    backgroundColor: theme.surfaceSoft,
                    borderRadius: 8,
                    padding: 14,
                    gap: 10,
                    borderWidth: 1,
                    borderColor: theme.border
                  }}
                >
                  <Icon size={23} color={theme.accent} />
                  <Text selectable numberOfLines={2} style={{ color: theme.text, fontSize: 15, lineHeight: 20, fontWeight: "900" }}>
                    {benefit.title}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ backgroundColor: theme.surface, borderRadius: 8, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <BrushCleaning size={22} color={theme.accent} />
            <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: "900", flexShrink: 1 }}>
              Built for big cleanup sessions
            </Text>
          </View>
          <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 22 }}>
            Pro keeps the same simple swipe flow, then adds deeper cleanup tools for heavier galleries and frequent use.
          </Text>
        </View>

        <AdBanner />
      </View>
    </ScrollView>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flex: 1, minHeight: 58, borderRadius: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" }}>
      <Text selectable numberOfLines={1} style={{ color: theme.accent, fontSize: 13, fontWeight: "900" }}>
        {label}
      </Text>
      <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.text, fontSize: 15, fontWeight: "800" }}>
        {value}
      </Text>
    </View>
  );
}
