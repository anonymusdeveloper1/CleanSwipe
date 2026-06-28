import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { AlertTriangle, ArrowRight, CheckCircle2, Share2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "@/components/cached-image";
import { VideoMediaPlayer } from "@/components/video-media-player";
import { ShimmerProgressBar, WorkingLabel } from "@/features/convert/components/convert-progress";
import { targetLabel, targetMimeForShare } from "@/features/convert/convert-targets";
import { ConvertTarget } from "@/features/convert/convert.types";
import { useConvertStore } from "@/features/convert/convert.store";
import { createConversionJobInput } from "@/features/convert/convert.utils";
import { useCustomConvertStore } from "@/features/convert/custom-convert.store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { selectIndexedMediaAsset, useMediaIndexStore } from "@/store/media-index-store";
import { formatBytes } from "@/utils/format";

/**
 * Foreground conversion flow — the converter's mirror of CompressRunScreen.
 *
 * Pushed from the Convert screen. Runs ONE conversion, shows live progress, then
 * the result. Unlike compression there is NO keep/delete-original decision and NO
 * App-Lock gate: conversion never touches the source. Image/video output lands in
 * the gallery; audio output (mp3/m4a) is kept in the app sandbox and Shared from
 * the result screen. The user cannot navigate away while converting.
 */
export function ConvertRunScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { id, target, origin, custom } = useLocalSearchParams<{ id: string; target?: string; origin?: string; custom?: string }>();

  const isCustom = custom === "1";
  const indexedAsset = useMediaIndexStore((state) => selectIndexedMediaAsset(state, id));
  const customTarget = useCustomConvertStore((state) => state.target);
  const asset = indexedAsset ?? (isCustom && customTarget?.id === id ? customTarget : undefined);
  const convertTarget = (target as ConvertTarget) ?? "jpg";

  const enqueueConversion = useConvertStore((state) => state.enqueueConversion);
  const cancelJob = useConvertStore((state) => state.cancelJob);
  const job = useConvertStore((state) => (id ? state.getJobByMediaId(id) : undefined));

  const startedRef = useRef(false);
  const [cancelVisible, setCancelVisible] = useState(false);

  const status = job?.status;
  const isRunning = !status || status === "queued" || status === "preparing" || status === "converting";
  const isDone = status === "completed";
  const isFailed = status === "failed";
  const hasTerminalResult = isDone || isFailed || status === "cancelled";
  const progressPercent = Math.round(Math.max(0, Math.min(1, job?.progress ?? 0)) * 100);

  const goHome = useCallback(() => {
    router.dismissTo((origin && origin.length > 0 ? origin : "/(tabs)/premium") as never);
  }, [origin]);

  // Start the single conversion exactly once.
  useEffect(() => {
    if (startedRef.current) return;
    if (!asset) {
      goHome();
      return;
    }
    startedRef.current = true;
    const input = createConversionJobInput(asset, convertTarget);
    if (!input) {
      goHome();
      return;
    }
    void enqueueConversion(input);
  }, [asset, convertTarget, enqueueConversion, goHome]);

  // Block hardware back while converting (no roaming); the cancel modal eats back.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (cancelVisible) {
        setCancelVisible(false);
        return true;
      }
      return isRunning;
    });
    return () => sub.remove();
  }, [cancelVisible, isRunning]);

  // A conversion can finish while its cancel confirmation is open — drop the
  // stale prompt so a completed result can't be "cancelled" afterward.
  useEffect(() => {
    if (hasTerminalResult && cancelVisible) setCancelVisible(false);
  }, [cancelVisible, hasTerminalResult]);

  const confirmCancel = () => {
    setCancelVisible(false);
    if (job) void cancelJob(job.id);
    goHome();
  };

  const handleShare = async () => {
    if (!job?.outputUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(job.outputUri, { mimeType: targetMimeForShare(convertTarget), dialogTitle: t("convert.shareTitle") });
      }
    } catch {
      // User dismissed the share sheet or it failed — nothing to recover.
    }
  };

  const retry = () => {
    startedRef.current = false;
    if (!asset) return;
    const input = createConversionJobInput(asset, convertTarget);
    if (input) {
      startedRef.current = true;
      void enqueueConversion(input);
    }
  };

  const isVideoSource = (asset?.mediaType ?? job?.inputKind) === "video";
  const isAudioOutput = job?.outputKind === "audio";
  const originalLabel = fileExtLabel(job?.fileName ?? asset?.filename, isVideoSource ? "VIDEO" : "PHOTO");
  const targetUpper = targetLabel(convertTarget);
  const errorCode = job?.errorMessage ?? "generic";

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flex: 1 }}>
        {isFailed ? (
          <View style={{ flex: 1, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", gap: 16 }}>
            <AlertTriangle size={44} color={theme.accent} />
            <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900", textAlign: "center" }}>{t("convert.finishedTitle")}</Text>
            <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 21, textAlign: "center" }}>{t(`convert.errors.${errorCode}`)}</Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
              <Pressable onPress={goHome} style={{ minHeight: 50, paddingHorizontal: 22, borderRadius: 14, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}>{t("convert.close")}</Text>
              </Pressable>
              <Pressable onPress={retry} style={{ minHeight: 50, paddingHorizontal: 22, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("convert.retry")}</Text>
              </Pressable>
            </View>
          </View>
        ) : isDone ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 }}
          >
            <View style={{ gap: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "center" }}>
                <CheckCircle2 size={22} color={theme.green} />
                <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "900" }}>{t("convert.completeTitle")}</Text>
              </View>
              <View style={{ borderRadius: 14, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 9 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>{t("convert.formatLabel")}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text selectable style={{ color: theme.muted, fontSize: 14, fontWeight: "900" }}>{originalLabel}</Text>
                    <ArrowRight size={15} color={theme.muted} />
                    <Text selectable style={{ color: theme.accent, fontSize: 14, fontWeight: "900" }}>{targetUpper}</Text>
                  </View>
                </View>
                <SummaryRow label={t("convert.originalSizeLabel")} value={formatBytes(job?.originalSizeBytes ?? 0)} />
                <SummaryRow label={t("convert.outputSizeLabel")} value={formatBytes(job?.outputSizeBytes ?? 0)} valueColor={theme.green} />
              </View>
              <Text selectable style={{ color: theme.muted, fontSize: 13, lineHeight: 19, textAlign: "center" }}>
                {isAudioOutput ? t("convert.savedToFiles") : t("convert.savedToGallery")}
              </Text>
              <View style={{ gap: 11 }}>
                {isAudioOutput ? (
                  <Pressable
                    onPress={handleShare}
                    style={{ minHeight: 52, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
                  >
                    <Share2 size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("convert.share")}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={goHome}
                  style={{ minHeight: 52, borderRadius: 14, backgroundColor: isAudioOutput ? `${theme.accent}14` : theme.accent, borderWidth: isAudioOutput ? 1 : 0, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: isAudioOutput ? theme.text : "#fff", fontSize: 16, fontWeight: "900" }}>{t("common.done")}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, gap: 16, paddingHorizontal: 20, paddingVertical: 6 }}>
            <View style={{ flex: 1, borderRadius: 18, overflow: "hidden", backgroundColor: theme.surfaceStrong, borderWidth: 1, borderColor: theme.border }}>
              {asset?.uri && isVideoSource ? (
                <VideoMediaPlayer uri={asset.uri} contentFit="cover" style={{ flex: 1 }} />
              ) : asset?.uri ? (
                <CachedImage uri={asset.uri} contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color={theme.accent} />
                </View>
              )}
            </View>
            <View style={{ alignItems: "center", gap: 12 }}>
              <Text selectable style={{ color: theme.accent, fontSize: 40, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{progressPercent}%</Text>
              <ShimmerProgressBar percent={progressPercent} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text selectable style={{ color: theme.muted, fontSize: 15, fontWeight: "900" }}>{originalLabel}</Text>
                <ArrowRight size={16} color={theme.muted} />
                <Text selectable style={{ color: theme.accent, fontSize: 15, fontWeight: "900" }}>{targetUpper}</Text>
              </View>
              <WorkingLabel text={t("convert.working")} />
            </View>
            <Pressable accessibilityRole="button" onPress={() => setCancelVisible(true)} style={{ minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "800" }}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {cancelVisible && !hasTerminalResult ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setCancelVisible(false)} statusBarTranslucent>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("convert.keepConverting")}
            onPress={() => setCancelVisible(false)}
            style={{ flex: 1, backgroundColor: "rgba(5,7,13,0.62)", justifyContent: "center", padding: 24 }}
          >
            <Pressable accessibilityRole="none" onPress={() => undefined} style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 22, gap: 18, borderWidth: 1, borderColor: theme.border }}>
              <View style={{ alignSelf: "center", width: 62, height: 62, borderRadius: 31, backgroundColor: `${theme.red}18`, borderWidth: 1, borderColor: `${theme.red}55`, alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={29} color={theme.red} />
              </View>
              <View style={{ gap: 8 }}>
                <Text selectable style={{ color: theme.text, fontSize: 22, lineHeight: 28, fontWeight: "900", textAlign: "center" }}>{t("convert.cancelTitle")}</Text>
                <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 21, textAlign: "center" }}>{t("convert.cancelMessage")}</Text>
              </View>
              <View style={{ gap: 10 }}>
                <Pressable accessibilityRole="button" onPress={() => setCancelVisible(false)} style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1 })}>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("convert.keepConverting")}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={confirmCancel} style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, backgroundColor: `${theme.red}14`, borderWidth: 1, borderColor: theme.red, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.76 : 1 })}>
                  <Text style={{ color: theme.red, fontSize: 16, fontWeight: "900" }}>{t("convert.cancelConfirm")}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

// Source file extension as a short label (e.g. "HEIC", "MOV"); falls back to a
// kind label when the filename has no usable extension.
function fileExtLabel(name?: string, fallback = ""): string {
  const ext = name?.split(".").pop();
  if (ext && ext.length >= 2 && ext.length <= 5 && /^[a-z0-9]+$/i.test(ext)) return ext.toUpperCase();
  return fallback;
}

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <Text selectable style={{ color: valueColor ?? theme.text, fontSize: 14, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}
