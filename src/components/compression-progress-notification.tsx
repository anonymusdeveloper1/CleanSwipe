import { CheckCircle2, Loader2, XCircle } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";

type BannerState = {
  kind: "active" | "complete" | "error";
  title: string;
  message: string;
  progress?: number;
};

export function CompressionProgressNotification() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const photos = useAppStore((state) => state.photos);
  const compressedMedia = useAppStore((state) => state.compressedMedia);
  const compressingIds = useAppStore((state) => state.compressingIds);
  const compressionProgress = useAppStore((state) => state.compressionProgress);
  const compressionError = useAppStore((state) => state.compressionError);
  const [recentState, setRecentState] = useState<BannerState | undefined>();
  const previousCompressedCount = useRef(compressedMedia.length);

  const activeState = useMemo<BannerState | undefined>(() => {
    if (compressingIds.length === 0) return undefined;

    const activePhotos = compressingIds.map((id) => photos.find((photo) => photo.id === id)).filter(Boolean);
    const totalProgress = compressingIds.reduce((sum, id) => sum + (compressionProgress[id] ?? 0), 0);
    const progress = totalProgress / compressingIds.length;
    const firstName = activePhotos[0]?.filename?.replace(/\.[^.]+$/, "").replaceAll("_", " ") ?? "media";
    return {
      kind: "active",
      title: compressingIds.length === 1 ? "Compressing media" : `Compressing ${compressingIds.length} items`,
      message: compressingIds.length === 1 ? `${firstName} - ${Math.round(progress * 100)}%` : `${Math.round(progress * 100)}% complete`,
      progress
    };
  }, [compressingIds, compressionProgress, photos]);

  useEffect(() => {
    if (compressionError) {
      setRecentState({
        kind: "error",
        title: "Compression failed",
        message: compressionError
      });
      const timeout = setTimeout(() => setRecentState(undefined), 4200);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [compressionError]);

  useEffect(() => {
    if (compressedMedia.length > previousCompressedCount.current) {
      const latest = compressedMedia[0];
      setRecentState({
        kind: "complete",
        title: "Compression complete",
        message: latest?.filename ? latest.filename : "Saved compressed copy to your library."
      });
      const timeout = setTimeout(() => setRecentState(undefined), 3600);
      previousCompressedCount.current = compressedMedia.length;
      return () => clearTimeout(timeout);
    }
    previousCompressedCount.current = compressedMedia.length;
    return undefined;
  }, [compressedMedia]);

  const state = activeState ?? recentState;
  if (!state) return null;

  const Icon = state.kind === "active" ? Loader2 : state.kind === "complete" ? CheckCircle2 : XCircle;
  const iconColor = state.kind === "error" ? theme.red : state.kind === "complete" ? theme.green : theme.accent;

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 8, left: 14, right: 14, zIndex: 50 }}>
      <View
        style={{
          minHeight: 58,
          borderRadius: 12,
          paddingHorizontal: 13,
          paddingVertical: 10,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
          gap: 8
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon size={21} color={iconColor} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text selectable={false} numberOfLines={1} style={{ color: theme.text, fontSize: 14, fontWeight: "900" }}>
              {state.title}
            </Text>
            <Text selectable={false} numberOfLines={1} style={{ color: theme.muted, fontSize: 12, fontWeight: "700", marginTop: 1 }}>
              {state.message}
            </Text>
          </View>
        </View>
        {typeof state.progress === "number" ? (
          <View style={{ height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: theme.surfaceStrong }}>
            <View style={{ width: `${Math.max(4, Math.round(state.progress * 100))}%`, height: 4, backgroundColor: theme.accent }} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
