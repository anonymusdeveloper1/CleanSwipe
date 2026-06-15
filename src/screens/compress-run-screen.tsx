import { router, useLocalSearchParams } from "expo-router";
import { AlertTriangle, ArrowRight, CheckCircle2, Lock, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, BackHandler, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { CachedImage } from "@/components/cached-image";
import { PasscodePad } from "@/components/passcode-pad";
import { VideoMediaPlayer } from "@/components/video-media-player";
import { useCompressionStore } from "@/features/compression/compression.store";
import { useCustomCompressStore } from "@/features/compression/custom-compress.store";
import { createCompressionJobInput } from "@/features/compression/compression.utils";
import { useAppTheme } from "@/hooks/use-app-theme";
import { CompressionQuality } from "@/models/photo";
import { AppLockService, BiometricKind, PASSCODE_LENGTH } from "@/services/app-lock-service";
import { useAppStore } from "@/store/app-store";
import { selectIndexedMediaAsset, useMediaIndexStore } from "@/store/media-index-store";
import { formatBytes } from "@/utils/format";

/**
 * Foreground compression flow (replaces the background queue + result sheets).
 *
 * Pushed from the compression detail screen's "Compress now". Runs ONE item in
 * the foreground (no background service), shows live progress, then the result,
 * then asks Keep / Delete the original. Deleting requires the App Lock passcode
 * (or biometric); if no passcode is set we go straight to the OS delete prompt.
 * The user cannot navigate away while compressing.
 */
export function CompressRunScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { id, quality, origin, custom } = useLocalSearchParams<{ id: string; quality?: string; origin?: string; custom?: string }>();

  // A custom (user-picked) file isn't in the media index — fall back to the
  // transient custom-compress store. Custom files are Keep-only (their "original"
  // is a picker cache copy, not a managed library asset), so we hide the delete.
  const isCustom = custom === "1";
  const indexedAsset = useMediaIndexStore((state) => selectIndexedMediaAsset(state, id));
  const customTarget = useCustomCompressStore((state) => state.target);
  const asset = indexedAsset ?? (isCustom && customTarget?.id === id ? customTarget : undefined);
  const enqueueCompression = useCompressionStore((state) => state.enqueueCompression);
  const keepOriginal = useCompressionStore((state) => state.keepOriginal);
  const deleteOriginal = useCompressionStore((state) => state.deleteOriginal);
  const cancelJob = useCompressionStore((state) => state.cancelJob);
  const job = useCompressionStore((state) => (id ? state.getJobByMediaId(id) : undefined));
  const compressed = useAppStore((state) => state.compressedMedia.find((item) => item.sourceId === id));
  const appLockEnabled = useAppStore((state) => state.settings.appLockEnabled);

  const startedRef = useRef(false);
  const [deciding, setDeciding] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [biometric, setBiometric] = useState<{ available: boolean; kind: BiometricKind }>({ available: false, kind: "generic" });
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [showOriginal, setShowOriginal] = useState(false);

  const status = job?.status;
  const isRunning = !status || status === "queued" || status === "preparing" || status === "compressing";
  const isDone = status === "completed";
  const isFailed = status === "failed";
  const progressPercent = Math.round(Math.max(0, Math.min(1, job?.progress ?? 0)) * 100);

  const goHome = useCallback(() => {
    router.dismissTo((origin && origin.length > 0 ? origin : "/(tabs)/history") as never);
  }, [origin]);

  // Start the single compression exactly once.
  useEffect(() => {
    if (startedRef.current) return;
    if (!asset) {
      // Asset missing (e.g. already gone) — bail to the origin.
      goHome();
      return;
    }
    startedRef.current = true;
    const input = createCompressionJobInput(asset, (quality as CompressionQuality) ?? "medium");
    if (!input) {
      goHome();
      return;
    }
    void enqueueCompression(input);
  }, [asset, quality, enqueueCompression, goHome]);

  useEffect(() => {
    void AppLockService.getBiometricCapability().then((cap) => setBiometric({ available: cap.available, kind: cap.kind }));
  }, []);

  // Block hardware back while compressing or applying a decision (no roaming).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => isRunning || deciding || pinVisible);
    return () => sub.remove();
  }, [isRunning, deciding, pinVisible]);

  const handleKeep = async () => {
    if (!job || deciding) return;
    setDeciding(true);
    await keepOriginal(job.id);
    goHome();
  };

  // Cancel an in-progress compression — confirm first to avoid accidental taps,
  // then mark the job cancelled (its result is discarded, the original untouched).
  const handleCancel = () => {
    Alert.alert(t("compressRun.cancelTitle"), t("compressRun.cancelMessage"), [
      { text: t("compressRun.keepCompressing"), style: "cancel" },
      {
        text: t("compressRun.cancelConfirm"),
        style: "destructive",
        onPress: () => {
          if (job) void cancelJob(job.id);
          goHome();
        }
      }
    ]);
  };

  const proceedDelete = async () => {
    if (!job) return;
    setPinVisible(false);
    setPin("");
    setDeciding(true);
    setDeleteError(undefined);
    await deleteOriginal(job.id);
    const updated = useCompressionStore.getState().jobs[job.id];
    if (updated?.originalAction === "auto_deleted") {
      goHome();
      return;
    }
    // Denied / failed — stay so the user sees what happened.
    setDeciding(false);
    setDeleteError(updated?.originalDeleteError ?? t("compressRun.deleteFailed"));
  };

  const handleDeletePress = async () => {
    if (!job || deciding) return;
    // Only require the passcode when App Lock is actually SET UP (enabled + a
    // passcode stored). A passcode can linger in the Keychain (which survives app
    // reinstalls) while App Lock is off, so gating on `hasPasscode()` alone would
    // prompt for a PIN the user never configured. Gate on the setting too.
    if (appLockEnabled && (await AppLockService.hasPasscode())) {
      setPin("");
      setPinError(false);
      setPinVisible(true);
      return;
    }
    await proceedDelete();
  };

  const handlePinChange = (value: string) => {
    setPin(value);
    setPinError(false);
    if (value.length === PASSCODE_LENGTH) {
      void AppLockService.verifyPasscode(value).then((ok) => {
        if (ok) void proceedDelete();
        else {
          setPinError(true);
          setPin("");
        }
      });
    }
  };

  const handleBiometric = async () => {
    const result = await AppLockService.authenticateBiometric(t("compressRun.deletePinHint"), t("common.cancel"));
    if (result.success) void proceedDelete();
  };

  const isVideo = (asset?.mediaType ?? job?.mediaType) === "video";
  const resultUri = compressed?.outputUri;

  // Live "real → compressed" size: the displayed compressed figure ticks down from
  // the real size toward the estimate as progress advances — so the user sees the
  // file shrinking in real time.
  const realBytes = job?.originalSizeBytes ?? asset?.sizeBytes ?? 0;
  const targetBytes = Math.min(job?.estimatedReducedSizeBytes ?? realBytes, realBytes);
  const liveCompressedBytes = Math.round(realBytes - (realBytes - targetBytes) * Math.max(0, Math.min(1, job?.progress ?? 0)));

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: "center", gap: 22 }}>
        {isFailed ? (
          <View style={{ alignItems: "center", gap: 16 }}>
            <AlertTriangle size={44} color={theme.accent} />
            <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900", textAlign: "center" }}>
              {t("compression.finishedTitle")}
            </Text>
            <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 21, textAlign: "center" }}>
              {job?.errorMessage ?? t("compressRun.failedFallback")}
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
              <Pressable onPress={goHome} style={{ minHeight: 50, paddingHorizontal: 22, borderRadius: 14, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}>{t("compressRun.close")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  startedRef.current = false;
                  setDeleteError(undefined);
                  if (asset) {
                    const input = createCompressionJobInput(asset, (quality as CompressionQuality) ?? "medium");
                    if (input) {
                      startedRef.current = true;
                      void enqueueCompression(input);
                    }
                  }
                }}
                style={{ minHeight: 50, paddingHorizontal: 22, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("compressRun.retry")}</Text>
              </Pressable>
            </View>
          </View>
        ) : isDone ? (
          <View style={{ gap: 18 }}>
            <View style={{ height: 280, borderRadius: 18, overflow: "hidden", backgroundColor: theme.surfaceStrong, borderWidth: 1, borderColor: theme.border }}>
              <BeforeAfterMedia originalUri={asset?.uri} compressedUri={resultUri} isVideo={isVideo} showOriginal={showOriginal} />
            </View>
            {/* Before/after: switch between the compressed result and the original. */}
            <BeforeAfterToggle showOriginal={showOriginal} onChange={setShowOriginal} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "center" }}>
              <CheckCircle2 size={22} color={theme.green} />
              <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "900" }}>
                {t("compression.completeTitle")}
              </Text>
            </View>
            <View style={{ borderRadius: 14, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 9 }}>
              <SummaryRow label={t("compression.originalSizeLabel")} value={formatBytes(job?.originalSizeBytes ?? compressed?.originalBytes ?? 0)} />
              <SummaryRow label={t("compression.compressedSizeLabel")} value={formatBytes(job?.finalSizeBytes ?? compressed?.compressedBytes ?? 0)} />
              <SummaryRow label={t("compression.youSavedLabel")} value={formatBytes(job?.savedBytes ?? compressed?.savedBytes ?? 0)} valueColor={theme.green} />
            </View>
            {!isCustom ? (
              <Text selectable style={{ color: theme.text, fontSize: 15, lineHeight: 21, fontWeight: "700", textAlign: "center" }}>
                {t("compression.singleDecisionPrompt")}
              </Text>
            ) : null}
            {deleteError ? (
              <Text selectable style={{ color: theme.red, fontSize: 13, fontWeight: "800", textAlign: "center" }}>
                {deleteError}
              </Text>
            ) : null}
            <View style={{ gap: 11 }}>
              {/* Custom files: Keep-only (the source is a picker cache copy). */}
              {!isCustom ? (
                <Pressable
                  disabled={deciding}
                  onPress={handleDeletePress}
                  style={{ minHeight: 52, borderRadius: 14, backgroundColor: `${theme.red}18`, borderWidth: 1, borderColor: theme.red, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: deciding ? 0.6 : 1 }}
                >
                  <Trash2 size={18} color={theme.red} />
                  <Text style={{ color: theme.red, fontSize: 16, fontWeight: "900" }}>{t("compression.deleteSingleOriginalButton")}</Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={deciding}
                onPress={handleKeep}
                style={{ minHeight: 52, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", opacity: deciding ? 0.6 : 1 }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{isCustom ? t("common.done") : t("compression.keepOriginalButton")}</Text>
              </Pressable>
            </View>
            <Text selectable style={{ color: theme.muted, fontSize: 12, lineHeight: 16, textAlign: "center" }}>
              {t("compression.deleteWarning")}
            </Text>
            {deciding ? <ActivityIndicator color={theme.accent} /> : null}
          </View>
        ) : (
          <View style={{ flex: 1, gap: 16, paddingVertical: 6 }}>
            {/* Preview of the media being compressed (the original). Fills the
                frame (cover); both images and videos render. */}
            <View style={{ flex: 1, borderRadius: 18, overflow: "hidden", backgroundColor: theme.surfaceStrong, borderWidth: 1, borderColor: theme.border }}>
              {asset?.uri && isVideo ? (
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
              {/* Real size → live compressed size (ticks down as it compresses) */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text selectable style={{ color: theme.muted, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{formatBytes(realBytes)}</Text>
                <ArrowRight size={17} color={theme.muted} />
                <Text selectable style={{ color: theme.green, fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{formatBytes(liveCompressedBytes)}</Text>
              </View>
              <WorkingLabel text={t("compressRun.title")} />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={handleCancel}
              style={{ minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "800" }}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Modal transparent animationType="fade" visible={pinVisible} onRequestClose={() => setPinVisible(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "rgba(5,7,13,0.6)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 22, gap: 16 }}>
            <View style={{ alignSelf: "center", width: 56, height: 56, borderRadius: 28, backgroundColor: theme.surfaceStrong, alignItems: "center", justifyContent: "center" }}>
              <Lock size={24} color={theme.accent} />
            </View>
            <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "900", textAlign: "center" }}>{t("compressRun.deletePinTitle")}</Text>
            <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 20, textAlign: "center" }}>{t("compressRun.deletePinHint")}</Text>
            <PasscodePad
              value={pin}
              onChange={handlePinChange}
              error={pinError}
              onBiometric={biometric.available ? handleBiometric : undefined}
              biometricKind={biometric.kind}
            />
            <Pressable accessibilityRole="button" onPress={() => setPinVisible(false)} style={{ alignSelf: "center", paddingVertical: 8, paddingHorizontal: 18 }}>
              <Text style={{ color: theme.muted, fontSize: 15, fontWeight: "800" }}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Before/after media: shows the compressed result, with the ORIGINAL crossfading
// in on top when toggled. Images stay mounted (cached) so switching is instant —
// only opacity animates (UI thread), so it never lags. Video swaps its source.
function BeforeAfterMedia({ originalUri, compressedUri, isVideo, showOriginal }: { originalUri?: string; compressedUri?: string; isVideo: boolean; showOriginal: boolean }) {
  const theme = useAppTheme();
  const fade = useSharedValue(showOriginal ? 1 : 0);
  useEffect(() => {
    fade.value = withTiming(showOriginal ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [showOriginal, fade]);
  const originalStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (isVideo) {
    const uri = showOriginal ? originalUri : compressedUri;
    return uri ? (
      <VideoMediaPlayer uri={uri} contentFit="contain" style={{ flex: 1 }} />
    ) : (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!compressedUri && !originalUri) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {compressedUri ? <CachedImage uri={compressedUri} contentFit="contain" backgroundColor={theme.surfaceStrong} style={StyleSheet.absoluteFill} /> : null}
      {originalUri ? (
        <Animated.View style={[StyleSheet.absoluteFill, originalStyle]}>
          <CachedImage uri={originalUri} contentFit="contain" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
        </Animated.View>
      ) : null}
    </View>
  );
}

// Segmented Compressed/Original toggle with a sliding accent indicator.
function BeforeAfterToggle({ showOriginal, onChange }: { showOriginal: boolean; onChange: (value: boolean) => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const pos = useSharedValue(showOriginal ? 1 : 0);
  useEffect(() => {
    pos.value = withTiming(showOriginal ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [showOriginal, pos]);
  const half = Math.max((width - 8) / 2, 0);
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * half }] }));

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: "row", backgroundColor: theme.surfaceStrong, borderRadius: 13, padding: 4 }}>
      {half > 0 ? (
        <Animated.View style={[indicatorStyle, { position: "absolute", top: 4, left: 4, bottom: 4, width: half, borderRadius: 10, backgroundColor: theme.accent }]} />
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => onChange(false)} style={{ flex: 1, paddingVertical: 11, alignItems: "center" }}>
        <Text style={{ color: showOriginal ? theme.muted : "#fff", fontSize: 14, fontWeight: "900" }}>{t("compressRun.compressed")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => onChange(true)} style={{ flex: 1, paddingVertical: 11, alignItems: "center" }}>
        <Text style={{ color: showOriginal ? "#fff" : theme.muted, fontSize: 14, fontWeight: "900" }}>{t("compressRun.original")}</Text>
      </Pressable>
    </View>
  );
}

// Determinate progress bar with a continuous shimmer sweep — the sweep keeps
// moving even when the percentage is momentarily static (image compression
// reports coarse progress), so the screen always reads as "working".
function ShimmerProgressBar({ percent }: { percent: number }) {
  const theme = useAppTheme();
  const [barWidth, setBarWidth] = useState(0);
  const fill = useSharedValue(percent);
  const sweep = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(percent, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [percent, fill]);

  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [sweep]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(4, fill.value)}%` }));
  const highlightWidth = Math.max(barWidth * 0.35, 1);
  const shimmerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -highlightWidth + sweep.value * (barWidth + highlightWidth) }] }));

  return (
    <View
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      style={{ alignSelf: "stretch", height: 12, borderRadius: 6, backgroundColor: theme.surfaceStrong, overflow: "hidden" }}
    >
      <Animated.View style={[fillStyle, { height: "100%", borderRadius: 6, backgroundColor: theme.accent }]} />
      {barWidth > 0 ? (
        <Animated.View style={[shimmerStyle, { position: "absolute", top: 0, bottom: 0, width: highlightWidth }]}>
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.5)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

// "Compressing" with cycling ellipsis dots, for a constant sign of life.
function WorkingLabel({ text }: { text: string }) {
  const theme = useAppTheme();
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDots((value) => (value % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return (
    <Text selectable style={{ color: theme.muted, fontSize: 14, fontWeight: "800" }}>
      {text}
      {".".repeat(dots)}
    </Text>
  );
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
