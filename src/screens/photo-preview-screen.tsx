import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Check, Maximize2, Pause, Play, RotateCcw, Share2, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, Share, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "@/components/cached-image";
import { useAppStore } from "@/store/app-store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PhotoAsset } from "@/models/photo";
import { CompressionService } from "@/services/compression-service";
import { formatDate } from "@/utils/date";
import { formatBytes, formatResolution } from "@/utils/format";

type PreviewMedia = {
  id: string;
  uri: string;
  filename?: string;
  mediaType?: "photo" | "video" | "unknown";
  sizeBytes?: number;
  creationTime?: number | string;
  width?: number;
  height?: number;
  duration?: number;
  source?: PhotoAsset;
};

export function PhotoPreviewScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const photos = useAppStore((state) => state.photos);
  const marked = useAppStore((state) => state.markedForDeletion);
  const history = useAppStore((state) => state.history);
  const keepPhoto = useAppStore((state) => state.keepPhoto);
  const mark = useAppStore((state) => state.markPhotoForDeletion);
  const restore = useAppStore((state) => state.restoreMarkedPhoto);
  const photo = photos.find((item) => item.id === id);
  const markedItem = marked.find((item) => item.photoId === id);
  const historyItem = history.find((item) => item.photoId === id);
  const media = useMemo<PreviewMedia | undefined>(() => {
    if (photo) return { ...photo, source: photo };
    if (markedItem) return { id: markedItem.photoId, uri: markedItem.uri, filename: markedItem.filename, mediaType: markedItem.mediaType, sizeBytes: markedItem.sizeBytes, creationTime: markedItem.createdAt };
    if (historyItem) return { id: historyItem.photoId, uri: historyItem.uri, filename: historyItem.filename, sizeBytes: historyItem.sizeBytes, creationTime: historyItem.deletedAt, mediaType: "photo" };
    return undefined;
  }, [historyItem, markedItem, photo]);
  const [controlsVisible, setControlsVisible] = useState(true);

  if (!media) return null;

  const isVideo = media.mediaType === "video";
  const title = media.filename ?? (isVideo ? "Video" : "Photo");

  const handleShare = () => {
    void Share.share({ message: media.uri, url: media.uri }).catch(() => undefined);
  };

  const handleKeep = () => {
    keepPhoto(media.id);
    router.back();
  };

  const handleDelete = () => {
    if (media.source) {
      mark(media.source);
      router.back();
    }
  };

  const handleRestore = () => {
    restore(media.id);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#05070d" }}>
      {isVideo ? (
        <VideoPreview media={media} controlsVisible={controlsVisible} setControlsVisible={setControlsVisible} />
      ) : (
        <ZoomablePhoto uri={media.uri} controlsVisible={controlsVisible} setControlsVisible={setControlsVisible} />
      )}

      {controlsVisible ? (
        <>
          <LinearGradient pointerEvents="none" colors={["rgba(5,7,13,0.78)", "rgba(5,7,13,0)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 110 }} />
          <View style={{ position: "absolute", top: insets.top + 10, left: 14, right: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <IconButton label="Go back" onPress={() => router.back()}>
              <ArrowLeft size={25} color="#fff" />
            </IconButton>
            <IconButton label="Share media" onPress={handleShare}>
              <Share2 size={23} color="#fff" />
            </IconButton>
          </View>

          <LinearGradient pointerEvents="none" colors={["rgba(5,7,13,0)", "rgba(5,7,13,0.84)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 210 + insets.bottom }} />
          <View style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 16, gap: 12 }}>
            <View style={{ gap: 4 }}>
              <Text selectable numberOfLines={1} style={{ color: "#fff", fontSize: 19, fontWeight: "900" }}>
                {title.replace(/\.[^.]+$/, "").replaceAll("_", " ")}
              </Text>
              <Text selectable numberOfLines={1} style={{ color: "rgba(255,255,255,0.72)", fontSize: 13, fontWeight: "700" }}>
                {formatDate(media.creationTime)} - {formatBytes(media.sizeBytes)} - {isVideo ? formatDuration(media.duration) : formatResolution(media.width, media.height)}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              {markedItem ? (
                <ActionButton label="Restore" tone="neutral" onPress={handleRestore}>
                  <RotateCcw size={20} color="#fff" />
                </ActionButton>
              ) : (
                <>
                  <ActionButton label="Keep" tone="green" onPress={handleKeep}>
                    <Check size={20} color="#fff" />
                  </ActionButton>
                  {media.source ? (
                    <ActionButton label="Delete" tone="red" onPress={handleDelete}>
                      <Trash2 size={20} color="#fff" />
                    </ActionButton>
                  ) : null}
                </>
              )}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

function ZoomablePhoto({ uri, controlsVisible, setControlsVisible }: { uri: string; controlsVisible: boolean; setControlsVisible: (visible: boolean) => void }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetZoom = () => {
    "worklet";
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    runOnJS(setControlsVisible)(true);
  };

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      runOnJS(setControlsVisible)(false);
    })
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 4));
    })
    .onEnd(() => {
      if (scale.value <= 1.03) {
        resetZoom();
      }
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1.02) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (scale.value > 1.03) {
      resetZoom();
      return;
    }
    runOnJS(setControlsVisible)(!controlsVisible);
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }]
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture, tapGesture)}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <CachedImage uri={uri} contentFit="contain" backgroundColor="#05070d" style={{ flex: 1 }} />
      </Animated.View>
    </GestureDetector>
  );
}

