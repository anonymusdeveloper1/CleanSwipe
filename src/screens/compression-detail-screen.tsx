import type { TFunction } from "i18next";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BrushCleaning, CheckCircle2, Eye, Info, Lock, Play, Settings, SlidersHorizontal, Sparkles, Trash2, Video, X } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "@/components/cached-image";
import { EmptyState } from "@/components/empty-state";
import { VideoCompressAdDialog } from "@/components/video-compress-ad-dialog";
import { RewardedAdService } from "@/features/ads/rewarded.service";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";
import { useCompressionStore } from "@/features/compression/compression.store";
import { FREE_DAILY_VIDEO_LIMIT, useFreeVideoQuotaStore } from "@/features/compression/free-video-quota.store";
import { CompressionJob } from "@/features/compression/compression.types";
import { useAppTheme } from "@/hooks/use-app-theme";
import { CompressionQuality, PhotoAsset } from "@/models/photo";
import { CompressionService, compressionProfiles } from "@/services/compression-service";
import { useAppStore } from "@/store/app-store";
import { selectIndexedMediaAsset, useMediaIndexStore } from "@/store/media-index-store";
import { usePaywallStore } from "@/store/paywall-store";
import { formatBytes, formatResolution } from "@/utils/format";

const qualityOptions: CompressionQuality[] = ["low", "medium", "high"];

