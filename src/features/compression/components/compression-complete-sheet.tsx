import { router } from "expo-router";
import { AlertTriangle, CheckCircle2, Eye, Trash2 } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCompressionStore } from "@/features/compression/compression.store";
import { CompressionJob } from "@/features/compression/compression.types";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatBytes } from "@/utils/format";

/**
 * Global post-compression decision modal for a SINGLE completed item.
 *
 * Android surfaces single-item completions via the in-viewer result sheet, so
 * this global modal only runs on iOS (Android returns no target). Batch
 * compression has been removed, so there is no batch branch.
 */
export function CompressionCompleteSheet() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const jobs = useCompressionStore((state) => state.jobs);
  const keepOriginal = useCompressionStore((state) => state.keepOriginal);
  const deleteOriginal = useCompressionStore((state) => state.deleteOriginal);
  const deleteCompressedCopy = useCompressionStore((state) => state.deleteCompressedCopy);
  const deferOriginalDecision = useCompressionStore((state) => state.deferOriginalDecision);
  const translateY = useSharedValue(0);

  const job = useMemo<CompressionJob | undefined>(() => {
    if (Platform.OS === "android") return undefined;
    return Object.values(jobs)
      .filter((item) => item.status === "completed" && item.shouldAskDeleteOriginal && item.originalAction === "pending_decision")
      .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))[0];
  }, [jobs]);

  const [busyAction, setBusyAction] = useState<string | undefined>();

  useEffect(() => {
    translateY.value = 0;
  }, [job?.id, translateY]);

  const handleDismiss = () => {
    if (!job) return;
    deferOriginalDecision(job.id);
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

  const animatedSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!job) return null;

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

  const savedBytes = job.savedBytes ?? 0;
  const originalBytes = job.originalSizeBytes ?? 0;
  const finalBytes = job.finalSizeBytes ?? 0;
  const didSaveStorage = savedBytes > 0;
  const title = didSaveStorage ? t("compression.completeTitle") : t("compression.finishedTitle");

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
                  {job.fileName}
                </Text>
              </View>
            </View>

            <View style={{ borderRadius: 12, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border, padding: 12, gap: 8 }}>
              <SummaryRow label={t("compression.originalSizeLabel")} value={formatBytes(originalBytes)} />
              <SummaryRow label={t("compression.compressedSizeLabel")} value={formatBytes(finalBytes)} />
              <SummaryRow label={didSaveStorage ? t("compression.youSavedLabel") : t("compression.storageSavedLabel")} value={didSaveStorage ? formatBytes(savedBytes) : t("compression.noneValue")} valueColor={didSaveStorage ? theme.green : theme.muted} />
            </View>

            <Text selectable style={{ color: theme.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }}>
              {didSaveStorage ? t("compression.singleDecisionPrompt") : t("compression.noStorageSavedWarning")}
            </Text>
            {didSaveStorage ? (
              <Text selectable style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>
                {t("compression.deleteWarning")}
              </Text>
            ) : null}

            {job.originalDeleteError ? (
              <Text selectable style={{ color: theme.red, fontSize: 13, fontWeight: "800" }}>
                {job.originalDeleteError}
              </Text>
            ) : null}
            {didSaveStorage ? (
              <SheetButton
                label={busyAction === "delete-original" ? t("compression.deleteSingleOriginalLoading") : t("compression.deleteSingleOriginalButton")}
                icon={Trash2}
                color={theme.red}
                disabled={busy}
                onPress={() => runAction("delete-original", () => deleteOriginal(job.id))}
              />
            ) : (
              <SheetButton
                label={busyAction === "delete-compressed" ? t("compression.deleteCompressedLoading") : t("compression.deleteCompressedButton")}
                icon={Trash2}
                color={theme.red}
                disabled={busy}
                onPress={() => runAction("delete-compressed", () => deleteCompressedCopy(job.id))}
              />
            )}
            <SheetButton label={t("compression.keepOriginalButton")} disabled={busy} onPress={() => runAction("keep", () => keepOriginal(job.id))} />
            <SheetButton label={t("compression.viewCompressedButton")} icon={Eye} disabled={busy} onPress={() => handleViewSingle(job.mediaId)} />
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
