import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { BrushCleaning, Images, Play, Settings } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "@/components/cached-image";
import { EmptyState } from "@/components/empty-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PhotoAsset } from "@/models/photo";
import { CompressionService } from "@/services/compression-service";
import { PermissionService } from "@/services/permission-service";
import { useAppStore } from "@/store/app-store";
import { formatBytes } from "@/utils/format";

type CleanupFilter = "all" | "video" | "photo" | "done";

const filters: { key: CleanupFilter; label: string }[] = [
  { key: "all", label: "All Media" },
  { key: "video", label: "Videos" },
  { key: "photo", label: "Large Photos" },
  { key: "done", label: "Done" }
];

export function HistoryScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [activeFilter, setActiveFilter] = useState<CleanupFilter>("all");
  const [batching, setBatching] = useState(false);
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const requestPhotoPermission = useAppStore((state) => state.requestPhotoPermission);
  const permission = useAppStore((state) => state.permission);
  const loadingPhotos = useAppStore((state) => state.loadingPhotos);
  const requestingPermission = useAppStore((state) => state.requestingPermission);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const error = useAppStore((state) => state.error);
  const photos = useAppStore((state) => state.photos);
  const compressedMedia = useAppStore((state) => state.compressedMedia);
  const compressAllEligible = useAppStore((state) => state.compressAllEligible);
  const compressingIds = useAppStore((state) => state.compressingIds);
  const compressionError = useAppStore((state) => state.compressionError);

  useEffect(() => {
    if (hasHydrated) {
      void loadInitialData();
    }
  }, [hasHydrated, loadInitialData]);

  const needsMediaPermission = permission.status !== "granted" && permission.status !== "limited";
  const compressedSourceIds = useMemo(() => new Set(compressedMedia.map((item) => item.sourceId)), [compressedMedia]);
  const heavyMedia = useMemo(
    () =>
      photos.filter((photo) => {
        const alreadyCompressed = compressedSourceIds.has(photo.id);
        if (activeFilter === "done") return alreadyCompressed;
        if (alreadyCompressed) return false;
        if (!CompressionService.isCompressible(photo)) return false;
        if (activeFilter === "video") return photo.mediaType === "video";
        if (activeFilter === "photo") return photo.mediaType === "photo";
        return photo.mediaType === "video" || photo.mediaType === "photo";
      }),
    [activeFilter, compressedSourceIds, photos]
  );
  const totalHeavyBytes = useMemo(
    () => heavyMedia.reduce((sum, item) => sum + CompressionService.estimate(item).originalBytes, 0),
    [heavyMedia]
  );
  const totalPotentialSavings = useMemo(
    () => heavyMedia.reduce((sum, item) => sum + CompressionService.estimate(item).savedBytes, 0),
    [heavyMedia]
  );
  const summaryText =
    activeFilter === "done" && heavyMedia.length > 0
      ? `You've already compressed ${heavyMedia.length} media item${heavyMedia.length === 1 ? "" : "s"}.`
      : activeFilter === "done"
        ? "Done media will appear here after you optimize photos or videos."
        : heavyMedia.length > 0
      ? `We've identified ${formatBytes(totalHeavyBytes)} of heavy media that can be optimized without losing quality.`
      : "No heavy media found yet. Large photos and videos will appear here when they are available.";
  const cardGap = 10;
  const horizontalPadding = width < 380 ? 14 : 16;
  const cardWidth = Math.floor((width - horizontalPadding * 2 - cardGap) / 2);
  const isCompressing = batching || compressingIds.length > 0;

  const handleCompressAll = () => {
    if (activeFilter === "done" || heavyMedia.length === 0 || isCompressing) return;
    setBatching(true);
    void compressAllEligible("medium", activeFilter).finally(() => setBatching(false));
  };

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <CompactCleanupHeader />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text selectable style={{ color: theme.muted, fontSize: 16, fontWeight: "800", textAlign: "center" }}>
            Loading your media library...
          </Text>
        </View>
      </View>
    );
  }

  if (needsMediaPermission) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <CompactCleanupHeader />
        <EmptyState
          icon={BrushCleaning}
          title="Allow media access"
          message={error ?? "SwipeClean needs access to your photos and videos so it can find heavy media on this device."}
          actionLabel={requestingPermission ? "Requesting..." : "Allow Access"}
          onAction={requestPhotoPermission}
        />
        <View style={{ paddingHorizontal: 28 }}>
          <Pressable onPress={PermissionService.openSettings} style={{ alignItems: "center", padding: 16 }}>
            <Text style={{ color: theme.accent, fontWeight: "800", fontSize: 16 }}>Open Settings</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={heavyMedia}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={
          <View>
            <CompactCleanupHeader />
            <View style={{ paddingHorizontal: horizontalPadding, paddingTop: 12, paddingBottom: 12, gap: 10 }}>
              <View style={{ gap: 5 }}>
                <Text selectable style={{ color: theme.text, fontSize: 24, lineHeight: 29, fontWeight: "900" }}>
                  Ready to Compress
                </Text>
                <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
                  {summaryText}
                </Text>
              </View>
              {heavyMedia.length > 0 && activeFilter !== "done" ? (
                <View style={{ alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border }}>
                  <Text selectable style={{ color: theme.text, fontSize: 12, fontWeight: "900" }}>
                    Estimated savings: {formatBytes(totalPotentialSavings)}
                  </Text>
                </View>
              ) : null}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingRight: horizontalPadding }}
                style={{ marginRight: -horizontalPadding }}
              >
                {filters.map((filter) => {
                  const active = activeFilter === filter.key;
                  return (
                    <Pressable
                      key={filter.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setActiveFilter(filter.key)}
                      style={{
                        minHeight: 32,
                        borderRadius: 16,
                        paddingHorizontal: 13,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active ? theme.accent : "transparent",
                        borderWidth: 1.2,
                        borderColor: active ? theme.accent : theme.muted
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : theme.text, fontSize: 14, fontWeight: active ? "800" : "700" }}>
                        {filter.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {heavyMedia.length > 0 && activeFilter !== "done" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Compress all ${formatBytes(totalHeavyBytes)} of heavy media`}
                  disabled={isCompressing}
                  onPress={handleCompressAll}
                  style={{
                    minHeight: 46,
                    borderRadius: 10,
                    backgroundColor: theme.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                    opacity: isCompressing ? 0.78 : 1
                  }}
                >
                  {isCompressing ? <ActivityIndicator color="#fff" /> : <BrushCleaning size={20} color="#fff" />}
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>
                    {isCompressing ? "Compressing..." : `Compress All (${formatBytes(totalHeavyBytes)})`}
                  </Text>
                </Pressable>
              ) : null}
              {compressionError ? (
                <Text selectable style={{ color: theme.red, fontSize: 15, fontWeight: "700" }}>
                  {compressionError}
                </Text>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={Images}
            title={loadingPhotos ? "Scanning media..." : "No heavy media found"}
            message={loadingPhotos ? "SwipeClean is checking this device for compressible photos and videos." : activeFilter === "done" ? "Done media will appear here after you optimize photos or videos." : "Large photos and videos will appear here when they are available."}
            actionLabel={loadingPhotos ? undefined : "Refresh"}
            onAction={loadingPhotos ? undefined : loadInitialData}
          />
        }
        columnWrapperStyle={{ gap: cardGap, paddingHorizontal: horizontalPadding }}
        contentContainerStyle={{ paddingBottom: 20 + insets.bottom, gap: 10 }}
        renderItem={({ item }) => <MediaCard asset={item} width={cardWidth} />}
      />
    </View>
  );
}

function CompactCleanupHeader() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
          <BrushCleaning size={26} color={theme.accent} strokeWidth={2.5} />
          <Text selectable numberOfLines={1} style={{ color: theme.accent, fontSize: 24, fontWeight: "900", flexShrink: 1 }}>
            SwipeClean
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.push("/settings")}
          style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}
        >
          <Settings size={27} color={theme.text} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

function MediaCard({ asset, width }: { asset: PhotoAsset; width: number }) {
  const theme = useAppTheme();
  const compressingIds = useAppStore((state) => state.compressingIds);
  const progress = useAppStore((state) => state.compressionProgress[asset.id] ?? 0);
  const result = useAppStore((state) => state.compressedMedia.find((item) => item.sourceId === asset.id));
  const estimate = CompressionService.estimate(asset);
  const isVideo = asset.mediaType === "video";
  const isCompressing = compressingIds.includes(asset.id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open compression detail for ${asset.filename ?? "media"}`}
      onPress={() => router.push(`/compression-detail?id=${encodeURIComponent(asset.id)}` as never)}
      style={{
        width,
        aspectRatio: 0.9,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: theme.surfaceStrong,
        borderWidth: 1,
        borderColor: theme.border
      }}
    >
      <MediaImage asset={asset} />
      <LinearGradient
        colors={["rgba(5,7,13,0)", "rgba(5,7,13,0.68)", "rgba(5,7,13,0.92)"]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 82 }}
      />
      <View
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          borderRadius: 8,
          paddingHorizontal: 9,
          paddingVertical: 6,
          backgroundColor: result ? theme.accent : "#047857"
        }}
      >
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
          {result ? "Done" : `Save ${estimate.savePercent}%`}
        </Text>
      </View>
      {isVideo ? (
        <View style={{ position: "absolute", left: 10, bottom: 44, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.34)", alignItems: "center", justifyContent: "center" }}>
          <Play size={15} color="#fff" fill="#fff" />
        </View>
      ) : null}
      <View style={{ position: "absolute", left: 12, right: 10, bottom: 11 }}>
        <Text selectable numberOfLines={1} style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
          {asset.filename ?? (isVideo ? "Video" : "Photo")}
        </Text>
        <Text selectable numberOfLines={1} style={{ color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: "700" }}>
          {formatBytes(estimate.originalBytes)} {"->"} {formatBytes(result?.compressedBytes ?? estimate.compressedBytes)}
        </Text>
      </View>
      {isCompressing ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 5, backgroundColor: "rgba(255,255,255,0.24)" }}>
          <View style={{ width: `${Math.max(progress * 100, 4)}%`, height: 5, backgroundColor: "#fff" }} />
        </View>
      ) : null}
    </Pressable>
  );
}

function MediaImage({ asset }: { asset: PhotoAsset }) {
  const theme = useAppTheme();
  const [uri, setUri] = useState(asset.uri);

  useEffect(() => {
    let mounted = true;
    setUri(asset.uri);
    if (asset.mediaType === "video") {
      CompressionService.createThumbnail(asset)
        .then((thumbnailUri) => {
          if (mounted) setUri(thumbnailUri);
        })
        .catch(() => undefined);
    }
    return () => {
      mounted = false;
    };
  }, [asset]);

  return <CachedImage uri={uri} contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />;
}
