import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { CachedImage } from "@/components/cached-image";

type Props = {
  uri: string;
  posterUri?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  paused?: boolean;
  contentFit?: "contain" | "cover" | "fill";
  nativeControls?: boolean;
  allowsFullscreen?: boolean;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
};

export function VideoMediaPlayer({
  uri,
  posterUri,
  autoPlay = false,
  loop = false,
  muted = false,
  paused = false,
  contentFit = "contain",
  nativeControls = false,
  allowsFullscreen = false,
  style,
  backgroundColor = "#05070d"
}: Props) {
  const [firstFrameRendered, setFirstFrameRendered] = useState(false);
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = loop;
    instance.muted = muted;
    if (autoPlay && !paused) {
      instance.play();
    }
  });

  useEffect(() => {
    player.loop = loop;
  }, [loop, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (autoPlay && !paused) {
      player.play();
      return;
    }
    player.pause();
  }, [autoPlay, paused, player]);

  useEffect(() => {
    setFirstFrameRendered(false);
  }, [uri]);

  return (
    <View style={[{ overflow: "hidden", backgroundColor }, style]}>
      <VideoView
        player={player}
        nativeControls={nativeControls}
        contentFit={contentFit}
        fullscreenOptions={{ enable: allowsFullscreen }}
        allowsPictureInPicture={false}
        surfaceType="textureView"
        onFirstFrameRender={() => setFirstFrameRendered(true)}
        style={{ flex: 1 }}
      />
      {posterUri && !firstFrameRendered ? (
        <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
          <CachedImage uri={posterUri} contentFit={contentFit === "cover" ? "cover" : "contain"} backgroundColor={backgroundColor} style={{ flex: 1 }} />
        </View>
      ) : null}
    </View>
  );
}
