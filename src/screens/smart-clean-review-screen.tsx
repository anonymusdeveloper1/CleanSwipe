import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { MediaThumbnail } from "@/components/media-thumbnail";
import { Thumbnail } from "@/components/thumbnail";
import { isVideoUri } from "@/components/video-thumb-placeholder";
import { useSmartCleanReviewStore } from "@/features/smart-clean/smart-clean-review-store";
import { SmartCleanItem } from "@/features/smart-clean/smart-clean.types";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatBytes } from "@/utils/format";

type AppTheme = ReturnType<typeof useAppTheme>;

// Render the review grid in pages so a huge target (e.g. "Review all") never
// hands thousands of cells to the list at once; the next page loads on scroll.
const PAGE_SIZE = 60;

/**
 * Per-item selection + delete for a Smart Clean category. A FULL SCREEN (not a
 * bottom sheet): FlashList needs a flex-bounded parent to recycle/measure, which
 * an animated content-sized sheet doesn't provide (it collapsed to 0 height and
 * rendered blank). As a screen it uses the SAME smooth FlashList setup as the
 * Compress grid — recycling, no getItemLayout, no removeClippedSubviews — so it
 * stays ~60fps for thousands of items with no row-snapping.
 *
 * Driven by useSmartCleanReviewStore (set by Smart Clean's "Review" actions,
 * which then router.push here). Dismissal is centralized through the store's
 * close() → the `visible` effect pops the screen, covering cancel, hardware
 * back, and the post-delete close from the screen's onConfirm handler.
 *
 * Hard keeper protection in THREE places: (1) initial selection excludes
 * keepers, (2) the toggle rejects keepers, (3) confirm filters keepers out of
 * the id list. Keepers render a non-toggleable "KEEP" badge.
 */
