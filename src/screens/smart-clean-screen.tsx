import { router } from "expo-router";
import { RefreshCw, Search, Sparkles, Wand2, X } from "lucide-react-native";
import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AdBanner } from "@/components/ad-banner";
import { AppHeader } from "@/components/app-header";
import { SmartCleanCard } from "@/features/smart-clean/components/smart-clean-card";
import { useSmartCleanReviewStore } from "@/features/smart-clean/smart-clean-review-store";
import { CATEGORY_ICON, SMART_CLEAN_DETECTORS } from "@/features/smart-clean/smart-clean.service";
import { useSmartCleanStore } from "@/features/smart-clean/smart-clean-store";
import { useSmartCleanFeatureCache } from "@/features/smart-clean/feature-cache-store";
import { SmartCleanDetectorKey, SmartCleanGroup, SmartCleanResult } from "@/features/smart-clean/smart-clean.types";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PermissionService } from "@/services/permission-service";
import { useAppStore } from "@/store/app-store";
import { recordCleanupEvent } from "@/store/cleanup-events-store";
import { selectIndexedMediaAssets, useMediaIndexStore } from "@/store/media-index-store";
import { usePaywallStore } from "@/store/paywall-store";
import { formatBytes } from "@/utils/format";

// Pre-scan / not-yet-computed default. "idle" (not "not_available") so cards
// read as "not scanned yet" rather than "coming soon" — the detectors are
// implemented; the user just hasn't run a scan.
function placeholderResult(key: SmartCleanDetectorKey): SmartCleanResult {
  return { key, status: "idle", groups: [], itemCount: undefined, estimatedReclaimableBytes: undefined };
}

/**
 * Smart Clean (Pro). Runs the real detectors via the runner store, shows scan
 * progress, and routes confirmed deletions through the single audited
 * `permanentlyDeleteMarked` path. Subscribes to the runner with primitive /
 * stable-ref selectors only (never a fresh-object selector).
 */