export function CompressionDetailScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id, origin } = useLocalSearchParams<{ id: string; origin?: string }>();
  const [quality, setQuality] = useState<CompressionQuality>("medium");
  const [adPromptRemaining, setAdPromptRemaining] = useState<number | null>(null);
  const { canUseFeature } = useFeatureAccess();
  const openPaywall = usePaywallStore((state) => state.open);
  const advancedUnlocked = canUseFeature("advancedCompressionSettings");
  // Free users are pinned to the default quality regardless of local state.
  const displayQuality: CompressionQuality = advancedUnlocked ? quality : "medium";
  const compressedMedia = useAppStore((state) => state.compressedMedia);
  const job = useCompressionStore((state) => state.getJobByMediaId(id));
  const activeJobId = useCompressionStore((state) => state.activeJobId);
  const queuedJobCount = useCompressionStore((state) => state.queue.length);
  const cancelJob = useCompressionStore((state) => state.cancelJob);
  const keepOriginal = useCompressionStore((state) => state.keepOriginal);
  const deleteOriginal = useCompressionStore((state) => state.deleteOriginal);
  const deleteCompressedCopy = useCompressionStore((state) => state.deleteCompressedCopy);
  const asset = useMediaIndexStore((state) => selectIndexedMediaAsset(state, id));
  const result = compressedMedia.find((item) => item.sourceId === id);
  const isQueued = job?.status === "queued";
  const isPreparing = job?.status === "preparing";
  const isCompressing = job?.status === "compressing";
  const isCompleted = Boolean(result || job?.status === "completed");
  const isFailed = job?.status === "failed";
  const hasActiveJobForMedia = isQueued || isPreparing || isCompressing;
  const hasGlobalQueue = Boolean(activeJobId || queuedJobCount > 0);
  const estimate = useMemo(() => (asset ? CompressionService.estimate(asset, displayQuality) : undefined), [asset, displayQuality]);
  const displayOriginal = result?.originalBytes ?? job?.originalSizeBytes ?? estimate?.originalBytes ?? 0;
  const displayCompressed = result?.compressedBytes ?? job?.finalSizeBytes ?? job?.estimatedReducedSizeBytes ?? estimate?.compressedBytes ?? 0;
  const displaySaved = result?.savedBytes ?? job?.savedBytes ?? estimate?.savedBytes ?? 0;
  const horizontalPadding = width < 380 ? 16 : 20;
  const contentWidth = Math.min(width - horizontalPadding * 2, 680);
  const compact = width < 380 || height < 720;

  // Android single-item flow: when THIS item's compression finishes while the
  // user is still on this screen, auto-open the result viewer (media + result
  // sheet). If they navigated away, don't hijack — the completion notification is
  // the only surface. Fires once, on the status transition into "completed".
  const focusedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
      };
    }, [])
  );
  // Safety net for the manual "View Compressed" / system-back paths: if the user
  // lands back here for an item that was compressed AND its original deleted, the
  // source asset is gone from the media index and there's nothing to show — bail
  // to the origin instead of rendering "Media not found".
  useFocusEffect(
    useCallback(() => {
      if (!asset && result) {
        router.dismissTo((origin ?? "/(tabs)/history") as never);
      }
    }, [asset, result, origin])
  );
  const prevStatusRef = useRef(job?.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = job?.status;
    if (Platform.OS !== "android") return;
    if (!job || job.status !== "completed" || prev === "completed") return;
    if (!focusedRef.current) return;
    const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : "";
    // REPLACE (not push) so this detail screen is removed from the back stack.
    // Otherwise, after the user deletes the original (its asset leaves the media
    // index), pressing Android back from the viewer would reveal this now-stale
    // detail screen showing "Media not found". With replace, Close and system
    // back both return to the origin (e.g. the Compress grid).
    router.replace(`/compression-media-viewer?id=${encodeURIComponent(job.mediaId)}&result=1${originParam}` as never);
  }, [job, origin]);

  const startCompression = () => {
    if (!asset) return;
    const effectiveQuality = advancedUnlocked ? quality : "medium";
    // Foreground flow: hand off to the dedicated compress-run screen which runs
    // the compression, shows the result, and asks Keep/Delete original.
    router.push(`/compress-run?id=${encodeURIComponent(asset.id)}&quality=${effectiveQuality}&origin=${encodeURIComponent(origin ?? "/(tabs)/history")}` as never);
  };

  const handleCompress = () => {
    if (!asset || hasActiveJobForMedia || isCompleted) return;
    // Free users: video compression is rewarded-ad gated and capped per day.
    // (Pro users hold the `videoCompression` entitlement and skip this branch.)
    if (asset.mediaType === "video" && !canUseFeature("videoCompression")) {
      const remaining = useFreeVideoQuotaStore.getState().remainingToday();
      if (remaining <= 0) {
        // Daily free-video limit reached — route to the upgrade screen.
        router.push("/premium");
        return;
      }
      // Open the custom opt-in dialog showing today's remaining free compressions.
      setAdPromptRemaining(remaining);
      return;
    }
    startCompression();
  };

  // Confirmed in the custom dialog: watch the rewarded ad, then compress on reward.
  const handleWatchAd = async () => {
    setAdPromptRemaining(null);
    const earned = await RewardedAdService.showForReward();
    if (!earned) {
      Alert.alert(t("compressionDetail.adNotReady"));
      return;
    }
    useFreeVideoQuotaStore.getState().recordVideoCompression();
    startCompression();
  };

  const handleQualityPress = (option: CompressionQuality) => {
    if (!advancedUnlocked) {
      openPaywall("advancedCompressionSettings");
      return;
    }
    setQuality(option);
  };

  if (!asset) {
    // Compressed-and-deleted item: the focus effect above redirects to the origin,
    // so render a blank background in the meantime rather than a "not found" error.
    if (result) {
      return <View style={{ flex: 1, backgroundColor: theme.background }} />;
    }
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
        <DetailHeader compact={compact} />
        <EmptyState icon={BrushCleaning} title={t("compressionDetail.mediaNotFound")} message={t("compressionDetail.mediaNotFoundMessage")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: (compact ? 88 : 104) + insets.bottom }}
      >
        <DetailHeader compact={compact} />
        <View style={{ width: contentWidth, alignSelf: "center", paddingTop: compact ? 12 : 18, gap: compact ? 14 : 18 }}>
          <View style={{ flexDirection: width < 430 ? "column" : "row", alignItems: width < 430 ? "flex-start" : "center", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
              {asset.mediaType === "video" ? <Video size={23} color={theme.accent} /> : <BrushCleaning size={23} color={theme.accent} />}
              <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.text, fontSize: compact ? 17 : 20, letterSpacing: 0, fontWeight: "900", flexShrink: 1 }}>
                {asset.mediaType === "video" ? t("compressionDetail.videoCompressionTitle") : t("compressionDetail.photoCompressionTitle")}
              </Text>
            </View>
            <View style={{ borderRadius: 12, backgroundColor: "#5eeab0", paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: "#065f46", fontSize: 12, fontWeight: "900" }}>
                {asset.mediaType === "video" ? t("compressionDetail.hevcHighBadge") : t("compressionDetail.jpegHighBadge")}
              </Text>
            </View>
          </View>

          <MediaPreview asset={asset} compact={compact} maxWidth={contentWidth} />

          <View
            style={{
              minHeight: compact ? 78 : 88,
              borderRadius: 12,
              backgroundColor: theme.surfaceSoft,
              borderWidth: 1,
              borderColor: theme.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-around"
            }}
          >
            <Metric label={t("compressionDetail.originalMetricLabel")} value={formatBytes(displayOriginal)} color={theme.text} />
            <Divider />
            <Metric label={t("compressionDetail.reducedMetricLabel")} value={formatBytes(displayCompressed)} color={theme.green} />
            <Divider />
            <Metric label={t("compressionDetail.saveMetricLabel")} value={formatBytes(displaySaved)} color={theme.accent} />
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text selectable style={{ color: theme.text, fontSize: compact ? 18 : 20, letterSpacing: 0, fontWeight: "900" }}>
                {t("compressionDetail.compressionQualityHeading")}
              </Text>
              {!advancedUnlocked ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.surfaceStrong, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Lock size={12} color={theme.accent} />
                  <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "900" }}>{t("subscription.proBadge")}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {qualityOptions.map((option) => (
                <QualityCard
                  key={option}
                  quality={option}
                  selected={advancedUnlocked ? quality === option : option === "medium"}
                  compact={compact}
                  disabled={hasActiveJobForMedia || isCompleted}
                  locked={!advancedUnlocked}
                  onPress={() => handleQualityPress(option)}
                />
              ))}
            </View>
            {!advancedUnlocked ? (
              <Text selectable style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>
                {t("compressionDetail.advancedQualityLocked")}
              </Text>
            ) : null}
          </View>

          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surfaceSoft,
              padding: compact ? 12 : 14,
              flexDirection: "row",
              gap: 10
            }}
          >
            <Info size={21} color={theme.accent} />
            <Text selectable style={{ flex: 1, color: theme.text, fontSize: compact ? 14 : 15, lineHeight: compact ? 20 : 22 }}>
              {compressionProfiles[displayQuality].description}
            </Text>
          </View>

          {job && (job.status === "queued" || job.status === "preparing" || job.status === "compressing" || job.status === "failed") ? <CompressionStatusPanel job={job} compact={compact} onCancel={() => cancelJob(job.id)} /> : null}

          {isCompleted ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", paddingHorizontal: 10 }}>
              <CheckCircle2 size={18} color={theme.green} />
              <Text selectable numberOfLines={2} style={{ color: theme.green, fontSize: 14, fontWeight: "800", textAlign: "center", flexShrink: 1 }}>
                {t("compressionDetail.compressionCompleted")}
              </Text>
            </View>
          ) : null}
          {isCompleted && job ? (
            <CompletedDecisionPanel
              job={job}
              compact={compact}
              onKeep={() => keepOriginal(job.id)}
              onDeleteOriginal={() => deleteOriginal(job.id)}
              onDeleteCompressed={() => deleteCompressedCopy(job.id)}
              onView={() => router.push(`/compression-media-viewer?id=${encodeURIComponent(job.mediaId)}&result=1${origin ? `&origin=${encodeURIComponent(origin)}` : ""}` as never)}
            />
          ) : null}
          {isFailed && job?.errorMessage ? (
            <Text selectable style={{ color: theme.red, fontSize: 14, fontWeight: "800", textAlign: "center" }}>
              {job.errorMessage}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <View style={{ position: "absolute", left: horizontalPadding, right: horizontalPadding, bottom: insets.bottom + 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("compressionDetail.compressNowButton")}
          disabled={hasActiveJobForMedia || isCompleted}
          onPress={handleCompress}
          style={{
            minHeight: compact ? 56 : 62,
            borderRadius: 14,
            backgroundColor: theme.accent,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 10,
            opacity: hasActiveJobForMedia || isCompleted ? 0.8 : 1,
            boxShadow: "0 13px 28px rgba(7, 94, 200, 0.24)"
          }}
        >
          {isPreparing || isCompressing ? <ActivityIndicator color="#fff" /> : null}
          <Text style={{ color: "#fff", fontSize: compact ? 17 : 19, fontWeight: "900" }}>
            {getButtonLabel({ job, isCompleted, hasGlobalQueue, t })}
          </Text>
          {!hasActiveJobForMedia && !isCompleted ? (
            <Sparkles size={22} color="#fff" />
          ) : (
            null
          )}
        </Pressable>
      </View>
      <VideoCompressAdDialog
        visible={adPromptRemaining !== null}
        remaining={adPromptRemaining ?? 0}
        limit={FREE_DAILY_VIDEO_LIMIT}
        onCancel={() => setAdPromptRemaining(null)}
        onConfirm={() => void handleWatchAd()}
      />
    </View>
  );
}

function DetailHeader({ compact }: { compact: boolean }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + (compact ? 8 : 12), paddingHorizontal: 16, paddingBottom: compact ? 8 : 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("compressionDetail.goBackButton")} onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
        <ArrowLeft size={26} color={theme.accent} />
      </Pressable>
      <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.accent, fontSize: compact ? 20 : 23, fontWeight: "900", flexShrink: 1, textAlign: "center" }}>
        {t("compressionDetail.headerTitle")}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("compressionDetail.openSettingsButton")} onPress={() => router.push("/settings")} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
        <Settings size={25} color={theme.text} />
      </Pressable>
    </View>
  );
}

