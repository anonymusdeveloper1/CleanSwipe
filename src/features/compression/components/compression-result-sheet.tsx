import { AlertTriangle, CheckCircle2, ChevronUp, Trash2 } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCompressionStore } from "@/features/compression/compression.store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
import { formatBytes } from "@/utils/format";

const PEEK_HEIGHT = 92;

/**
 * Post-compression result sheet shown over the media viewer (Android single-item
 * flow). It rests in a PEEK state pinned to the bottom (handle + one-line saved
 * summary); the user drags up — or taps the handle — to EXPAND for the full
 * before/after numbers and the original-file decision actions. It never fully
 * dismisses (Close on the viewer chrome handles leaving). Decision logic mirrors
 * the global CompressionCompleteSheet / the detail screen's CompletedDecisionPanel.
 */
export function CompressionResultSheet({ mediaId }: { mediaId: string }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const job = useCompressionStore((state) => state.getJobByMediaId(mediaId));
  const compressed = useAppStore((state) => state.compressedMedia.find((item) => item.sourceId === mediaId));
  const keepOriginal = useCompressionStore((state) => state.keepOriginal);
  const deleteOriginal = useCompressionStore((state) => state.deleteOriginal);
  const deleteCompressedCopy = useCompressionStore((state) => state.deleteCompressedCopy);
  const [busy, setBusy] = useState<string | undefined>();
  const [expanded, setExpanded] = useState(false);

  const sheetHeight = Math.min(height * 0.5, 380) + insets.bottom;
  const peekVisible = PEEK_HEIGHT + insets.bottom;
  const collapsedY = Math.max(sheetHeight - peekVisible, 0);
  const translateY = useSharedValue(collapsedY);
  const startY = useSharedValue(collapsedY);

  const snapTo = (toExpanded: boolean) => {
    translateY.value = withSpring(toExpanded ? 0 : collapsedY, { damping: 22, stiffness: 220 });
    setExpanded(toExpanded);
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.min(Math.max(startY.value + event.translationY, 0), collapsedY);
    })
    .onEnd((event) => {
      const toExpanded = translateY.value < collapsedY / 2 || event.velocityY < -600;
      translateY.value = withSpring(toExpanded ? 0 : collapsedY, { damping: 22, stiffness: 220 });
      runOnJS(setExpanded)(toExpanded);
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  // Chevron flips from up (peek) to down (expanded). Declared here — above the
  // early return below — so hook order stays stable (rules-of-hooks).
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(1 - translateY.value / (collapsedY || 1)) * 180}deg` }]
  }));

  const originalBytes = job?.originalSizeBytes ?? compressed?.originalBytes ?? 0;
  const finalBytes = job?.finalSizeBytes ?? compressed?.compressedBytes ?? 0;
  const savedBytes = job?.savedBytes ?? compressed?.savedBytes ?? 0;
  const didSaveStorage = savedBytes > 0;

  if (!job && !compressed) return null;

  const needsDecision =
    !!job && (job.shouldAskDeleteOriginal || job.originalAction === "pending_decision" || job.originalAction === "delete_failed");

  const statusText =
    job?.originalAction === "auto_deleted"
      ? t("compressionDetail.originalDeleted")
      : job?.originalAction === "keep_original"
        ? t("compressionDetail.originalKept")
        : job?.originalAction === "compressed_deleted"
          ? t("compressionDetail.compressedCopyDeleted")
          : job?.originalAction === "delete_failed"
            ? t("compressionDetail.couldNotDeleteOriginal")
            : undefined;

  const runAction = async (name: string, action: () => Promise<void> | void) => {
    setBusy(name);
    try {
      await action();
    } finally {
      setBusy(undefined);
    }
  };

  const isBusy = Boolean(busy);

  return (
    <Animated.View
      style={[
        sheetStyle,
        {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: sheetHeight,
          backgroundColor: theme.surface,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderWidth: 1,
          borderColor: theme.border,
          boxShadow: "0 -10px 30px rgba(0,0,0,0.35)"
        }
      ]}
    >
      <GestureDetector gesture={pan}>
        {/* Peek header: drag handle + saved summary + chevron. Tappable to toggle. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? t("compressionViewer.swipeDown") : t("compression.viewCompressedButton")}
          onPress={() => snapTo(!expanded)}
          style={{ height: PEEK_HEIGHT, paddingHorizontal: 20, paddingTop: 10 }}
        >
          <View style={{ alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: theme.faint, marginBottom: 12 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {didSaveStorage ? <CheckCircle2 size={22} color={theme.green} /> : <AlertTriangle size={22} color={theme.accent} />}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: theme.text, fontSize: 17, fontWeight: "900" }}>
                {didSaveStorage ? t("compression.completeTitle") : t("compression.finishedTitle")}
              </Text>
              <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 13, fontWeight: "700", marginTop: 1 }}>
                {didSaveStorage ? `${t("compression.youSavedLabel")} ${formatBytes(savedBytes)}` : statusText ?? job?.fileName ?? ""}
              </Text>
            </View>
            <Animated.View style={chevronStyle}>
              <ChevronUp size={22} color={theme.muted} />
            </Animated.View>
          </View>
        </Pressable>
      </GestureDetector>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16, gap: 12 }} showsVerticalScrollIndicator={false}>
        <View style={{ borderRadius: 12, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border, padding: 12, gap: 8 }}>
          <SummaryRow label={t("compression.originalSizeLabel")} value={formatBytes(originalBytes)} />
          <SummaryRow label={t("compression.compressedSizeLabel")} value={formatBytes(finalBytes)} />
          <SummaryRow
            label={didSaveStorage ? t("compression.youSavedLabel") : t("compression.storageSavedLabel")}
            value={didSaveStorage ? formatBytes(savedBytes) : t("compression.noneValue")}
            valueColor={didSaveStorage ? theme.green : theme.muted}
          />
        </View>

        {statusText && !needsDecision ? (
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: "800" }}>{statusText}</Text>
        ) : null}
        {job?.originalDeleteError ? (
          <Text style={{ color: theme.red, fontSize: 13, fontWeight: "800" }}>{job.originalDeleteError}</Text>
        ) : null}

        {needsDecision && job ? (
          <>
            {didSaveStorage ? (
              <SheetButton
                label={busy === "delete-original" ? t("compression.deleteSingleOriginalLoading") : t("compression.deleteSingleOriginalButton")}
                icon={Trash2}
                color={theme.red}
                disabled={isBusy}
                onPress={() => runAction("delete-original", () => deleteOriginal(job.id))}
              />
            ) : (
              <SheetButton
                label={busy === "delete-compressed" ? t("compression.deleteCompressedLoading") : t("compression.deleteCompressedButton")}
                icon={Trash2}
                color={theme.red}
                disabled={isBusy}
                onPress={() => runAction("delete-compressed", () => deleteCompressedCopy(job.id))}
              />
            )}
            <SheetButton label={t("compression.keepOriginalButton")} disabled={isBusy} onPress={() => runAction("keep", () => keepOriginal(job.id))} />
          </>
        ) : null}
        {isBusy ? <ActivityIndicator color={theme.accent} /> : null}
      </ScrollView>
    </Animated.View>
  );
}

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: valueColor ?? theme.text, fontSize: 14, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function SheetButton({ label, icon: Icon, color, disabled, onPress }: { label: string; icon?: LucideIcon; color?: string; disabled?: boolean; onPress: () => void }) {
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
      <Text style={{ color: color ?? theme.text, fontSize: 15, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}
