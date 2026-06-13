import { router } from "expo-router";
import { AlertTriangle, CheckCircle2, Eye, Trash2 } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCompressionStore } from "@/features/compression/compression.store";
import { CompressionBatch, CompressionJob } from "@/features/compression/compression.types";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatBytes } from "@/utils/format";

type SheetTarget =
  | { type: "single"; job: CompressionJob }
  | { type: "batch"; batch: CompressionBatch };

export function CompressionCompleteSheet() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const jobs = useCompressionStore((state) => state.jobs);
  const batches = useCompressionStore((state) => state.batches);
  const keepOriginal = useCompressionStore((state) => state.keepOriginal);
  const deleteOriginal = useCompressionStore((state) => state.deleteOriginal);
  const deleteCompressedCopy = useCompressionStore((state) => state.deleteCompressedCopy);
  const keepAllOriginals = useCompressionStore((state) => state.keepAllOriginals);
  const deleteAllOriginals = useCompressionStore((state) => state.deleteAllOriginals);
  const reviewBatchItems = useCompressionStore((state) => state.reviewBatchItems);
  const deferOriginalDecision = useCompressionStore((state) => state.deferOriginalDecision);
  const dismissBatchPrompt = useCompressionStore((state) => state.dismissBatchPrompt);
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const target = useMemo<SheetTarget | undefined>(() => {
    const batch = Object.values(batches)
      .filter((item) => item.shouldAskDeleteOriginals)
      .sort((a, b) => b.id.localeCompare(a.id))[0];
    if (batch) return { type: "batch", batch };

    // On Android, single-item completions are surfaced by the in-viewer result
    // sheet (the Android single-compression flow), so this global modal only
    // handles BATCH completions there. iOS keeps the modal for single + batch.
    if (Platform.OS === "android") return undefined;

    const job = Object.values(jobs)
      .filter((item) => item.status === "completed" && item.shouldAskDeleteOriginal && item.originalAction === "pending_decision")
      .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))[0];
    return job ? { type: "single", job } : undefined;
  }, [batches, jobs]);
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const targetId = target?.type === "single" ? target.job.id : target?.type === "batch" ? target.batch.id : undefined;

  useEffect(() => {
    translateY.value = 0;
  }, [targetId, translateY]);

  const handleDismiss = () => {
    if (!target) return;
    if (target.type === "single") {
      deferOriginalDecision(target.job.id);
    } else {
      dismissBatchPrompt(target.batch.id);
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = Math.max(event.translationY, 0);
    })
    .onEnd((event) => {
      const shouldDismiss = translateY.value > 90 || event.velocityY > 820;
      if (shouldDismiss) {
        translateY.value = withTiming(600, { duration: 180 }, () => runOnJS(handleDismiss)());
        return;
      }
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }]
  }));

  if (!target) return null;

  const busy = Boolean(busyAction);

  // Viewing the compressed file must hide the sheet first; otherwise the pushed
  // viewer route renders behind this modal and looks like nothing happened.
  const handleViewSingle = (mediaId: string) => {
    handleDismiss();
    router.push(`/compression-media-viewer?id=${encodeURIComponent(mediaId)}` as never);
  };

  const runAction = async (name: string, action: () => Promise<void> | void) => {
    setBusyAction(name);
    try {
      await action();
    } finally {
      setBusyAction(undefined);
    }
  };

  const isBatch = target.type === "batch";
  const savedBytes = isBatch ? target.batch.totalSavedBytes : target.job.savedBytes ?? 0;
  const originalBytes = isBatch ? target.batch.totalOriginalSizeBytes : target.job.originalSizeBytes ?? 0;
  const finalBytes = isBatch ? target.batch.totalFinalSizeBytes : target.job.finalSizeBytes ?? 0;
  const didSaveStorage = savedBytes > 0;
  const title = isBatch ? t("compression.completeTitle") : didSaveStorage ? t("compression.completeTitle") : t("compression.finishedTitle");

  return (
    <Modal transparent animationType="slide" visible onRequestClose={handleDismiss}>
      <GestureHandlerRootView style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={handleDismiss} style={{ flex: 1, backgroundColor: "rgba(5, 7, 13, 0.42)" }} />
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              animatedSheetStyle,
              {
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                backgroundColor: theme.surface,
                paddingHorizontal: 20,
                paddingTop: 10,
                paddingBottom: insets.bottom + 16,
                gap: 14,
                borderWidth: 1,
                borderColor: theme.border
              }
            ]}
          >
            <View style={{ alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: theme.faint, marginBottom: 4 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {didSaveStorage ? <CheckCircle2 size={24} color={theme.green} /> : <AlertTriangle size={24} color={theme.accent} />}
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: theme.text, fontSize: 21, fontWeight: "900" }}>
                {title}
              </Text>
              <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700", marginTop: 2 }}>
                {isBatch ? `${t("compression.completedSummary", { count: target.batch.completedCount, plural: target.batch.completedCount === 1 ? "" : "s", failed: target.batch.failedCount ? `, ${target.batch.failedCount} failed` : "" })}.` : target.job.fileName}
              </Text>
            </View>
          </View>

          <View style={{ borderRadius: 12, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border, padding: 12, gap: 8 }}>
            <SummaryRow label={t("compression.originalSizeLabel")} value={formatBytes(originalBytes)} />
            <SummaryRow label={t("compression.compressedSizeLabel")} value={formatBytes(finalBytes)} />
            <SummaryRow label={didSaveStorage ? t("compression.youSavedLabel") : t("compression.storageSavedLabel")} value={didSaveStorage ? formatBytes(savedBytes) : t("compression.noneValue")} valueColor={didSaveStorage ? theme.green : theme.muted} />
          </View>

          <Text selectable style={{ color: theme.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }}>
            {isBatch
              ? t("compression.batchDecisionPrompt")
              : didSaveStorage
                ? t("compression.singleDecisionPrompt")
                : t("compression.noStorageSavedWarning")}
          </Text>
          {didSaveStorage ? (
            <Text selectable style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>
              {t("compression.deleteWarning")}
            </Text>
          ) : null}

          {isBatch ? (
            <>
              <SheetButton
                label={busyAction === "delete-all" ? t("compression.deleteAllOriginalsLoading") : t("compression.deleteAllOriginalsButton")}
                icon={Trash2}
                color={theme.red}
                disabled={busy || !didSaveStorage}
                onPress={() => runAction("delete-all", () => deleteAllOriginals(target.batch.id))}
              />
              <SheetButton label={t("compression.reviewBatchButton")} icon={Eye} disabled={busy} onPress={() => runAction("review", () => reviewBatchItems(target.batch.id))} />
              <SheetButton label={t("compression.keepAllOriginalsButton")} disabled={busy} onPress={() => runAction("keep-all", () => keepAllOriginals(target.batch.id))} />
            </>
          ) : (
            <>
              {target.job.originalDeleteError ? (
                <Text selectable style={{ color: theme.red, fontSize: 13, fontWeight: "800" }}>
                  {target.job.originalDeleteError}
                </Text>
              ) : null}
              {didSaveStorage ? (
                <SheetButton
                  label={busyAction === "delete-original" ? t("compression.deleteSingleOriginalLoading") : t("compression.deleteSingleOriginalButton")}
                  icon={Trash2}
                  color={theme.red}
                  disabled={busy}
                  onPress={() => runAction("delete-original", () => deleteOriginal(target.job.id))}
                />
              ) : (
                <SheetButton
                  label={busyAction === "delete-compressed" ? t("compression.deleteCompressedLoading") : t("compression.deleteCompressedButton")}
                  icon={Trash2}
                  color={theme.red}
                  disabled={busy}
                  onPress={() => runAction("delete-compressed", () => deleteCompressedCopy(target.job.id))}
                />
              )}
              <SheetButton label={t("compression.keepOriginalButton")} disabled={busy} onPress={() => runAction("keep", () => keepOriginal(target.job.id))} />
              <SheetButton label={t("compression.viewCompressedButton")} icon={Eye} disabled={busy} onPress={() => handleViewSingle(target.job.mediaId)} />
            </>
          )}
          {busy ? <ActivityIndicator color={theme.accent} /> : null}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>
        {label}
      </Text>
      <Text selectable style={{ color: valueColor ?? theme.text, fontSize: 14, fontWeight: "900" }}>
        {value}
      </Text>
    </View>
  );
}

function SheetButton({
  label,
  icon: Icon,
  color,
  disabled,
  onPress
}: {
  label: string;
  icon?: LucideIcon;
  color?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: color ?? theme.border,
        backgroundColor: color ? `${color}18` : theme.surfaceSoft,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        opacity: disabled ? 0.52 : 1
      }}
    >
      {Icon ? <Icon size={18} color={color ?? theme.text} /> : null}
      <Text style={{ color: color ?? theme.text, fontSize: 15, fontWeight: "900" }}>
        {label}
      </Text>
    </Pressable>
  );
}
