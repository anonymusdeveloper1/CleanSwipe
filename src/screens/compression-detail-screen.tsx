import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BrushCleaning, CheckCircle2, Info, Play, Settings, SlidersHorizontal, Sparkles, Video } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "@/components/cached-image";
import { EmptyState } from "@/components/empty-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { CompressionQuality, PhotoAsset } from "@/models/photo";
import { CompressionService, compressionProfiles } from "@/services/compression-service";
import { useAppStore } from "@/store/app-store";
import { formatBytes, formatResolution } from "@/utils/format";

const qualityOptions: CompressionQuality[] = ["low", "medium", "high"];

export function CompressionDetailScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quality, setQuality] = useState<CompressionQuality>("medium");
  const photos = useAppStore((state) => state.photos);
  const compressedMedia = useAppStore((state) => state.compressedMedia);
  const compressingIds = useAppStore((state) => state.compressingIds);
  const progress = useAppStore((state) => state.compressionProgress[id ?? ""] ?? 0);
  const compressionError = useAppStore((state) => state.compressionError);
  const compressMedia = useAppStore((state) => state.compressMedia);
  const asset = photos.find((item) => item.id === id);
  const result = compressedMedia.find((item) => item.sourceId === id);
  const isCompressing = Boolean(id && compressingIds.includes(id));
  const estimate = useMemo(() => (asset ? CompressionService.estimate(asset, quality) : undefined), [asset, quality]);
  const displayOriginal = result?.originalBytes ?? estimate?.originalBytes ?? 0;
  const displayCompressed = result?.compressedBytes ?? estimate?.compressedBytes ?? 0;
  const displaySaved = result?.savedBytes ?? estimate?.savedBytes ?? 0;
  const horizontalPadding = width < 380 ? 16 : 20;
  const contentWidth = Math.min(width - horizontalPadding * 2, 680);
  const compact = width < 380 || height < 720;

  const handleCompress = () => {
    if (!asset || isCompressing) return;
    void compressMedia(asset.id, quality);
  };

  if (!asset) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
        <DetailHeader compact={compact} />
        <EmptyState icon={BrushCleaning} title="Media not found" message="This item is no longer available in the device library." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: (compact ? 88 : 104) + insets.bottom }}
      >
        <DetailHeader compact={compact} />
        <View style={{ width: contentWidth, alignSelf: "center", paddingTop: compact ? 12 : 18, gap: compact ? 14 : 18 }}>
          <View style={{ flexDirection: width < 430 ? "column" : "row", alignItems: width < 430 ? "flex-start" : "center", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
              {asset.mediaType === "video" ? <Video size={23} color={theme.accent} /> : <BrushCleaning size={23} color={theme.accent} />}
              <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.text, fontSize: compact ? 17 : 20, letterSpacing: 0, fontWeight: "900", flexShrink: 1 }}>
                {asset.mediaType === "video" ? "Video compression" : "Photo compression"}
              </Text>
            </View>
            <View style={{ borderRadius: 12, backgroundColor: "#5eeab0", paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: "#065f46", fontSize: 12, fontWeight: "900" }}>
                {asset.mediaType === "video" ? "HEVC High" : "JPEG High"}
              </Text>
            </View>
          </View>

          <MediaPreview asset={asset} compact={compact} maxWidth={contentWidth} />

          <View
            style={{
              minHeight: compact ? 78 : 88,
              borderRadius: 12,
              backgroundColor: theme.surfaceSoft,
              borderWidth: 1,
              borderColor: theme.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-around"
            }}
          >
            <Metric label="Original" value={formatBytes(displayOriginal)} color={theme.text} />
            <Divider />
            <Metric label="Reduced" value={formatBytes(displayCompressed)} color={theme.green} />
            <Divider />
            <Metric label="Save" value={formatBytes(displaySaved)} color={theme.accent} />
          </View>

          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.text, fontSize: compact ? 18 : 20, letterSpacing: 0, fontWeight: "900" }}>
              Compression Quality
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {qualityOptions.map((option) => (
                <QualityCard key={option} quality={option} selected={quality === option} compact={compact} onPress={() => setQuality(option)} />
              ))}
            </View>
          </View>

          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surfaceSoft,
              padding: compact ? 12 : 14,
              flexDirection: "row",
              gap: 10
            }}
          >
            <Info size={21} color={theme.accent} />
            <Text selectable style={{ flex: 1, color: theme.text, fontSize: compact ? 14 : 15, lineHeight: compact ? 20 : 22 }}>
              {compressionProfiles[quality].description}
            </Text>
          </View>

          {result ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", paddingHorizontal: 10 }}>
              <CheckCircle2 size={18} color={theme.green} />
              <Text selectable numberOfLines={2} style={{ color: theme.green, fontSize: 14, fontWeight: "800", textAlign: "center", flexShrink: 1 }}>
                Compressed copy saved to the device library.
              </Text>
            </View>
          ) : null}
          {compressionError ? (
            <Text selectable style={{ color: theme.red, fontSize: 14, fontWeight: "800", textAlign: "center" }}>
              {compressionError}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <View style={{ position: "absolute", left: horizontalPadding, right: horizontalPadding, bottom: insets.bottom + 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compress now"
          disabled={isCompressing}
          onPress={handleCompress}
          style={{
            minHeight: compact ? 56 : 62,
            borderRadius: 14,
            backgroundColor: theme.accent,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 10,
            opacity: isCompressing ? 0.8 : 1,
            boxShadow: "0 13px 28px rgba(7, 94, 200, 0.24)"
          }}
        >
          {isCompressing ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: compact ? 18 : 20, fontWeight: "900" }}>Compress Now</Text>}
          {isCompressing ? (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>{Math.round(progress * 100)}%</Text>
          ) : (
            <Sparkles size={22} color="#fff" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function DetailHeader({ compact }: { compact: boolean }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + (compact ? 8 : 12), paddingHorizontal: 16, paddingBottom: compact ? 8 : 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
        <ArrowLeft size={26} color={theme.accent} />
      </Pressable>
      <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.accent, fontSize: compact ? 20 : 23, fontWeight: "900", flexShrink: 1, textAlign: "center" }}>
        Compression
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push("/settings")} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
        <Settings size={25} color={theme.text} />
      </Pressable>
    </View>
  );
}

