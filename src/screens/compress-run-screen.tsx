import { router, useLocalSearchParams } from "expo-router";
import { AlertTriangle, CheckCircle2, Lock, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, BackHandler, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "@/components/cached-image";
import { PasscodePad } from "@/components/passcode-pad";
import { VideoMediaPlayer } from "@/components/video-media-player";
import { useCompressionStore } from "@/features/compression/compression.store";
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
  const { id, quality, origin } = useLocalSearchParams<{ id: string; quality?: string; origin?: string }>();

  const asset = useMediaIndexStore((state) => selectIndexedMediaAsset(state, id));
  const enqueueCompression = useCompressionStore((state) => state.enqueueCompression);
  const keepOriginal = useCompressionStore((state) => state.keepOriginal);
  const deleteOriginal = useCompressionStore((state) => state.deleteOriginal);
  const job = useCompressionStore((state) => (id ? state.getJobByMediaId(id) : undefined));
  const compressed = useAppStore((state) => state.compressedMedia.find((item) => item.sourceId === id));

  const startedRef = useRef(false);
  const [deciding, setDeciding] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [biometric, setBiometric] = useState<{ available: boolean; kind: BiometricKind }>({ available: false, kind: "generic" });
  const [deleteError, setDeleteError] = useState<string | undefined>();

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
    if (await AppLockService.hasPasscode()) {
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

  const filename = asset?.filename ?? job?.fileName ?? t("common.media");
  const isVideo = (asset?.mediaType ?? job?.mediaType) === "video";
  const resultUri = compressed?.outputUri;

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
              {resultUri && isVideo ? (
                <VideoMediaPlayer uri={resultUri} contentFit="contain" style={{ flex: 1 }} />
              ) : resultUri ? (
                <CachedImage uri={resultUri} contentFit="contain" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color={theme.accent} />
                </View>
              )}
            </View>
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
            <Text selectable style={{ color: theme.text, fontSize: 15, lineHeight: 21, fontWeight: "700", textAlign: "center" }}>
              {t("compression.singleDecisionPrompt")}
            </Text>
            {deleteError ? (
              <Text selectable style={{ color: theme.red, fontSize: 13, fontWeight: "800", textAlign: "center" }}>
                {deleteError}
              </Text>
            ) : null}
            <View style={{ gap: 11 }}>
              <Pressable
                disabled={deciding}
                onPress={handleDeletePress}
                style={{ minHeight: 52, borderRadius: 14, backgroundColor: `${theme.red}18`, borderWidth: 1, borderColor: theme.red, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: deciding ? 0.6 : 1 }}
              >
                <Trash2 size={18} color={theme.red} />
                <Text style={{ color: theme.red, fontSize: 16, fontWeight: "900" }}>{t("compression.deleteSingleOriginalButton")}</Text>
              </Pressable>
              <Pressable
                disabled={deciding}
                onPress={handleKeep}
                style={{ minHeight: 52, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", opacity: deciding ? 0.6 : 1 }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("compression.keepOriginalButton")}</Text>
              </Pressable>
            </View>
            <Text selectable style={{ color: theme.muted, fontSize: 12, lineHeight: 16, textAlign: "center" }}>
              {t("compression.deleteWarning")}
            </Text>
            {deciding ? <ActivityIndicator color={theme.accent} /> : null}
          </View>
        ) : (
          <View style={{ alignItems: "center", gap: 22 }}>
            <Text selectable style={{ color: theme.accent, fontSize: 64, fontWeight: "900" }}>{progressPercent}%</Text>
            <View style={{ alignSelf: "stretch", height: 12, borderRadius: 6, backgroundColor: theme.surfaceStrong, overflow: "hidden" }}>
              <View style={{ width: `${Math.max(4, progressPercent)}%`, height: "100%", borderRadius: 6, backgroundColor: theme.accent }} />
            </View>
            <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>{t("compressRun.title")}</Text>
            <Text selectable numberOfLines={1} style={{ color: theme.muted, fontSize: 14, fontWeight: "700" }}>{filename}</Text>
            <Text selectable style={{ color: theme.muted, fontSize: 13, lineHeight: 19, textAlign: "center" }}>{t("compressRun.hint")}</Text>
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

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <Text selectable style={{ color: valueColor ?? theme.text, fontSize: 14, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}
