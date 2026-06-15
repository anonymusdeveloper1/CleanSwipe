import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AdBanner } from "@/components/ad-banner";
import { AppHeader } from "@/components/app-header";
import { StatsCard } from "@/components/stats-card";
import { SwipeDistributionChart } from "@/components/swipe-distribution-chart";
import { AdvancedStatsLockedCard } from "@/features/advanced-stats/components/advanced-stats-locked-card";
import { AdvancedStatsSection } from "@/features/advanced-stats/components/advanced-stats-section";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
import { useIndexedMediaAssets } from "@/store/media-index-store";
import { usePaywallStore } from "@/store/paywall-store";
import { formatBytes, sumBytes } from "@/utils/format";

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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingBottom: 24 }}>
      <AppHeader />
      <View style={{ paddingHorizontal: 20, gap: 20 }}>
        <View>
          <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>
            {t("stats.title")}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 16 }}>
            {t("stats.subtitle")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <StatsCard label={t("stats.totalUsed")} value={formatBytes(sumBytes(photos))} />
          <StatsCard label={t("stats.spaceCleared")} value={formatBytes(stats.totalDeletedSpaceBytes)} tone="green" />
        </View>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <StatsCard label={t("stats.photosScanned")} value={photos.length.toLocaleString()} />
          <StatsCard label={t("stats.marked")} value={marked.length.toString()} tone="red" />
        </View>
        <SwipeDistributionChart stats={stats} />
        {/* Advanced stats (Pro). Independent of the loadingPhotos guard — events
            are not media-index-derived, so a media reconcile must not hide it. */}
        {canUseFeature("advancedStats") ? (
          <AdvancedStatsSection />
        ) : (
          <AdvancedStatsLockedCard onPress={() => openPaywall("advancedStats")} />
        )}
        <AdBanner />
      </View>
    </ScrollView>
  );
}
