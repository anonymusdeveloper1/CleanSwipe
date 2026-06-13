import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { Volume2, VolumeX } from "lucide-react-native";
import { Animated, PanResponder, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CachedImage } from "@/components/cached-image";
import { MediaThumbnail } from "@/components/media-thumbnail";
import { VideoMediaPlayer } from "@/components/video-media-player";
import { isVideoUri } from "@/components/video-thumb-placeholder";
import { PhotoAsset, SwipeAction } from "@/models/photo";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  photo: PhotoAsset;
  stackPhotos: PhotoAsset[];
  onSwipe: (action: SwipeAction) => void;
  onOpen?: () => void;
};

export function SwipePhotoCard({ photo, stackPhotos, onSwipe, onOpen }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const position = useRef(new Animated.ValueXY()).current;
  const animating = useRef(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const threshold = Math.min(130, width * 0.28);
  const backgroundPhotos = stackPhotos.filter((item) => item.id !== photo.id).slice(0, 3);
  const isVideo = photo.mediaType === "video";

  // Only keep the card's video decoder alive while the Swipe screen is focused.
  // Opening the full-screen preview (a modal) leaves this screen mounted, so
  // without this the card video AND the preview video would both hold a hardware
  // decoder at once — on some devices (e.g. Galaxy S24 with HEVC/4K) that exceeds
  // the concurrent-decoder limit and hard-crashes the app. Unmounting the player
  // on blur releases the codec; it remounts and resumes when the screen refocuses.
  const [screenFocused, setScreenFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, [])
  );

  useLayoutEffect(() => {
    animating.current = false;
    position.setValue({ x: 0, y: 0 });
  }, [photo.id, position]);

  useEffect(() => {
    // Exclude videos — prefetching a video URI makes expo-image decode a frame,
    // which can OOM-crash on high-res clips (see video-thumb-placeholder).
    const uris = stackPhotos.map((item) => item.uri).filter((uri) => uri && !isVideoUri(uri));
    if (uris.length > 0) {
      void Image.prefetch(uris, { cachePolicy: "memory-disk" }).catch(() => undefined);
    }
  }, [stackPhotos]);

  const animatedCardStyle = useMemo(() => {
    const rotate = position.x.interpolate({
      inputRange: [-width * 0.55, 0, width * 0.55],
      outputRange: ["-9deg", "0deg", "9deg"],
      extrapolate: "clamp"
    });
    const scale = position.x.interpolate({
      inputRange: [-width, 0, width],
      outputRange: [0.96, 1, 0.96],
      extrapolate: "clamp"
    });

    return {
      transform: [
        { translateX: position.x },
        { translateY: position.y },
        { rotate },
        { scale }
      ]
    };
  }, [position, width]);

  const keepOpacity = position.x.interpolate({
    inputRange: [0, 38, threshold],
    outputRange: [0, 0.45, 1],
    extrapolate: "clamp"
  });

  const deleteOpacity = position.x.interpolate({
    inputRange: [-threshold, -38, 0],
    outputRange: [1, 0.45, 0],
    extrapolate: "clamp"
  });
  const nextCardScale = position.x.interpolate({
    inputRange: [-width * 0.45, 0, width * 0.45],
    outputRange: [1, 0.975, 1],
    extrapolate: "clamp"
  });
  const nextCardTranslateY = position.x.interpolate({
    inputRange: [-width * 0.45, 0, width * 0.45],
    outputRange: [0, 9, 0],
    extrapolate: "clamp"
  });
  const nextCardOpacity = position.x.interpolate({
    inputRange: [-width * 0.45, 0, width * 0.45],
    outputRange: [1, 0.92, 1],
    extrapolate: "clamp"
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => !animating.current && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          position.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          if (animating.current) return;
          position.setValue({ x: gesture.dx, y: gesture.dy * 0.12 });
        },
        onPanResponderRelease: (_, gesture) => {
          if (animating.current) return;
          const action =
            gesture.dx < -threshold || gesture.vx < -0.75
              ? "delete"
              : gesture.dx > threshold || gesture.vx > 0.75
                ? "keep"
                : undefined;

          if (action) {
            const direction = action === "delete" ? -1 : 1;
            animating.current = true;
            void Haptics.selectionAsync().catch(() => undefined);
            Animated.timing(position, {
              toValue: {
                x: direction * (width + 180),
                y: gesture.dy * 0.22
              },
              duration: 300,
              useNativeDriver: true
            }).start(() => {
              onSwipe(action);
              requestAnimationFrame(() => {
                animating.current = false;
                position.setValue({ x: 0, y: 0 });
              });
            });
            return;
          }

          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 85,
            useNativeDriver: true
          }).start();
        },
        onPanResponderTerminate: () => {
          if (animating.current) return;
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 7,
            tension: 70,
            useNativeDriver: true
          }).start();
        }
      }),
    [onSwipe, position, threshold, width]
  );

  return (
    <View
      style={{
        width: "100%",
        maxWidth: 640,
        flex: 1,
        minHeight: 260,
        alignSelf: "center"
      }}
    >
      {[...backgroundPhotos].reverse().map((item, reversedIndex) => {
        const stackIndex = backgroundPhotos.length - reversedIndex;
        const isNextCard = stackIndex === 1;
        const staticScale = 1 - stackIndex * 0.025;
        const staticTranslateY = stackIndex * 9;
        const staticOpacity = 1 - stackIndex * 0.08;
        const Container = isNextCard ? Animated.View : View;
        return (
          <Container
            key={item.id}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 7,
              right: 7,
              top: stackIndex * 6,
              bottom: 7,
              borderRadius: 33,
              backgroundColor: theme.background,
              transform: [
                { scale: isNextCard ? nextCardScale : staticScale },
                { translateY: isNextCard ? nextCardTranslateY : staticTranslateY }
              ],
              opacity: isNextCard ? nextCardOpacity : staticOpacity,
              overflow: "hidden"
            }}
          >
            <MediaThumbnail uri={item.uri} id={item.id} mediaType={item.mediaType} contentFit="cover" backgroundColor={theme.background} style={{ flex: 1 }} />
            <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(15,23,42,0.07)" }} />
          </Container>
        );
      })}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          {
            flex: 1,
            marginTop: 20,
            borderRadius: 34,
            overflow: "hidden",
            backgroundColor: theme.background,
            boxShadow: "0 18px 34px rgba(15, 23, 42, 0.16)"
          },
          animatedCardStyle
        ]}
      >
        {isVideo ? (
          screenFocused ? (
            <VideoMediaPlayer
              uri={photo.uri}
              autoPlay
              loop
              muted={videoMuted}
              contentFit="cover"
              backgroundColor={theme.background}
              style={{ flex: 1 }}
            />
          ) : (
            // Blurred (preview modal open / other tab) — decoder released; the card
            // is covered or off-screen so a plain fill is invisible to the user.
            <View style={{ flex: 1, backgroundColor: theme.background }} />
          )
        ) : (
          <CachedImage uri={photo.uri} contentFit="cover" backgroundColor={theme.background} style={{ flex: 1 }} />
        )}
        <Pressable accessibilityRole="button" accessibilityLabel={t("swipeCard.openMediaPreview")} onPress={onOpen} style={{ position: "absolute", inset: 0 }} />
        {isVideo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={videoMuted ? t("swipeCard.unmuteVideo") : t("swipeCard.muteVideo")}
            onPress={() => setVideoMuted((value) => !value)}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "rgba(0,0,0,0.44)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {videoMuted ? <VolumeX size={21} color="#fff" /> : <Volume2 size={21} color="#fff" />}
          </Pressable>
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(220,38,38,0.34)",
            opacity: deleteOpacity
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(4,120,87,0.34)",
            opacity: keepOpacity
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            marginLeft: -72,
            marginTop: -32,
            minWidth: 144,
            alignItems: "center",
            paddingVertical: 9,
            paddingHorizontal: 18,
            borderRadius: 14,
            borderWidth: 3,
            borderColor: "#ffffff",
            opacity: deleteOpacity,
            transform: [{ rotate: "-10deg" }]
          }}
        >
          <Text selectable style={{ color: "#ffffff", fontSize: 28, fontWeight: "900", letterSpacing: 0 }}>
            {t("swipeCard.deleteLabel")}
          </Text>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            marginLeft: -72,
            marginTop: -32,
            minWidth: 144,
            alignItems: "center",
            paddingVertical: 9,
            paddingHorizontal: 18,
            borderRadius: 14,
            borderWidth: 3,
            borderColor: "#ffffff",
            opacity: keepOpacity,
            transform: [{ rotate: "10deg" }]
          }}
        >
          <Text selectable style={{ color: "#ffffff", fontSize: 28, fontWeight: "900", letterSpacing: 0 }}>
            {t("swipeCard.keepLabel")}
          </Text>
        </Animated.View>
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: "rgba(0,0,0,0.32)"
          }}
        >
          <Text selectable numberOfLines={1} style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
            {(photo.filename ?? t("swipeCard.untitledPhoto")).replace(/\.[^.]+$/, "").replaceAll("_", " ")}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
