import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowUp, BrushCleaning, Images, Pause, Play, RefreshCw, Settings, SlidersHorizontal, Square, Star } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdBanner } from "@/components/ad-banner";
import { AppLogo } from "@/components/app-logo";
import { CachedImage } from "@/components/cached-image";
import { CompressAllOriginalDialog } from "@/components/compress-all-original-dialog";
import { CompressionFilterDialog } from "@/components/compression-filter-dialog";
import { EmptyState } from "@/components/empty-state";
import { MediaCompressionOverlay } from "@/features/compression/components/media-compression-overlay";
import { useCompressionStore } from "@/features/compression/compression.store";
import { BatchOriginalPolicy } from "@/features/compression/compression.types";
import { createCompressionJobInput } from "@/features/compression/compression.utils";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MediaTypeFilter, PhotoAsset } from "@/models/photo";
import { CompressionService } from "@/services/compression-service";
import { PermissionService } from "@/services/permission-service";
import { useAppStore } from "@/store/app-store";
import { IndexedMediaAsset, MediaIndexStatus, useIndexedMediaAssets, useMediaIndexStore } from "@/store/media-index-store";
import { monthLabel } from "@/utils/date";
import { formatBytes } from "@/utils/format";
import { filterPhotosByMediaType, groupPhotosByMonth } from "@/utils/months";

type Filter = { monthKey: string; mediaType: MediaTypeFilter };

// Render the compress grid in pages so a large compressible library never hands
// thousands of cards to the FlatList at once; the next page loads on scroll.
const PAGE_SIZE = 60;

