import { router } from "expo-router";
import { BarChart3 } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AdBanner } from "@/components/ad-banner";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { MediaThumbnail } from "@/components/media-thumbnail";
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
  const largest = [...photos].filter((photo) => photo.sizeBytes).sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0)).slice(0, 2);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 24 }}>
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
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>
            {t("stats.largestPhotos")}
          </Text>
          <Pressable onPress={() => router.push("/largest-photos")}>
            <Text style={{ color: theme.accent, fontSize: 16, fontWeight: "700" }}>{t("stats.viewAllLargest")}</Text>
          </Pressable>
        </View>
        {largest.length === 0 ? (
          <EmptyState icon={BarChart3} title={t("stats.emptyTitle")} message={t("stats.emptyMessage")} />
        ) : (
          <View style={{ flexDirection: "row", gap: 14 }}>
            {largest.map((photo) => (
              <View key={photo.id} style={{ flex: 1, aspectRatio: 0.78, borderRadius: 14, overflow: "hidden", backgroundColor: theme.surfaceStrong }}>
                <MediaThumbnail uri={photo.uri} id={photo.id} mediaType={photo.mediaType} contentFit="contain" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
                <View style={{ position: "absolute", right: 10, bottom: 10, backgroundColor: "rgba(0,0,0,0.68)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7 }}>
                  <Text selectable style={{ color: "#fff", fontWeight: "800" }}>
                    {formatBytes(photo.sizeBytes)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
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
