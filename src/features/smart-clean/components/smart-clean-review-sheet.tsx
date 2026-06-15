import { Check, ShieldCheck } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
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
// hands thousands of cells to the FlatList at once; the next page loads as the
// user scrolls near the end.
const PAGE_SIZE = 60;

/**
 * Preview + per-item selection before deletion. Mounted ONCE in the root layout
 * and driven by useSmartCleanReviewStore, so it renders above the bottom tab bar.
 *
 * The grid is a VIRTUALIZED FlatList — a >5 GB collection (especially the
 * "Review all" aggregate) can hold thousands of items, and mounting that many
 * expo-image views at once previously blew up memory and froze/crashed the app.
 *
 * Hard keeper protection in THREE places: (1) initial selection excludes
 * keepers, (2) the toggle rejects keepers, (3) confirm filters keepers out of
 * the id list. Keepers render a non-toggleable "KEEP" badge.
 */
export function SmartCleanReviewSheet() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const visible = useSmartCleanReviewStore((state) => state.visible);
  const title = useSmartCleanReviewStore((state) => state.title);
  const groups = useSmartCleanReviewStore((state) => state.groups);
  const busy = useSmartCleanReviewStore((state) => state.busy);
  const close = useSmartCleanReviewStore((state) => state.close);
  const onConfirm = useSmartCleanReviewStore((state) => state.onConfirm);
  const openPreview = useSmartCleanReviewStore((state) => state.openPreview);

  const [confirmVisible, setConfirmVisible] = useState(false);

  const keeperIds = useMemo(
    () => new Set(groups.map((group) => group.keepMediaId).filter((id): id is string => Boolean(id))),
    [groups]
  );
  // The One-Tap Recommendations target concatenates groups from several
  // detectors, so the same mediaId can appear more than once (e.g. a screenshot
  // that is also a large photo). Dedupe by mediaId — first occurrence wins — so
  // the grid has unique React keys and selectedBytes isn't double-counted.
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
    // Re-init the selection + pagination whenever the review target (its candidate set) changes.
  }, [visible, candidateIds]);

  // Android back closes the sheet (in-tree overlay, not an RN Modal).
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [visible, close]);

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

  // Pagination: only hand the FlatList the first `visibleCount` items; grow by a
  // page when the user scrolls near the end. Selection still spans ALL candidates
  // (selected-by-default), so confirming deletes unrendered items too.
  const hasMore = visibleCount < items.length;
  const pagedItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const loadMore = useCallback(() => {
    setVisibleCount((current) => (current >= items.length ? current : Math.min(current + PAGE_SIZE, items.length)));
  }, [items.length]);

  const columns = width < 380 ? 3 : 4;
  const gap = 8;
  const horizontalPadding = 20;
  const cell = Math.floor((Math.min(width, 680) - horizontalPadding * 2 - gap * (columns - 1)) / columns);
  // Bound the list so the FlatList virtualizes instead of laying out every row.
  const listMaxHeight = Math.max(220, Math.round(height * 0.86) - 180);
  // Fixed row height lets the FlatList skip measuring every row (O(1) scroll math).
  const rowHeight = cell + gap;
  const getItemLayout = useCallback(
    (_data: ArrayLike<SmartCleanItem> | null | undefined, index: number) => {
      const row = Math.floor(index / columns);
      return { length: rowHeight, offset: rowHeight * row, index };
    },
    [columns, rowHeight]
  );

  const handleConfirmed = () => {
    setConfirmVisible(false);
    const ids = [...selected].filter((id) => !keeperIds.has(id));
    if (ids.length === 0) return;
    onConfirm?.(ids, selectedBytes);
  };

  const renderItem = useCallback(
    ({ item }: { item: SmartCleanItem }) => (
      <ReviewCell
        item={item}
        cell={cell}
        theme={theme}
        isKeeper={keeperIds.has(item.mediaId)}
        isSelected={selected.has(item.mediaId)}
        keepLabel={t("smartClean.keepBadge")}
        onToggle={toggle}
        onPreview={openPreview}
      />
    ),
    [cell, theme, keeperIds, selected, t, toggle, openPreview]
  );

  if (!visible) return null;
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(5,7,13,0.5)", justifyContent: "flex-end" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={close} style={{ flex: 1 }} />
      <View style={{ maxHeight: "86%", backgroundColor: theme.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 16, paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 16, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "900" }}>
            {title}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>
            {t("smartClean.groupKeepBest")}
          </Text>
        </View>

        <FlatList
          data={pagedItems}
          keyExtractor={(item) => item.mediaId}
          renderItem={renderItem}
          numColumns={columns}
          columnWrapperStyle={{ gap, marginBottom: gap }}
          contentContainerStyle={{ paddingBottom: 4 }}
          style={{ maxHeight: listMaxHeight }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={columns * 4}
          maxToRenderPerBatch={columns * 4}
          windowSize={5}
          getItemLayout={getItemLayout}
          removeClippedSubviews
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={hasMore ? <ActivityIndicator color={theme.accent} style={{ paddingVertical: 14 }} /> : null}
        />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "800" }}>
            {t("smartClean.reclaimSelected", { size: formatBytes(selectedBytes) })}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {busy ? <ActivityIndicator color={theme.accent} /> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={close} style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
              <Text style={{ color: theme.muted, fontSize: 15, fontWeight: "800" }}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("smartClean.deleteSelected", { count })}
              disabled={busy || count === 0}
              onPress={() => setConfirmVisible(true)}
              style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: theme.red, borderRadius: 12, opacity: busy || count === 0 ? 0.6 : 1 }}
            >
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{t("smartClean.deleteSelected", { count })}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <DeleteConfirmationDialog visible={confirmVisible} onCancel={() => setConfirmVisible(false)} onConfirm={handleConfirmed} />
    </View>
  );
}

/**
 * One grid cell. Memoized so a selection toggle only re-renders the toggled cell
 * (and the few mounted by the FlatList window), never the whole grid.
 */
const ReviewCell = memo(function ReviewCell({
  item,
  cell,
  theme,
  isKeeper,
  isSelected,
  keepLabel,
  onToggle,
  onPreview
}: {
  item: SmartCleanItem;
  cell: number;
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
      style={{ width: cell, height: cell, borderRadius: 10, overflow: "hidden", backgroundColor: theme.surfaceStrong, borderWidth: isKeeper || isSelected ? 2 : 1, borderColor: isKeeper ? theme.green : isSelected ? theme.red : theme.border }}
    >
      {isVideoUri(item.uri) ? (
        <MediaThumbnail uri={item.uri} id={item.mediaId} mediaType="video" contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ width: cell, height: cell }} />
      ) : (
        <Thumbnail sourceUri={item.uri} cacheKey={item.mediaId} cellDp={cell} contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ width: cell, height: cell }} />
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