function VideoPreview({ media, controlsVisible, setControlsVisible }: { media: PreviewMedia; controlsVisible: boolean; setControlsVisible: (visible: boolean) => void }) {
  const theme = useAppTheme();
  const [thumbnailUri, setThumbnailUri] = useState(media.uri);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (media.source) {
      CompressionService.createThumbnail(media.source)
        .then((thumbnail) => {
          if (mounted) setThumbnailUri(thumbnail);
        })
        .catch(() => undefined);
    }
    return () => {
      mounted = false;
    };
  }, [media.source]);

  const openExternalPlayer = () => {
    void Linking.openURL(media.uri).catch(() => undefined);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? "Pause video preview" : "Play video preview"}
      onPress={() => {
        setPlaying((value) => !value);
        setControlsVisible(true);
      }}
      onLongPress={openExternalPlayer}
      delayLongPress={420}
      style={{ flex: 1 }}
    >
      <CachedImage uri={thumbnailUri} contentFit="contain" backgroundColor="#05070d" style={{ flex: 1 }} />
      <LinearGradient colors={["rgba(5,7,13,0.12)", "rgba(5,7,13,0.34)"]} style={{ position: "absolute", inset: 0 }} />
      {!playing ? (
        <View style={{ position: "absolute", alignSelf: "center", top: "44%", width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
          <Play size={31} color="#fff" fill="#fff" />
        </View>
      ) : controlsVisible ? (
        <View style={{ position: "absolute", alignSelf: "center", top: "44%", width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
          <Pause size={30} color="#fff" />
        </View>
      ) : null}
      {controlsVisible ? (
        <View style={{ position: "absolute", top: "55%", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.44)", paddingHorizontal: 12, paddingVertical: 8 }}>
          <Maximize2 size={15} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
            Hold for fullscreen
          </Text>
        </View>
      ) : null}
      <View style={{ position: "absolute", top: 0, left: 0, width: 4, bottom: 0, backgroundColor: playing ? theme.accent : "transparent" }} />
    </Pressable>
  );
}

function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
      {children}
    </Pressable>
  );
}

function ActionButton({ label, tone, onPress, children }: { label: string; tone: "green" | "red" | "neutral"; onPress: () => void; children: React.ReactNode }) {
  const backgroundColor = tone === "green" ? "#047857" : tone === "red" ? "#dc2626" : "rgba(255,255,255,0.18)";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ flex: 1, minHeight: 54, borderRadius: 12, backgroundColor, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
      {children}
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatDuration(duration?: number) {
  const totalSeconds = Math.max(Math.round(duration ?? 0), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