function MediaPreview({ asset, compact, maxWidth }: { asset: PhotoAsset; compact: boolean; maxWidth: number }) {
  const theme = useAppTheme();
  const [uri, setUri] = useState(asset.uri);
  const isVideo = asset.mediaType === "video";
  const previewHeight = Math.min(compact ? 270 : 340, Math.max(220, maxWidth * 0.82));

  useEffect(() => {
    let mounted = true;
    setUri(asset.uri);
    if (isVideo) {
      CompressionService.createThumbnail(asset)
        .then((thumbnailUri) => {
          if (mounted) setUri(thumbnailUri);
        })
        .catch(() => undefined);
    }
    return () => {
      mounted = false;
    };
  }, [asset, isVideo]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open full screen ${isVideo ? "video" : "photo"}`}
      onPress={() => router.push({ pathname: "/compression-media-viewer", params: { id: asset.id } })}
      style={{ height: previewHeight, borderRadius: 16, overflow: "hidden", backgroundColor: theme.surfaceStrong }}
    >
      <CachedImage uri={uri} contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
      <LinearGradient colors={["rgba(255,255,255,0.18)", "rgba(10,12,18,0.12)", "rgba(5,7,13,0.38)"]} style={{ position: "absolute", inset: 0 }} />
      {isVideo ? (
        <View style={{ position: "absolute", top: "43%", alignSelf: "center", width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(255,255,255,0.42)", alignItems: "center", justifyContent: "center" }}>
          <Play size={24} color={theme.accent} fill="transparent" />
        </View>
      ) : null}
      <View style={{ position: "absolute", left: 12, bottom: 12, borderRadius: 10, backgroundColor: "rgba(42, 44, 50, 0.72)", paddingHorizontal: 10, paddingVertical: 8, maxWidth: "48%" }}>
        <Text selectable style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
          {isVideo ? "Duration" : "Resolution"}
        </Text>
        <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
          {isVideo ? formatDuration(asset.duration) : formatResolution(asset.width, asset.height)}
        </Text>
      </View>
      <View style={{ position: "absolute", right: 12, bottom: 12, borderRadius: 10, backgroundColor: "rgba(42, 44, 50, 0.72)", paddingHorizontal: 10, paddingVertical: 8, maxWidth: "42%" }}>
        <Text selectable style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
          {isVideo ? "Resolution" : "Type"}
        </Text>
        <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
          {isVideo ? shortResolution(asset.width, asset.height) : "Large"}
        </Text>
      </View>
    </Pressable>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 5, paddingHorizontal: 4 }}>
      <Text selectable numberOfLines={1} style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }}>
        {label}
      </Text>
      <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color, fontSize: 19, fontWeight: "900" }}>
        {value.replace(" ", "")}
      </Text>
    </View>
  );
}

function Divider() {
  const theme = useAppTheme();
  return <View style={{ width: 1, height: 40, backgroundColor: theme.border }} />;
}

function QualityCard({ quality, selected, compact, onPress }: { quality: CompressionQuality; selected: boolean; compact: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const profile = compressionProfiles[quality];
  const Icon = quality === "low" ? SlidersHorizontal : quality === "medium" ? BrushCleaning : Sparkles;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: compact ? 82 : 96,
        borderRadius: 12,
        borderWidth: 1.3,
        borderColor: selected ? theme.accent : theme.border,
        backgroundColor: selected ? theme.surface : theme.surfaceSoft,
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingHorizontal: 6,
        boxShadow: selected ? "0 10px 24px rgba(7, 94, 200, 0.15)" : "none"
      }}
    >
      <Icon size={compact ? 21 : 23} color={selected ? theme.accent : theme.text} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: selected ? theme.accent : theme.text, fontSize: compact ? 14 : 16, letterSpacing: 0, fontWeight: "900" }}>
        {profile.label}
      </Text>
      <Text numberOfLines={1} style={{ color: selected ? theme.accent : theme.muted, fontSize: compact ? 12 : 13, fontWeight: "800" }}>{profile.fidelity}</Text>
    </Pressable>
  );
}

function formatDuration(duration?: number) {
  const totalSeconds = Math.max(Math.round(duration ?? 0), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function shortResolution(width?: number, height?: number) {
  if (!width || !height) return "HD";
  const longEdge = Math.max(width, height);
  if (longEdge >= 3840) return "4K UHD";
  if (longEdge >= 2560) return "QHD";
  if (longEdge >= 1920) return "FHD";
  return "HD";
}