export function HistoryScreen() {
  const theme = useAppTheme();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>({ monthKey: "all", mediaType: "all" });
  const [filterVisible, setFilterVisible] = useState(false);
  const [originalPromptVisible, setOriginalPromptVisible] = useState(false);
  const [batching, setBatching] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlatList<IndexedMediaAsset>>(null);
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const requestPhotoPermission = useAppStore((state) => state.requestPhotoPermission);
  const permission = useAppStore((state) => state.permission);
  const loadingPhotos = useAppStore((state) => state.loadingPhotos);
  const requestingPermission = useAppStore((state) => state.requestingPermission);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const error = useAppStore((state) => state.error);
  const compressedMedia = useAppStore((state) => state.compressedMedia);
  const photos = useIndexedMediaAssets();
  const mediaIndexSummary = useMediaIndexStore((state) => state.summary);
  const mediaIndexStatus = useMediaIndexStore((state) => state.status);
  const lastFullScanCompletedAt = useMediaIndexStore((state) => state.lastFullScanCompletedAt);
  const startFullScan = useMediaIndexStore((state) => state.startFullScan);
  const completedCompressionMediaIds = useCompressionStore((state) => state.completedMediaIds);
  const activeJobId = useCompressionStore((state) => state.activeJobId);
  const queuedJobCount = useCompressionStore((state) => state.queue.length);
  const latestCompressionError = useCompressionStore((state) => state.lastErrorMessage);
  const enqueueCompressionBatch = useCompressionStore((state) => state.enqueueCompressionBatch);
  const compressionPaused = useCompressionStore((state) => state.paused);
  const pauseCompression = useCompressionStore((state) => state.pauseCompression);
  const resumeCompression = useCompressionStore((state) => state.resumeCompression);
  const stopCompression = useCompressionStore((state) => state.stopCompression);
  const { canUseFeature } = useFeatureAccess();
  // "Compress All" (batch) is a Pro feature; Free users see an upgrade button.
  const canBatch = canUseFeature("compressAll");

  useEffect(() => {
    if (hasHydrated) {
      void loadInitialData();
    }
  }, [hasHydrated, loadInitialData]);

  const needsMediaPermission = permission.status !== "granted" && permission.status !== "limited";
  const doneSourceIds = useMemo(() => {
    const ids = new Set(compressedMedia.map((item) => item.sourceId));
    Object.keys(completedCompressionMediaIds).forEach((id) => ids.add(id));
    return ids;
  }, [completedCompressionMediaIds, compressedMedia]);

  // Everything compressible that isn't already done — the unfiltered pool that
  // both the grid and the filter dialog draw from.
  const compressiblePool = useMemo(
    () => photos.filter((photo) => photo.compressible && !doneSourceIds.has(photo.id)),
    [doneSourceIds, photos]
  );

  // The grid shows the pool narrowed by the dialog's month + media-type filter.
  const filteredMedia = useMemo(
    () =>
      compressiblePool.filter(
        (item) =>
          (filter.mediaType === "all" || item.mediaType === filter.mediaType) &&
          (filter.monthKey === "all" || item.monthKey === filter.monthKey)
      ),
    [compressiblePool, filter]
  );

  // Month list for the dialog, scoped to the selected media type.
  const months = useMemo(
    () => groupPhotosByMonth(filterPhotosByMediaType(compressiblePool, filter.mediaType), t("cleanup.allMonths")),
    // i18n.language keeps the localized month titles + "All months" fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compressiblePool, filter.mediaType, i18n.language]
  );

  // Indexed assets already carry their estimates — never re-run estimate here.
  const totalHeavyBytes = useMemo(() => filteredMedia.reduce((sum, item) => sum + item.estimatedOriginalBytes, 0), [filteredMedia]);

  const cardGap = 8;
  const horizontalPadding = width < 380 ? 14 : 16;
  const cardWidth = Math.floor((width - horizontalPadding * 2 - cardGap * 2) / 3);

  const keyExtractor = useCallback((item: IndexedMediaAsset) => item.id, []);
  const renderItem = useCallback(({ item }: { item: IndexedMediaAsset }) => <MediaCard asset={item} width={cardWidth} />, [cardWidth]);

  // Pagination: only hand the FlatList the first `visibleCount` items; grow a page
  // at a time as the user scrolls near the end. Compress All / totals keep using
  // the full filteredMedia, so pagination only affects what's rendered.
  const pagedMedia = useMemo(() => filteredMedia.slice(0, visibleCount), [filteredMedia, visibleCount]);
  const hasMore = visibleCount < filteredMedia.length;
  const loadMore = useCallback(() => {
    setVisibleCount((current) => (current >= filteredMedia.length ? current : Math.min(current + PAGE_SIZE, filteredMedia.length)));
  }, [filteredMedia.length]);
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const shouldShow = event.nativeEvent.contentOffset.y > 600;
    setShowScrollTop((prev) => (prev === shouldShow ? prev : shouldShow));
  }, []);
  const scrollToTop = useCallback(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), []);

  // Reset pagination + jump to the top whenever the filter changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filter]);

  const summaryText =
    filteredMedia.length > 0 ? t("cleanup.heavySummary", { size: formatBytes(totalHeavyBytes) }) : t("cleanup.emptySummary");
  const isCompressing = Boolean(activeJobId || queuedJobCount > 0);
  const doneSourceKey = useMemo(() => [...doneSourceIds].sort().join("|"), [doneSourceIds]);
  const scanIsComplete = Boolean(lastFullScanCompletedAt);
  const indexIsScanning = mediaIndexStatus === "scanning";
  const backgroundSavings = getBackgroundSavings(mediaIndexStatus, mediaIndexSummary.estimatedSavedBytes);
  const hasSavedEstimate = Boolean(lastFullScanCompletedAt);
  const isEstimating = mediaIndexStatus === "scanning";
  const compressButtonDisabled = batching || isEstimating || !scanIsComplete || filteredMedia.length === 0;

  const mediaTypeLabel =
    filter.mediaType === "photo" ? t("months.photos") : filter.mediaType === "video" ? t("months.videos") : t("cleanup.bothMedia");
  const filterSummary = `${filter.monthKey === "all" ? t("cleanup.allMonths") : monthLabel(filter.monthKey)} · ${mediaTypeLabel}`;

  const handleEstimateNow = () => {
    if (isEstimating) return;
    void startFullScan({
      force: true,
      ignoredSourceIds: doneSourceKey ? doneSourceKey.split("|") : []
    });
  };

  // Starts the batch (everything in the filtered scope, videos included) with the
  // given original-file policy. "delete" removes each original after it is
  // compressed and saved; "keep" keeps them all; "ask" defers to the post-batch
  // decision sheet (the iOS path).
  const runCompressAll = (originalPolicy: BatchOriginalPolicy) => {
    setOriginalPromptVisible(false);
    const jobs = filteredMedia
      .map((asset) => createCompressionJobInput(asset, "medium"))
      .filter((job): job is NonNullable<typeof job> => Boolean(job));
    if (jobs.length === 0) return;
    setBatching(true);
    void enqueueCompressionBatch({ jobs, quality: "medium", originalPolicy }).finally(() => setBatching(false));
  };

  // Only Pro users reach this handler (Free users get the upgrade button).
  // ANDROID-ONLY workflow: ask up front what to do with the originals BEFORE the
  // batch runs. iOS keeps the legacy post-batch decision sheet (its compress
  // workflow is owned by another agent), so it enqueues directly with "ask".
  const handleCompressAll = () => {
    if (compressButtonDisabled) return;
    if (Platform.OS !== "android") {
      runCompressAll("ask");
      return;
    }
    setOriginalPromptVisible(true);
  };

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <CompactCleanupHeader />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text selectable style={{ color: theme.muted, fontSize: 16, fontWeight: "800", textAlign: "center" }}>
            {t("common.loadingMediaLibrary")}
          </Text>
        </View>
      </View>
    );
  }

  if (needsMediaPermission) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <CompactCleanupHeader />
        <EmptyState
          icon={BrushCleaning}
          title={t("permissions.mediaTitle")}
          message={error ?? t("permissions.cleanupMessage")}
          actionLabel={requestingPermission ? t("common.requesting") : t("common.allowAccess")}
          onAction={requestPhotoPermission}
        />
        <View style={{ paddingHorizontal: 28 }}>
          <Pressable onPress={PermissionService.openSettings} style={{ alignItems: "center", padding: 16 }}>
            <Text style={{ color: theme.accent, fontWeight: "800", fontSize: 16 }}>{t("common.openSettings")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        ref={listRef}
        data={pagedMedia}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={3}
        columnWrapperStyle={{ gap: cardGap, paddingHorizontal: horizontalPadding, marginBottom: cardGap }}
        windowSize={5}
        maxToRenderPerBatch={6}
        initialNumToRender={9}
        updateCellsBatchingPeriod={40}
        removeClippedSubviews
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={hasMore ? <ActivityIndicator color={theme.accent} style={{ paddingVertical: 16 }} /> : null}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            <CompactCleanupHeader />
            <View style={{ paddingHorizontal: horizontalPadding, paddingTop: 12, paddingBottom: 14, gap: 10 }}>
              <View style={{ gap: 5 }}>
                <Text selectable style={{ color: theme.text, fontSize: 24, lineHeight: 29, fontWeight: "900" }}>
                  {t("cleanup.readyToCompress")}
                </Text>
                <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
                  {summaryText}
                </Text>
              </View>
              <SavingsEstimatePill
                savings={backgroundSavings}
                hasEstimate={hasSavedEstimate}
                isEstimating={isEstimating}
                onEstimateNow={handleEstimateNow}
              />
              {/* Filter button — opens the month + media-type dialog. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("cleanup.filter")}: ${filterSummary}`}
                onPress={() => setFilterVisible(true)}
                style={{
                  minHeight: 46,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  backgroundColor: theme.surfaceSoft,
                  borderWidth: 1,
                  borderColor: theme.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <SlidersHorizontal size={18} color={theme.accent} />
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: "900" }}>{t("cleanup.filter")}</Text>
                <Text numberOfLines={1} style={{ flex: 1, textAlign: "right", color: theme.muted, fontSize: 13, fontWeight: "800" }}>
                  {filterSummary}
                </Text>
              </Pressable>
              {isCompressing ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={compressionPaused ? t("cleanup.resumeCompression") : t("cleanup.pauseCompression")}
                    onPress={compressionPaused ? resumeCompression : pauseCompression}
                    style={{ flex: 1, minHeight: 46, borderRadius: 10, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
                  >
                    {compressionPaused ? <Play size={19} color="#fff" fill="#fff" /> : <Pause size={19} color="#fff" fill="#fff" />}
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>
                      {compressionPaused ? t("cleanup.resumeCompression") : t("cleanup.pauseCompression")}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("cleanup.stopCompression")}
                    onPress={() => void stopCompression()}
                    style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: theme.red, alignItems: "center", justifyContent: "center" }}
                  >
                    <Square size={18} color="#fff" fill="#fff" />
                  </Pressable>
                </View>
              ) : filteredMedia.length > 0 ? (
                canBatch ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("cleanup.compressAllA11y", { size: formatBytes(totalHeavyBytes) })}
                    disabled={compressButtonDisabled}
                    onPress={handleCompressAll}
                    style={{
                      minHeight: 46,
                      borderRadius: 10,
                      backgroundColor: theme.accent,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 8,
                      opacity: compressButtonDisabled ? 0.72 : 1
                    }}
                  >
                    {batching ? <ActivityIndicator color="#fff" /> : <BrushCleaning size={20} color="#fff" />}
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>
                      {batching
                        ? t("common.queueing")
                        : isEstimating
                          ? t("common.findingMedia")
                          : !scanIsComplete
                            ? t("common.estimateFirst")
                          : isCompressing
                            ? t("common.queueAll", { size: formatBytes(totalHeavyBytes) })
                            : t("common.compressAll", { size: formatBytes(totalHeavyBytes) })}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("cleanup.upgradeToPro")}
                    onPress={() => router.push("/premium")}
                    style={{
                      minHeight: 46,
                      borderRadius: 10,
                      backgroundColor: theme.accent,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 8
                    }}
                  >
                    <Star size={19} color="#fff" fill="#fff" />
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{t("cleanup.upgradeToPro")}</Text>
                  </Pressable>
                )
              ) : null}
              {latestCompressionError ? (
                <Text selectable style={{ color: theme.red, fontSize: 15, fontWeight: "700" }}>
                  {latestCompressionError}
                </Text>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          loadingPhotos || indexIsScanning ? (
            <MediaLoadingIndicator />
          ) : (
            <EmptyState
              icon={Images}
              title={t("cleanup.noHeavyTitle")}
              message={t("cleanup.noHeavyMessage")}
              actionLabel={t("common.refresh")}
              onAction={loadInitialData}
            />
          )
        }
      />
      {/* Banner flush against the bottom navigation (no padding); self-hides for Pro. */}
      <AdBanner />
      {/* Scroll-to-top FAB — appears once the user scrolls down. */}
      {showScrollTop ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("cleanup.scrollToTop")}
          onPress={scrollToTop}
          style={{ position: "absolute", right: 18, bottom: 76, width: 48, height: 48, borderRadius: 24, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(15,23,42,0.35)" }}
        >
          <ArrowUp size={24} color="#fff" />
        </Pressable>
      ) : null}
      <CompressionFilterDialog
        visible={filterVisible}
        mediaType={filter.mediaType}
        monthKey={filter.monthKey}
        months={months}
        onSelectMediaType={(mediaType) => setFilter({ mediaType, monthKey: "all" })}
        onSelectMonth={(monthKey) => setFilter((prev) => ({ ...prev, monthKey }))}
        onClose={() => setFilterVisible(false)}
      />
      {Platform.OS === "android" ? (
        <CompressAllOriginalDialog
          visible={originalPromptVisible}
          onCancel={() => setOriginalPromptVisible(false)}
          onDelete={() => runCompressAll("delete")}
          onKeep={() => runCompressAll("keep")}
        />
      ) : null}
    </View>
  );
}

