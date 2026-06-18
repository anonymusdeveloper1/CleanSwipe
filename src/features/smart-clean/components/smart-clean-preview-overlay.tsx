import { VideoView, useVideoPlayer } from "expo-video";
import { Pause, Play, Volume2, VolumeX, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "@/components/cached-image";
import { useSmartCleanReviewStore } from "@/features/smart-clean/smart-clean-review-store";

/**
 * Full-screen image/video viewer for the Smart Clean review. Root-mounted (after
 * the Stack) so it covers the pushed `SmartCleanReviewScreen` without unmounting
 * it (review state preserved). Drag DOWN to dismiss (the media follows the
 * finger, shrinks/rounds, the backdrop fades to reveal the review); videos use a
 * custom player UI (play/pause + scrubber + time + mute), not native controls.
 */
export function SmartCleanPreviewOverlay() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const preview = useSmartCleanReviewStore((state) => state.preview);
  const closePreview = useSmartCleanReviewStore((state) => state.closePreview);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = 0;
  }, [preview, translateY]);

  // Registered only while previewing, AFTER the review sheet's back handler, so a
  // back press closes the viewer first (then a second press closes the sheet).
  useEffect(() => {
    if (!preview) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closePreview();
      return true;
    });
    return () => sub.remove();
  }, [preview, closePreview]);

  const animatedMediaStyle = useAnimatedStyle(() => {
    const scale = interpolate(translateY.value, [0, height * 0.55], [1, 0.86], Extrapolation.CLAMP);
    const radius = interpolate(translateY.value, [0, height * 0.35], [0, 22], Extrapolation.CLAMP);
    return { borderRadius: radius, overflow: "hidden", transform: [{ translateY: translateY.value }, { scale }] };
  });
  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, height * 0.6], [1, 0], Extrapolation.CLAMP)
  }));
  const animatedChromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, height * 0.25], [1, 0], Extrapolation.CLAMP)
  }));

  if (!preview) return null;

  // Only a clear downward drag dismisses (failOffsetX) so horizontal seeking on
  // the video scrubber never closes the viewer.
  const panGesture = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-18, 18])
    .onUpdate((event) => {
      translateY.value = Math.max(event.translationY, 0);
    })
    .onEnd((event) => {
      const shouldClose = translateY.value > Math.min(170, height * 0.22) || event.velocityY > 950;
      if (shouldClose) {
        translateY.value = withTiming(height, { duration: 200 }, () => runOnJS(closePreview)());
        return;
      }
      translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
    });
  // A photo also closes on tap; a video's taps are handled by its own controls.
  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(closePreview)();
  });
  const gesture = preview.isVideo ? panGesture : Gesture.Race(panGesture, tapGesture);

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000 }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000" }, animatedBackdropStyle]} />
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ flex: 1, justifyContent: "center" }, animatedMediaStyle]}>
          {preview.isVideo ? (
            <PreviewVideo key={preview.uri} uri={preview.uri} />
          ) : (
            <CachedImage uri={preview.uri} contentFit="contain" backgroundColor="#000" style={{ flex: 1 }} />
          )}
        </Animated.View>
      </GestureDetector>
      <Animated.View style={[{ position: "absolute", top: insets.top + 10, right: 16 }, animatedChromeStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={closePreview}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
        >
          <X size={24} color="#fff" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function PreviewVideo({ uri }: { uri: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = false;
    instance.play();
  });
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState(0);
  const scrubRatioRef = useRef(0);
  const trackWidthRef = useRef(0);

  // Poll the player for the scrubber (avoids version-specific event wiring).
  useEffect(() => {
    const id = setInterval(() => {
      setDuration(player.duration || 0);
      if (!scrubbing) setPosition(player.currentTime || 0);
    }, 250);
    return () => clearInterval(id);
  }, [player, scrubbing]);

  const togglePlay = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };
  const toggleMute = () => {
    const next = !muted;
    player.muted = next;
    setMuted(next);
  };

  const setRatioFromX = (x: number) => {
    const width = trackWidthRef.current || 1;
    const ratio = Math.max(0, Math.min(x / width, 1));
    scrubRatioRef.current = ratio;
    setScrubRatio(ratio);
  };
  const beginScrub = (x: number) => {
    setScrubbing(true);
    setRatioFromX(x);
  };
  const endScrub = () => {
    const target = scrubRatioRef.current * (player.duration || 0);
    player.currentTime = target;
    setPosition(target);
    setScrubbing(false);
  };

  // Horizontal-only so a vertical drag still bubbles to the dismiss gesture.
  const scrubGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onBegin((event) => {
      runOnJS(beginScrub)(event.x);
    })
    .onUpdate((event) => {
      runOnJS(setRatioFromX)(event.x);
    })
    .onEnd(() => {
      runOnJS(endScrub)();
    });

  const ratio = duration > 0 ? (scrubbing ? scrubRatio : position / duration) : 0;
  const fillPct = `${Math.max(0, Math.min(ratio, 1)) * 100}%` as const;
  const displayPos = scrubbing ? scrubRatio * duration : position;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="contain"
        surfaceType="textureView"
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        style={{ flex: 1 }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? t("compressionViewer.pauseVideo") : t("compressionViewer.playVideo")}
        onPress={togglePlay}
        style={{ position: "absolute", alignSelf: "center", top: "44%", width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}
      >
        {playing ? <Pause size={30} color="#fff" /> : <Play size={31} color="#fff" fill="#fff" />}
      </Pressable>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 24, paddingBottom: insets.bottom + 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? t("swipeCard.unmuteVideo") : t("swipeCard.muteVideo")} onPress={toggleMute} hitSlop={8}>
          {muted ? <VolumeX size={22} color="#fff" /> : <Volume2 size={22} color="#fff" />}
        </Pressable>
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", width: 40 }}>{formatTime(displayPos)}</Text>
        <GestureDetector gesture={scrubGesture}>
          <View onLayout={(event) => { trackWidthRef.current = event.nativeEvent.layout.width; }} style={{ flex: 1, height: 30, justifyContent: "center" }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.32)" }}>
              <View style={{ height: 4, borderRadius: 2, width: fillPct, backgroundColor: "#fff" }} />
            </View>
            <View style={{ position: "absolute", top: 8, left: fillPct, marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: "#fff" }} />
          </View>
        </GestureDetector>
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", width: 40, textAlign: "right" }}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

function formatTime(seconds: number) {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