function MediaPreview({ asset, compact, maxWidth }: { asset: PhotoAsset; compact: boolean; maxWidth: number }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [uri, setUri] = useState(asset.uri);
  const isVideo = asset.mediaType === "video";
  const previewHeight = Math.min(compact ? 270 : 340, Math.max(220, maxWidth * 0.82));

  useEffect(() => {
    let mounted = true;
    setUri(asset.uri);
    if (isVideo) {
      CompressionService.createThumbnail(asset)
        .then((thumbnailUri) => {
          if (mounted) setUri(thumbnailUri);
        })
        .catch(() => undefined);
    }
    return () => {
      mounted = false;
    };
  }, [asset, isVideo]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("compressionDetail.openFullScreenLabel", { type: isVideo ? t("common.video") : t("common.photo") })}
      onPress={() => router.push({ pathname: "/compression-media-viewer", params: { id: asset.id } })}
      style={{ height: previewHeight, borderRadius: 16, overflow: "hidden", backgroundColor: theme.surfaceStrong }}
    >
      <CachedImage uri={uri} contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
      <LinearGradient colors={["rgba(255,255,255,0.18)", "rgba(10,12,18,0.12)", "rgba(5,7,13,0.38)"]} style={{ position: "absolute", inset: 0 }} />
      {isVideo ? (
        <View style={{ position: "absolute", top: "43%", alignSelf: "center", width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(255,255,255,0.42)", alignItems: "center", justifyContent: "center" }}>
          <Play size={24} color={theme.accent} fill="transparent" />
        </View>
      ) : null}
      <View style={{ position: "absolute", left: 12, bottom: 12, borderRadius: 10, backgroundColor: "rgba(42, 44, 50, 0.72)", paddingHorizontal: 10, paddingVertical: 8, maxWidth: "48%" }}>
        <Text selectable style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
          {isVideo ? t("compressionDetail.durationLabel") : t("compressionDetail.resolutionLabel")}
        </Text>
        <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
          {isVideo ? formatDuration(asset.duration) : formatResolution(asset.width, asset.height)}
        </Text>
      </View>
      <View style={{ position: "absolute", right: 12, bottom: 12, borderRadius: 10, backgroundColor: "rgba(42, 44, 50, 0.72)", paddingHorizontal: 10, paddingVertical: 8, maxWidth: "42%" }}>
        <Text selectable style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
          {isVideo ? t("compressionDetail.resolutionLabel") : t("compressionDetail.typeLabel")}
        </Text>
        <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
          {isVideo ? shortResolution(asset.width, asset.height, t) : t("compressionDetail.largeTypeLabel")}
        </Text>
      </View>
    </Pressable>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 5, paddingHorizontal: 4 }}>
      <Text selectable numberOfLines={1} style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }}>
        {label}
      </Text>
      <Text selectable numberOfLines={1} adjustsFontSizeToFit style={{ color, fontSize: 19, fontWeight: "900" }}>
        {value.replace(" ", "")}
      </Text>
    </View>
  );
}