export function SmartCleanScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { canUseFeature } = useFeatureAccess();
  const openPaywall = usePaywallStore((state) => state.open);
  const permissionStatus = useAppStore((state) => state.permission.status);

  const phase = useSmartCleanStore((state) => state.phase);
  const progress = useSmartCleanStore((state) => state.progress);
  const stage = useSmartCleanStore((state) => state.stage);
  const analyzed = useSmartCleanStore((state) => state.analyzed);
  const analyzeTotal = useSmartCleanStore((state) => state.analyzeTotal);
  const activeIndex = useSmartCleanStore((state) => state.activeIndex);
  const activeKey = useSmartCleanStore((state) => state.activeDetectorKey);
  const resultsByKey = useSmartCleanStore((state) => state.resultsByKey);
  const runScan = useSmartCleanStore((state) => state.runScan);
  const cancel = useSmartCleanStore((state) => state.cancel);
  const lastRunAt = useSmartCleanStore((state) => state.lastRunAt);
  const openReview = useSmartCleanReviewStore((state) => state.open);

  const viewedRef = useRef<Set<string>>(new Set());

  const limitedAccess = permissionStatus === "limited";
  const scanning = phase === "scanning";
  const total = SMART_CLEAN_DETECTORS.length;
  // Counter tracks the discrete detector currently running — same value the
  // notification shows (no off-by-one). The bar uses the continuous `progress`.
  const current = Math.min(total, Math.max(1, activeIndex || 1));
  // During the concurrent photo pre-pass ("analyzing") show the per-photo count;
  // otherwise the detector "X of Y" counter.
  const scanLabel =
    stage === "analyzing" && analyzeTotal > 0
      ? t("smartClean.analyzingPhotos", { current: analyzed, total: analyzeTotal })
      : t("smartClean.scanningProgress", { current, total });

  // NOTE: we intentionally do NOT cancel the scan on unmount — like compression,
  // the scan keeps running when you leave the screen, surfaced by its own ongoing
  // notification (with a Stop button). Returning to the screen re-attaches to the
  // still-running runner. Store updates after unmount are safe (Zustand, not
  // setState on an unmounted component).

  // On mount, expand any persisted results for display and auto-resume an
  // interrupted scan (no-op if already running / nothing to resume).
  useEffect(() => {
    useSmartCleanStore.getState().resumeIfInterrupted();
  }, []);

  // Emit smartCleanSuggestionViewed once per ready card (never for
  // not_available/empty/locked), keyed off the stable resultsByKey ref.
  useEffect(() => {
    for (const detector of SMART_CLEAN_DETECTORS) {
      const result = resultsByKey[detector.key];
      if (result?.status === "ready" && !viewedRef.current.has(detector.key)) {
        viewedRef.current.add(detector.key);
        recordCleanupEvent({ type: "smartCleanSuggestionViewed", detectorKey: detector.key });
      }
    }
  }, [resultsByKey]);

  const handleScan = async () => {
    // Runs under limited ("selected photos") access too — the scan operates on
    // whatever the media index holds, which is exactly the accessible set.
    if (!useMediaIndexStore.getState().lastFullScanCompletedAt) {
      await useMediaIndexStore.getState().startFullScan();
    }
    // Continue a cut-off scan from its checkpoint; otherwise start fresh.
    void runScan({ resume: phase === "interrupted" });
  };

  const handlePrimary = (key: SmartCleanDetectorKey) => {
    const detector = SMART_CLEAN_DETECTORS.find((item) => item.key === key);
    const result = resultsByKey[key];
    if (detector && !canUseFeature(detector.featureKey)) {
      openPaywall(detector.featureKey);
      return;
    }
    if (result?.status === "needs_permission") {
      void PermissionService.openSettings();
      return;
    }
    if (result?.status === "ready") {
      startReview(key, t(`smartClean.cards.${key}.title`), result.groups);
    }
  };

  // One-Tap Recommendations: aggregate all ready, entitled detectors. Derived
  // via useMemo over the stable resultsByKey ref (no store-side aggregate).
  const recommendation = useMemo(() => {
    // An asset can match several keeper-less detectors at once (e.g. a screenshot
    // that is also a large photo), so dedupe candidates by mediaId — summing
    // per-detector itemCount/bytes would over-report. An asset kept in ANY group
    // is globally protected and never a candidate.
    const keeperIds = new Set<string>();
    const candidateBytes = new Map<string, number>();
    const groups: SmartCleanGroup[] = [];
    for (const detector of SMART_CLEAN_DETECTORS) {
      const result = resultsByKey[detector.key];
      if (!(canUseFeature(detector.featureKey) && result?.status === "ready" && (result.itemCount ?? 0) > 0)) continue;
      groups.push(...result.groups);
      for (const group of result.groups) {
        if (group.keepMediaId) keeperIds.add(group.keepMediaId);
        for (const item of group.items) {
          if (item.mediaId !== group.keepMediaId) candidateBytes.set(item.mediaId, item.sizeBytes ?? 0);
        }
      }
    }
    for (const id of keeperIds) candidateBytes.delete(id);
    let bytes = 0;
    for (const value of candidateBytes.values()) bytes += value;
    return { count: candidateBytes.size, bytes, groups };
  }, [resultsByKey, canUseFeature]);

  const handleConfirmDelete = async (detectorKey: string, ids: string[], bytes: number) => {
    if (ids.length === 0) return;
    const reviewStore = useSmartCleanReviewStore.getState();
    // Block only when we can't read media at all. Limited ("selected photos")
    // access CAN delete the accessible assets on both iOS and Android, so it's
    // allowed. Read fresh — this runs from the root-mounted sheet's callback,
    // not the screen's render closure.
    const status = useAppStore.getState().permission.status;
    if (status !== "granted" && status !== "limited") {
      reviewStore.close();
      void PermissionService.openSettings();
      return;
    }
    reviewStore.setBusy(true);
    try {
      // Smart Clean owns its ledger event (smartCleanActionConfirmed carries the
      // real count/bytes); suppress permanentlyDeleteMarked's itemDeleted, which
      // would otherwise log a zeroed entry (Smart Clean ids aren't in the marked
      // queue it accounts from).
      await useAppStore.getState().permanentlyDeleteMarked(ids, { emitDeletionEvent: false });
      recordCleanupEvent({ type: "smartCleanActionConfirmed", count: ids.length, bytes, detectorKey });
      const validIds = new Set(selectIndexedMediaAssets(useMediaIndexStore.getState()).map((asset) => asset.id));
      useSmartCleanFeatureCache.getState().pruneMissing(validIds);
      reviewStore.close();
      // Re-scan so deleted items drop out of every group. cancel() first so this
      // run starts from the post-deletion snapshot rather than JOINing a stale
      // in-flight scan (which captured the pre-deletion asset set).
      cancel();
      void runScan({ resume: false });
    } catch {
      // permanentlyDeleteMarked surfaces its own error; keep the sheet open.
    } finally {
      reviewStore.setBusy(false);
    }
  };

  // Open the root-mounted review sheet for a detector/recommendation target.
  const startReview = (detectorKey: string, title: string, groups: SmartCleanGroup[]) => {
    // Populate the review store, then push the full-screen review (it reads from
    // the store). The screen pops itself when the store's close() fires.
    openReview({ title, groups, onConfirm: (ids, bytes) => void handleConfirmDelete(detectorKey, ids, bytes) });
    router.push("/smart-clean-review");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <AppHeader />
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <View style={{ gap: 4, paddingTop: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Wand2 size={24} color={theme.accent} />
            <Text selectable style={{ color: theme.text, fontSize: 24, fontWeight: "900" }}>
              {t("smartClean.title")}
            </Text>
          </View>
          <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 21 }}>
            {t("smartClean.subtitle")}
          </Text>
        </View>

        {limitedAccess ? (
          <View style={{ backgroundColor: theme.surfaceSoft, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 16 }}>
            <Text selectable style={{ color: theme.muted, fontSize: 13, lineHeight: 19 }}>
              {t("smartClean.limitedNotice")}
            </Text>
          </View>
        ) : null}

        {scanning ? (
          <View style={{ backgroundColor: theme.surfaceSoft, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={theme.accent} />
              <Text selectable style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: "800" }}>
                {scanLabel}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("smartClean.stop")} onPress={cancel} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, minHeight: 34, borderRadius: 9, borderWidth: 1, borderColor: theme.border }}>
                <X size={14} color={theme.muted} />
                <Text style={{ color: theme.muted, fontSize: 13, fontWeight: "900" }}>{t("smartClean.stop")}</Text>
              </Pressable>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.surfaceStrong, overflow: "hidden" }}>
              <View style={{ width: `${Math.round(progress * 100)}%`, height: 6, backgroundColor: theme.accent }} />
            </View>
            <Text selectable style={{ color: theme.muted, fontSize: 12, lineHeight: 16 }}>
              {t("smartClean.scanKeepUsing")}
            </Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={lastRunAt ? t("smartClean.rescan") : t("smartClean.scanNow")}
            onPress={handleScan}
            style={{ minHeight: 50, borderRadius: 12, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
          >
            {lastRunAt ? <RefreshCw size={18} color="#fff" /> : <Search size={18} color="#fff" />}
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{lastRunAt ? t("smartClean.rescan") : t("smartClean.scanNow")}</Text>
          </Pressable>
        )}

        {/* One-Tap Recommendations */}
        <View style={{ backgroundColor: theme.surfaceSoft, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 16, flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Sparkles size={22} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: theme.text, fontSize: 15, fontWeight: "900" }}>
              {t("smartClean.recommendationsTitle")}
            </Text>
            <Text selectable style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>
              {recommendation.count > 0
                ? t("smartClean.recommendationsSummary", { size: formatBytes(recommendation.bytes), count: recommendation.count })
                : t("smartClean.recommendationsEmpty")}
            </Text>
          </View>
          {recommendation.count > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("smartClean.reviewAll")}
              onPress={() => startReview("recommendations", t("smartClean.recommendationsTitle"), recommendation.groups)}
              style={{ paddingHorizontal: 12, minHeight: 38, borderRadius: 10, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>{t("smartClean.reviewAll")}</Text>
            </Pressable>
          ) : null}
        </View>

        {SMART_CLEAN_DETECTORS.map((detector) => {
          const result = resultsByKey[detector.key] ?? placeholderResult(detector.key);
          return (
            <SmartCleanCard
              key={detector.key}
              icon={CATEGORY_ICON[detector.key]}
              title={t(`smartClean.cards.${detector.key}.title`)}
              explanation={t(`smartClean.cards.${detector.key}.desc`)}
              status={result.status}
              locked={!canUseFeature(detector.featureKey)}
              scanning={activeKey === detector.key}
              itemCount={result.itemCount}
              estimatedReclaimableBytes={result.estimatedReclaimableBytes}
              onPrimary={() => handlePrimary(detector.key)}
            />
          );
        })}

          <AdBanner />
        </View>
      </ScrollView>
    </View>
  );
}
