import { LinearGradient } from "expo-linear-gradient";
import { BarChart3, HardDrive, Images, Sparkles, Trash2, type LucideIcon } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AdBanner } from "@/components/ad-banner";
import { AnimatedStatValue } from "@/components/animated-stat-value";
import { AppHeader } from "@/components/app-header";
import { SwipeDistributionChart } from "@/components/swipe-distribution-chart";
import { AdvancedStatsLockedCard } from "@/features/advanced-stats/components/advanced-stats-locked-card";
import { AdvancedStatsSection } from "@/features/advanced-stats/components/advanced-stats-section";
import { ConvertStatsSection } from "@/features/convert/components/convert-stats-section";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
import { useIndexedMediaAssets } from "@/store/media-index-store";
import { usePaywallStore } from "@/store/paywall-store";
import { formatBytes, sumBytes } from "@/utils/format";

// Darken a #RRGGBB token toward black by `amount` (0..1) — used for the hero's
// two-stop gradient so it reads as a single accent surface, not a flat block.
function shade(hex: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const f = Math.max(0, Math.min(1, 1 - amount));
  const channel = (i: number) =>
    Math.round(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * f)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.max(0, Math.min(alpha, 1)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

export function StatsScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const stats = useAppStore((state) => state.stats);
  const loadingPhotos = useAppStore((state) => state.loadingPhotos);
  const { canUseFeature } = useFeatureAccess();
  const openPaywall = usePaywallStore((state) => state.open);
  const indexedPhotos = useIndexedMediaAssets();
  // While the index is being reconciled (e.g. pruning to the accessible set
  // under "selected photos" access), don't derive stats from the not-yet-pruned
  // index — that would briefly show inflated counts/sizes for media we can't read.
  const photos = loadingPhotos ? [] : indexedPhotos;
  const marked = useAppStore((state) => state.markedForDeletion);

  const reviewed = stats.totalKept + stats.totalMarkedForDeletion + stats.totalRestored;
  const libraryBytes = sumBytes(photos);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingBottom: 28 }}>
      <AppHeader />
      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        <View>
          <Text selectable style={{ color: theme.text, fontSize: 24, fontWeight: "900" }}>
            {t("stats.title")}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 15 }}>
            {t("stats.subtitle")}
          </Text>
        </View>

        {/* Hero: total space reclaimed, big + animated. */}
        <Animated.View entering={FadeInDown.duration(420)}>
          <LinearGradient
            colors={[theme.accent, shade(theme.accent, 0.28)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 24, padding: 22, overflow: "hidden" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color="#ffffff" />
              <Text selectable style={{ color: "#ffffff", fontSize: 14, fontWeight: "800", opacity: 0.92 }}>
                {t("stats.reclaimed")}
              </Text>
            </View>
            <AnimatedStatValue
              value={stats.totalDeletedSpaceBytes}
              format={(n) => formatBytes(n)}
              style={{ color: "#ffffff", fontSize: 40, fontWeight: "900", fontVariant: ["tabular-nums"], marginTop: 6 }}
            />
            <Text selectable style={{ color: "#ffffff", fontSize: 13, fontWeight: "700", opacity: 0.85, marginTop: 2 }}>
              {t("stats.itemsReviewed", { count: reviewed })}
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Quick stat grid. */}
        <Animated.View entering={FadeInDown.duration(420).delay(70)} style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatTile icon={HardDrive} label={t("stats.totalUsed")} value={libraryBytes} format={formatBytes} tone={theme.accent} />
            <StatTile icon={Images} label={t("stats.photosScanned")} value={photos.length} tone={theme.accent} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatTile icon={Sparkles} label={t("stats.spaceCleared")} value={stats.totalDeletedSpaceBytes} format={formatBytes} tone={theme.green} />
            <StatTile icon={Trash2} label={t("stats.marked")} value={marked.length} tone={theme.red} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(140)}>
          <SwipeDistributionChart stats={stats} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(210)}>
          <ConvertStatsSection />
        </Animated.View>

        {/* Advanced stats (Pro). Independent of the loadingPhotos guard — events
            are not media-index-derived, so a media reconcile must not hide it. */}
        <Animated.View entering={FadeInDown.duration(420).delay(280)}>
          {canUseFeature("advancedStats") ? (
            <AdvancedStatsSection />
          ) : (
            <AdvancedStatsLockedCard onPress={() => openPaywall("advancedStats")} />
          )}
        </Animated.View>

        <AdBanner />
      </View>
    </ScrollView>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  format
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: string;
  format?: (n: number) => string;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        minHeight: 96,
        padding: 15,
        borderRadius: 16,
        backgroundColor: theme.surfaceSoft,
        borderWidth: 1,
        borderColor: theme.border,
        justifyContent: "space-between",
        gap: 10
      }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(tone, 0.15) }}>
        <Icon size={17} color={tone} strokeWidth={2.4} />
      </View>
      <View style={{ gap: 2 }}>
        <AnimatedStatValue value={value} format={format} style={{ color: tone, fontSize: 21, fontWeight: "900", fontVariant: ["tabular-nums"] }} />
        <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "600" }}>
          {label}
        </Text>
      </View>
    </View>
  );
}