export function SmartCleanReviewScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const visible = useSmartCleanReviewStore((state) => state.visible);
  const title = useSmartCleanReviewStore((state) => state.title);
  const groups = useSmartCleanReviewStore((state) => state.groups);
  const busy = useSmartCleanReviewStore((state) => state.busy);
  const close = useSmartCleanReviewStore((state) => state.close);
  const onConfirm = useSmartCleanReviewStore((state) => state.onConfirm);
  const openPreview = useSmartCleanReviewStore((state) => state.openPreview);

  const [confirmVisible, setConfirmVisible] = useState(false);

  // Centralized dismissal: any close() (cancel button, post-delete) pops the
  // screen. Reset the store on unmount too, so an OS back / swipe that bypasses
  // our buttons doesn't leave stale groups + onConfirm behind.
  useEffect(() => {
    if (!visible) router.back();
  }, [visible]);
  useEffect(
    () => () => {
      if (useSmartCleanReviewStore.getState().visible) useSmartCleanReviewStore.getState().close();
    },
    []
  );

  const keeperIds = useMemo(
    () => new Set(groups.map((group) => group.keepMediaId).filter((id): id is string => Boolean(id))),
    [groups]
  );
  // The One-Tap Recommendations target concatenates groups from several
  // detectors, so the same mediaId can appear more than once. Dedupe by mediaId
  // — first occurrence wins — so the grid has unique keys and bytes aren't
  // double-counted.
  const items = useMemo(() => {
    const byId = new Map<string, SmartCleanItem>();
    for (const group of groups) {
      for (const item of group.items) {
        if (!byId.has(item.mediaId)) byId.set(item.mediaId, item);
      }
    }
    return [...byId.values()];
  }, [groups]);
  const candidateIds = useMemo(() => items.filter((item) => !keeperIds.has(item.mediaId)).map((item) => item.mediaId), [items, keeperIds]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    if (visible) {
      setSelected(new Set(candidateIds));
      setVisibleCount(PAGE_SIZE);
    }
  }, [visible, candidateIds]);

  const toggle = useCallback(
    (mediaId: string) => {
      if (keeperIds.has(mediaId)) return; // never let the keeper be selected
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(mediaId)) next.delete(mediaId);
        else next.add(mediaId);
        return next;
      });
    },
    [keeperIds]
  );

  const selectedBytes = useMemo(
    () => items.reduce((sum, item) => (selected.has(item.mediaId) ? sum + (item.sizeBytes ?? 0) : sum), 0),
    [items, selected]
  );
  const count = selected.size;

  // Pagination: only hand the list the first `visibleCount` items; grow a page on
  // scroll-end. Selection still spans ALL candidates, so confirming deletes
  // unrendered items too.
  const hasMore = visibleCount < items.length;
  const pagedItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const loadMore = useCallback(() => {
    setVisibleCount((current) => (current >= items.length ? current : Math.min(current + PAGE_SIZE, items.length)));
  }, [items.length]);

  const columns = width < 380 ? 3 : 4;
  const gap = 8;
  const horizontalPadding = 16;
  const cell = Math.floor((width - horizontalPadding * 2 - gap * (columns - 1)) / columns);

  const handleConfirmed = () => {
    setConfirmVisible(false);
    const ids = [...selected].filter((id) => !keeperIds.has(id));
    if (ids.length === 0) return;
    onConfirm?.(ids, selectedBytes);
  };

  const keepLabel = t("smartClean.keepBadge");
  const renderItem = useCallback(
    ({ item }: { item: SmartCleanItem }) => (
      // FlashList gives every column equal width, so a uniform half-gap pad keeps
      // all cells identical; the contentContainer supplies the edge margin.
      <View style={{ flex: 1, padding: gap / 2 }}>
        <ReviewCell
          item={item}
          cellDp={cell}
          theme={theme}
          isKeeper={keeperIds.has(item.mediaId)}
          isSelected={selected.has(item.mediaId)}
          keepLabel={keepLabel}
          onToggle={toggle}
          onPreview={openPreview}
        />
      </View>
    ),
    [cell, theme, keeperIds, selected, keepLabel, toggle, openPreview]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: insets.top + 12, paddingBottom: 8, gap: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={close} style={{ padding: 8 }}>
          <ArrowLeft size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text selectable numberOfLines={1} style={{ color: theme.text, fontSize: 19, fontWeight: "900" }}>
            {title}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>
            {t("smartClean.groupKeepBest")}
          </Text>
        </View>
      </View>

      <FlashList
        data={pagedItems}
        keyExtractor={(item) => item.mediaId}
        renderItem={renderItem}
        numColumns={columns}
        contentContainerStyle={{ paddingHorizontal: horizontalPadding - gap / 2, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={hasMore ? <ActivityIndicator color={theme.accent} style={{ paddingVertical: 14 }} /> : null}
        style={{ flex: 1 }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: insets.bottom + 10,
          backgroundColor: theme.background,
          borderTopWidth: 1,
          borderTopColor: theme.border
        }}
      >
        <Text selectable style={{ flex: 1, color: theme.muted, fontSize: 13, fontWeight: "800" }}>
          {t("smartClean.reclaimSelected", { size: formatBytes(selectedBytes) })}
        </Text>
        {busy ? <ActivityIndicator color={theme.accent} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("smartClean.deleteSelected", { count })}
          disabled={busy || count === 0}
          onPress={() => setConfirmVisible(true)}
          style={{ paddingVertical: 12, paddingHorizontal: 18, backgroundColor: theme.red, borderRadius: 12, opacity: busy || count === 0 ? 0.6 : 1 }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{t("smartClean.deleteSelected", { count })}</Text>
        </Pressable>
      </View>

      <DeleteConfirmationDialog visible={confirmVisible} onCancel={() => setConfirmVisible(false)} onConfirm={handleConfirmed} />
    </View>
  );
}

/**
 * One grid cell. Memoized so a selection toggle only re-renders the toggled cell
 * (and the few mounted by the list window), never the whole grid. Fills its
 * FlashList column (width 100% + square) and decodes at the cell size (cellDp).
 */
const ReviewCell = memo(function ReviewCell({
  item,
  cellDp,
  theme,
  isKeeper,
  isSelected,
  keepLabel,
  onToggle,
  onPreview
}: {
  item: SmartCleanItem;
  cellDp: number;
  theme: AppTheme;
  isKeeper: boolean;
  isSelected: boolean;
  keepLabel: string;
  onToggle: (mediaId: string) => void;
  onPreview: (item: SmartCleanItem) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled: isKeeper }}
      onPress={() => onToggle(item.mediaId)}
      onLongPress={() => onPreview(item)}
      delayLongPress={260}
      style={{ width: "100%", aspectRatio: 1, borderRadius: 10, overflow: "hidden", backgroundColor: theme.surfaceStrong, borderWidth: isKeeper || isSelected ? 2 : 1, borderColor: isKeeper ? theme.green : isSelected ? theme.red : theme.border }}
    >
      {isVideoUri(item.uri) ? (
        <MediaThumbnail uri={item.uri} id={item.mediaId} mediaType="video" cellDp={cellDp} contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
      ) : (
        <Thumbnail sourceUri={item.uri} cacheKey={item.mediaId} cellDp={cellDp} contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
      )}
      {isKeeper ? (
        <View style={{ position: "absolute", left: 4, top: 4, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: theme.green, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3 }}>
          <ShieldCheck size={12} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>{keepLabel}</Text>
        </View>
      ) : (
        <View style={{ position: "absolute", right: 4, top: 4, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: isSelected ? theme.red : "rgba(0,0,0,0.35)", borderWidth: 1, borderColor: "#fff" }}>
          {isSelected ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
        </View>
      )}
    </Pressable>
  );
});
