import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "@/components/cached-image";
import { VideoMediaPlayer } from "@/components/video-media-player";
import { ShimmerProgressBar, WorkingLabel } from "@/features/convert/components/convert-progress";
import { targetLabel, targetMimeForShare } from "@/features/convert/convert-targets";
import { isActiveConversionJob, selectBatchProgress, selectJobsByBatch } from "@/features/convert/convert.selectors";
import { useConvertStore } from "@/features/convert/convert.store";
import { ConversionJob } from "@/features/convert/convert.types";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * Batch converting screen (2-5 items). The existing FIFO runner drains the queue
 * one at a time; this screen shows the CURRENT item + its %, a per-item status
 * list, and a Cancel-all. Cancel is cooperative: it marks active+queued jobs
 * cancelled and stops the queue advancing; the in-flight native encode finishes
 * silently and its output is discarded (same as the single run screen).
 *
 * A missing/garbage batchId yields an empty list, which is treated as "finished"
 * so the user is never trapped on a back-blocked spinner.
 */
export function ConvertBatchRunScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { batchId, origin } = useLocalSearchParams<{ batchId?: string; origin?: string }>();

  const jobs = useConvertStore((state) => state.jobs);
  const activeJobId = useConvertStore((state) => state.activeJobId);
  const cancelJob = useConvertStore((state) => state.cancelJob);
  const retryJob = useConvertStore((state) => state.retryJob);

  const [cancelVisible, setCancelVisible] = useState(false);

  const batchJobs = selectJobsByBatch(jobs, batchId);
  const progress = selectBatchProgress(jobs, batchId);
  const active = batchJobs.find((job) => job.id === activeJobId) ?? batchJobs.find(isActiveConversionJob);
  const isEmpty = batchJobs.length === 0;
  const canLeave = progress.finished || isEmpty;
  const activePercent = Math.round(Math.max(0, Math.min(1, active?.progress ?? 0)) * 100);

  const goHome = useCallback(() => {
    router.dismissTo((origin && origin.length > 0 ? origin : "/(tabs)/premium") as never);
  }, [origin]);

  // Block hardware back only while the batch is still running.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (cancelVisible) {
        setCancelVisible(false);
        return true;
      }
      return !canLeave;
    });
    return () => sub.remove();
  }, [cancelVisible, canLeave]);

  const confirmCancel = () => {
    setCancelVisible(false);
    batchJobs.filter(isActiveConversionJob).forEach((job) => void cancelJob(job.id));
    goHome();
  };

  const onBack = () => {
    if (canLeave) {
      goHome();
      return;
    }
    setCancelVisible(true);
  };

  const onRowPress = (job: ConversionJob) => {
    if (job.status === "failed") {
      retryJob(job.id);
      return;
    }
    if (job.status !== "completed" || !job.outputUri) return;
    if (job.outputKind === "audio") {
      void shareUri(job.outputUri, targetMimeForShare(job.target), t("convert.shareTitle"));
      return;
    }
    router.push({ pathname: "/compression-media-viewer", params: { uri: job.outputUri, media: job.outputKind === "video" ? "video" : "photo" } } as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("convert.close")} onPress={onBack} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: theme.text, fontSize: 19, fontWeight: "900" }}>{t("convert.batchTitle")}</Text>
          {!isEmpty ? (
            <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>{t("convert.batchProgress", { done: progress.done, total: progress.total })}</Text>
          ) : null}
        </View>
      </View>

      {isEmpty ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 16 }}>
          <AlertTriangle size={40} color={theme.accent} />
          <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 21, textAlign: "center" }}>{t("convert.batchEmpty")}</Text>
          <Pressable onPress={goHome} style={{ minHeight: 50, paddingHorizontal: 24, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("common.done")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {!progress.finished ? (
            <View style={{ paddingHorizontal: 20, gap: 16 }}>
              <View style={{ height: 220, borderRadius: 18, overflow: "hidden", backgroundColor: theme.surfaceStrong, borderWidth: 1, borderColor: theme.border }}>
                {active?.uri && active.inputKind === "video" ? (
                  <VideoMediaPlayer uri={active.uri} contentFit="cover" style={{ flex: 1 }} />
                ) : active?.uri ? (
                  <CachedImage uri={active.uri} contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color={theme.accent} />
                  </View>
                )}
              </View>
              <View style={{ alignItems: "center", gap: 12 }}>
                <Text selectable style={{ color: theme.accent, fontSize: 40, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{activePercent}%</Text>
                <ShimmerProgressBar percent={activePercent} />
                {active ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text selectable style={{ color: theme.muted, fontSize: 15, fontWeight: "900" }}>{fileExtLabel(active.fileName, active.inputKind === "video" ? "VIDEO" : "PHOTO")}</Text>
                    <ArrowRight size={16} color={theme.muted} />
                    <Text selectable style={{ color: theme.accent, fontSize: 15, fontWeight: "900" }}>{targetLabel(active.target)}</Text>
                  </View>
                ) : null}
                <WorkingLabel text={t("convert.working")} />
              </View>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 20, paddingTop: 16, alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={40} color={theme.green} />
              <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>{t("convert.batchDoneTitle")}</Text>
              <Text selectable style={{ color: theme.muted, fontSize: 14, fontWeight: "700", textAlign: "center" }}>{t("convert.batchDoneSummary", { done: progress.done, failed: progress.failed })}</Text>
            </View>
          )}

          <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 8 }}>
            {batchJobs.map((job) => {
              const isActiveRow = job.id === active?.id && !progress.finished;
              const tappable = job.status === "completed" || job.status === "failed";
              return (
                <Pressable
                  key={job.id}
                  accessibilityRole={tappable ? "button" : undefined}
                  disabled={!tappable}
                  onPress={() => onRowPress(job)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: isActiveRow ? theme.accent : theme.border, padding: 10 }}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text numberOfLines={1} style={{ color: theme.text, fontSize: 14, fontWeight: "800" }}>{job.fileName}</Text>
                    <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }}>{`${fileExtLabel(job.fileName, job.inputKind === "video" ? "VIDEO" : "PHOTO")} → ${targetLabel(job.target)}`}</Text>
                  </View>
                  <StatusPill job={job} />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {!isEmpty ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          {progress.finished ? (
            <Pressable onPress={goHome} style={{ minHeight: 52, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("common.done")}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setCancelVisible(true)} style={{ minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "800" }}>{t("convert.cancelAll")}</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      <Modal transparent animationType="fade" visible={cancelVisible} onRequestClose={() => setCancelVisible(false)} statusBarTranslucent>
        <Pressable accessibilityRole="button" onPress={() => setCancelVisible(false)} style={{ flex: 1, backgroundColor: "rgba(5,7,13,0.62)", justifyContent: "center", padding: 24 }}>
          <Pressable accessibilityRole="none" onPress={() => undefined} style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 22, gap: 18, borderWidth: 1, borderColor: theme.border }}>
            <View style={{ alignSelf: "center", width: 62, height: 62, borderRadius: 31, backgroundColor: `${theme.red}18`, borderWidth: 1, borderColor: `${theme.red}55`, alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={29} color={theme.red} />
            </View>
            <View style={{ gap: 8 }}>
              <Text selectable style={{ color: theme.text, fontSize: 22, lineHeight: 28, fontWeight: "900", textAlign: "center" }}>{t("convert.cancelBatchTitle")}</Text>
              <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 21, textAlign: "center" }}>{t("convert.cancelBatchMessage")}</Text>
            </View>
            <View style={{ gap: 10 }}>
              <Pressable onPress={() => setCancelVisible(false)} style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1 })}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("convert.keepConverting")}</Text>
              </Pressable>
              <Pressable onPress={confirmCancel} style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, backgroundColor: `${theme.red}14`, borderWidth: 1, borderColor: theme.red, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.76 : 1 })}>
                <Text style={{ color: theme.red, fontSize: 16, fontWeight: "900" }}>{t("convert.cancelConfirm")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatusPill({ job }: { job: ConversionJob }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  if (job.status === "completed") return <Check size={18} color={theme.green} />;
  if (job.status === "failed") return <Text style={{ color: theme.red, fontSize: 12, fontWeight: "900" }}>{t("convert.statusFailed")}</Text>;
  if (job.status === "cancelled") return <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "900" }}>{t("convert.statusCancelled")}</Text>;
  if (job.status === "converting") {
    return <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{`${Math.round(job.progress * 100)}%`}</Text>;
  }
  return <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "900" }}>{t("convert.statusQueued")}</Text>;
}

async function shareUri(uri: string, mime: string, dialogTitle: string) {
  try {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle });
  } catch {
    // User dismissed the share sheet or it failed — nothing to recover.
  }
}

function fileExtLabel(name?: string, fallback = ""): string {
  const ext = name?.split(".").pop();
  if (ext && ext.length >= 2 && ext.length <= 5 && /^[a-z0-9]+$/i.test(ext)) return ext.toUpperCase();
  return fallback;
}