function Divider() {
  const theme = useAppTheme();
  return <View style={{ width: 1, height: 40, backgroundColor: theme.border }} />;
}

function CompressionStatusPanel({ job, compact, onCancel }: { job: CompressionJob; compact: boolean; onCancel: () => void }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const isFailed = job.status === "failed";
  const isActive = job.status === "queued" || job.status === "preparing" || job.status === "compressing";
  return (
    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: isFailed ? theme.red : theme.border, backgroundColor: theme.surfaceSoft, padding: compact ? 12 : 14, gap: 9 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text selectable numberOfLines={1} style={{ flex: 1, color: isFailed ? theme.red : theme.text, fontSize: compact ? 14 : 15, fontWeight: "900" }}>
          {getStatusLabel(job, t)}
        </Text>
        {isActive ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            onPress={onCancel}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, minHeight: 32, borderRadius: 9, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}
          >
            <X size={15} color={theme.muted} />
            <Text style={{ color: theme.muted, fontSize: 13, fontWeight: "900" }}>{t("common.cancel")}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text selectable numberOfLines={1} style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>
        {job.fileName}
      </Text>
      {isActive ? (
        <View style={{ height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: theme.surfaceStrong }}>
          <View style={{ width: `${Math.max(4, Math.round(job.progress * 100))}%`, height: 5, backgroundColor: theme.accent }} />
        </View>
      ) : null}
    </View>
  );
}