function MediaLoadingIndicator({ compact = false }: { compact?: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={{ minHeight: compact ? 72 : 220, alignItems: "center", justifyContent: "center", paddingVertical: compact ? 18 : 32 }}>
      <ActivityIndicator color={theme.accent} size={compact ? "small" : "large"} />
    </View>
  );
}

type BackgroundSavings = {
  labelKey: string;
  valueBytes: number;
  status: MediaIndexStatus;
};

function SavingsEstimatePill({
  savings,
  hasEstimate,
  isEstimating,
  onEstimateNow
}: {
  savings: BackgroundSavings;
  hasEstimate: boolean;
  isEstimating: boolean;
  onEstimateNow?: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const label = t(savings.labelKey);
  const text =
    isEstimating && savings.valueBytes <= 0
      ? `${label}: ${t("cleanup.estimating")}`
      : isEstimating
        ? `${label}: ${t("cleanup.found", { size: formatBytes(savings.valueBytes) })}`
        : !hasEstimate
          ? `${label}: ${t("cleanup.notCalculated")}`
        : `${label}: ${formatBytes(savings.valueBytes)}`;

  return (
    <View style={{ alignSelf: "stretch", minHeight: 36, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border, flexDirection: "row", alignItems: "center", gap: 8 }}>
      {isEstimating ? <ActivityIndicator color={theme.accent} size="small" /> : null}
      <Text selectable numberOfLines={1} style={{ color: theme.text, fontSize: 12, fontWeight: "900", flex: 1 }}>
        {text}
      </Text>
      {onEstimateNow ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasEstimate ? t("cleanup.estimateAgainA11y") : t("cleanup.estimateNowA11y")}
          disabled={isEstimating}
          onPress={onEstimateNow}
          style={{
            minHeight: 28,
            borderRadius: 7,
            paddingHorizontal: 9,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 5,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            opacity: isEstimating ? 0.65 : 1
          }}
        >
          <RefreshCw size={13} color={theme.accent} />
          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "900" }}>
            {isEstimating ? t("cleanup.estimatingButton") : hasEstimate ? t("cleanup.estimateAgain") : t("cleanup.estimateNow")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function getBackgroundSavings(status: MediaIndexStatus, estimatedSavedBytes: number): BackgroundSavings {
  return {
    labelKey: "cleanup.estimatedSavings",
    valueBytes: estimatedSavedBytes,
    status
  };
}

function CompactCleanupHeader() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 12 }}>
      {/* Brand lockup (logo + wordmark) left-aligned; settings on the right. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 1 }}>
          <AppLogo size={28} color={theme.accent} />
          <Text selectable numberOfLines={1} style={{ color: theme.accent, fontSize: 24, fontWeight: "900", flexShrink: 1 }}>
            {t("common.appName")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.openSettings")}
          onPress={() => router.push("/settings")}
          style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}
        >
          <Settings size={27} color={theme.text} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

const MediaCard = memo(function MediaCard({ asset, width }: { asset: IndexedMediaAsset; width: number }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const result = useAppStore((state) => state.compressedMedia.find((item) => item.sourceId === asset.id));
  const isVideo = asset.mediaType === "video";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("cleanup.openCompressionDetail", { name: asset.filename ?? t("common.media") })}
      onPress={() => router.push(`/compression-detail?id=${encodeURIComponent(asset.id)}&origin=${encodeURIComponent("/(tabs)/history")}` as never)}
      style={{
        width,
        aspectRatio: 0.92,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: theme.surfaceStrong,
        borderWidth: 1,
        borderColor: theme.border
      }}
    >
      <MediaImage asset={asset} />
      <LinearGradient
        colors={["rgba(5,7,13,0)", "rgba(5,7,13,0.68)", "rgba(5,7,13,0.92)"]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 66 }}
      />
      {isVideo ? (
        <View style={{ position: "absolute", left: 7, bottom: 36, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.34)", alignItems: "center", justifyContent: "center" }}>
          <Play size={12} color="#fff" fill="#fff" />
        </View>
      ) : null}
      <View style={{ position: "absolute", left: 8, right: 7, bottom: 8 }}>
        <Text selectable numberOfLines={1} style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
          {asset.filename ?? (isVideo ? t("common.video") : t("common.photo"))}
        </Text>
        <Text selectable numberOfLines={1} style={{ color: "rgba(255,255,255,0.88)", fontSize: 10, fontWeight: "700" }}>
          {formatBytes(asset.estimatedOriginalBytes)} {"->"} {formatBytes(result?.compressedBytes ?? asset.estimatedCompressedBytes)}
        </Text>
      </View>
      <MediaCompressionOverlay mediaId={asset.id} />
    </Pressable>
  );
});

function MediaImage({ asset }: { asset: PhotoAsset }) {
  const theme = useAppTheme();
  const [uri, setUri] = useState(asset.uri);

  useEffect(() => {
    let mounted = true;
    setUri(asset.uri);
    if (asset.mediaType === "video") {
      CompressionService.createThumbnail(asset)
        .then((thumbnailUri) => {
          if (mounted) setUri(thumbnailUri);
        })
        .catch(() => undefined);
    }
    return () => {
      mounted = false;
    };
    // Key on the fields that matter, not the asset object — index refreshes can
    // produce a fresh object for an unchanged asset. modificationTime makes an
    // edited video re-extract its thumbnail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id, asset.uri, asset.mediaType, asset.modificationTime]);

  return <CachedImage uri={uri} contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />;
}
