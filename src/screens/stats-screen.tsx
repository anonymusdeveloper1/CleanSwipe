import { router } from "expo-router";
import { BarChart3 } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AdBanner } from "@/components/ad-banner";
import { AppHeader } from "@/components/app-header";
import { CachedImage } from "@/components/cached-image";
import { EmptyState } from "@/components/empty-state";
import { StatsCard } from "@/components/stats-card";
import { SwipeDistributionChart } from "@/components/swipe-distribution-chart";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
import { formatBytes, sumBytes } from "@/utils/format";

export function StatsScreen() {
  const theme = useAppTheme();
  const stats = useAppStore((state) => state.stats);
  const photos = useAppStore((state) => state.photos);
  const marked = useAppStore((state) => state.markedForDeletion);
  const largest = [...photos].filter((photo) => photo.sizeBytes).sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0)).slice(0, 2);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 24 }}>
      <AppHeader />
      <View style={{ paddingHorizontal: 20, gap: 20 }}>
        <View>
          <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>
            Storage Stats
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 16 }}>
            Analysis of your visual ecosystem.
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <StatsCard label="Total Used" value={formatBytes(sumBytes(photos))} />
          <StatsCard label="Space Cleared" value={formatBytes(stats.totalDeletedSpaceBytes)} tone="green" />
        </View>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <StatsCard label="Photos Scanned" value={photos.length.toLocaleString()} />
          <StatsCard label="Marked" value={marked.length.toString()} tone="red" />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>
            Largest Photos
          </Text>
          <Pressable onPress={() => router.push("/largest-photos")}>
            <Text style={{ color: theme.accent, fontSize: 16, fontWeight: "700" }}>View All Largest</Text>
          </Pressable>
        </View>
        {largest.length === 0 ? (
          <EmptyState icon={BarChart3} title="Start swiping to see your cleanup stats." message="Largest photo insights appear once photos are loaded." />
        ) : (
          <View style={{ flexDirection: "row", gap: 14 }}>
            {largest.map((photo) => (
              <View key={photo.id} style={{ flex: 1, aspectRatio: 0.78, borderRadius: 14, overflow: "hidden", backgroundColor: theme.surfaceStrong }}>
                <CachedImage uri={photo.uri} contentFit="contain" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
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
        <AdBanner />
      </View>
    </ScrollView>
  );
}