function CompletedDecisionPanel({
  job,
  compact,
  onKeep,
  onDeleteOriginal,
  onDeleteCompressed,
  onView
}: {
  job: CompressionJob;
  compact: boolean;
  onKeep: () => Promise<void>;
  onDeleteOriginal: () => Promise<void>;
  onDeleteCompressed: () => Promise<void>;
  onView: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [busy, setBusy] = useState<string | undefined>();
  const didSaveStorage = (job.savedBytes ?? 0) > 0;
  const originalStatus =
    job.originalAction === "auto_deleted"
      ? t("compressionDetail.originalDeleted")
      : job.originalAction === "keep_original"
        ? t("compressionDetail.originalKept")
        : job.originalAction === "delete_failed"
          ? t("compressionDetail.couldNotDeleteOriginal")
          : job.originalAction === "compressed_deleted"
            ? t("compressionDetail.compressedCopyDeleted")
            : t("compressionDetail.waitingForDecision");

  const run = async (name: string, action: () => Promise<void> | void) => {
    setBusy(name);
    try {
      await action();
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceSoft, padding: compact ? 12 : 14, gap: 10 }}>
      <Text selectable style={{ color: theme.text, fontSize: compact ? 15 : 16, fontWeight: "900" }}>
        {originalStatus}
      </Text>
      {job.originalDeleteError ? (
        <Text selectable style={{ color: theme.red, fontSize: 13, fontWeight: "800" }}>
          {job.originalDeleteError}
        </Text>
      ) : null}
      {job.shouldAskDeleteOriginal || job.originalAction === "delete_failed" || job.originalAction === "pending_decision" ? (
        <View style={{ gap: 8 }}>
          {didSaveStorage ? (
            <ActionButton label={busy === "delete" ? t("compressionDetail.deletingOriginalLabel") : t("compressionDetail.deleteOriginalButton")} icon={Trash2} color={theme.red} disabled={Boolean(busy)} onPress={() => run("delete", onDeleteOriginal)} />
          ) : (
            <ActionButton label={busy === "delete-compressed" ? t("compressionDetail.deletingCompressedLabel") : t("compressionDetail.deleteCompressedButton")} icon={Trash2} color={theme.red} disabled={Boolean(busy)} onPress={() => run("delete-compressed", onDeleteCompressed)} />
          )}
          <ActionButton label={t("compressionDetail.keepOriginalButton")} disabled={Boolean(busy)} onPress={() => run("keep", onKeep)} />
          <ActionButton label={t("compressionDetail.viewCompressedButton")} icon={Eye} disabled={Boolean(busy)} onPress={onView} />
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({ label, icon: Icon, color, disabled, onPress }: { label: string; icon?: LucideIcon; color?: string; disabled?: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 42,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: color ?? theme.border,
        backgroundColor: color ? `${color}16` : theme.surface,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        opacity: disabled ? 0.55 : 1
      }}
    >
      {Icon ? <Icon size={17} color={color ?? theme.text} /> : null}
      <Text style={{ color: color ?? theme.text, fontSize: 14, fontWeight: "900" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function QualityCard({ quality, selected, compact, disabled, locked = false, onPress }: { quality: CompressionQuality; selected: boolean; compact: boolean; disabled: boolean; locked?: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const profile = compressionProfiles[quality];
  const Icon = quality === "low" ? SlidersHorizontal : quality === "medium" ? BrushCleaning : Sparkles;
  // When locked (Free), non-default cards are visibly dimmed but still tappable
  // so the press can open the paywall.
  const dimmed = locked && !selected;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: compact ? 82 : 96,
        borderRadius: 12,
        borderWidth: 1.3,
        borderColor: selected ? theme.accent : theme.border,
        backgroundColor: selected ? theme.surface : theme.surfaceSoft,
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingHorizontal: 6,
        opacity: disabled ? 0.62 : dimmed ? 0.7 : 1,
        boxShadow: selected ? "0 10px 24px rgba(7, 94, 200, 0.15)" : "none"
      }}
    >
      {dimmed ? (
        <View style={{ position: "absolute", top: 6, right: 6 }}>
          <Lock size={13} color={theme.muted} />
        </View>
      ) : null}
      <Icon size={compact ? 21 : 23} color={selected ? theme.accent : theme.text} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: selected ? theme.accent : theme.text, fontSize: compact ? 14 : 16, letterSpacing: 0, fontWeight: "900" }}>
        {profile.label}
      </Text>
      <Text numberOfLines={1} style={{ color: selected ? theme.accent : theme.muted, fontSize: compact ? 12 : 13, fontWeight: "800" }}>{profile.fidelity}</Text>
    </Pressable>
  );
}

function getButtonLabel({ job, isCompleted, hasGlobalQueue, t }: { job?: CompressionJob; isCompleted: boolean; hasGlobalQueue: boolean; t: TFunction }) {
  if (isCompleted) return t("compressionDetail.compressedButtonLabel");
  if (job?.status === "queued") return t("compressionDetail.queuedButtonLabel");
  if (job?.status === "preparing") return t("compressionDetail.preparingButtonLabel");
  if (job?.status === "compressing") return t("compressionDetail.compressingButtonLabel", { progress: Math.round(job.progress * 100) });
  if (job?.status === "failed") return t("compressionDetail.tryAgainButtonLabel");
  return hasGlobalQueue ? t("compressionDetail.addToQueueButtonLabel") : t("compressionDetail.compressNowButtonLabel");
}

function getStatusLabel(job: CompressionJob, t: TFunction) {
  const queueLabel = job.queueTotal && job.queueTotal > 1 && job.queuePosition ? ` (${job.queuePosition}/${job.queueTotal})` : "";
  if (job.status === "queued") return t("compressionDetail.queuedStatus", { queuePosition: queueLabel });
  if (job.status === "preparing") return t("compressionDetail.preparingStatus", { queuePosition: queueLabel });
  if (job.status === "failed") return t("compressionDetail.compressionFailedStatus");
  return t("compressionDetail.compressingStatus", { queuePosition: queueLabel, progress: Math.round(job.progress * 100) });
}

function formatDuration(duration?: number) {
  const totalSeconds = Math.max(Math.round(duration ?? 0), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function shortResolution(width: number | undefined, height: number | undefined, t: TFunction) {
  if (!width || !height) return t("compressionDetail.resolutionHd");
  const longEdge = Math.max(width, height);
  if (longEdge >= 3840) return t("compressionDetail.resolution4kUhd");
  if (longEdge >= 2560) return t("compressionDetail.resolutionQhd");
  if (longEdge >= 1920) return t("compressionDetail.resolutionFhd");
  return t("compressionDetail.resolutionHd");
}
