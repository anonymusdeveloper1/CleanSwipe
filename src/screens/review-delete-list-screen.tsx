import { router } from "expo-router";
import { ArrowLeft, Images, Trash2 } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { EmptyState } from "@/components/empty-state";
import { InterstitialAdService } from "@/features/ads/interstitial.service";
import { PhotoTile, getPhotoTileSize } from "@/components/photo-grid";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MarkedForDeletionItem } from "@/models/photo";
import { useAppStore } from "@/store/app-store";
import { useIndexedMediaAssets } from "@/store/media-index-store";
import { monthLabel } from "@/utils/date";
import { formatBytes, sumBytes } from "@/utils/format";
import { filterMarkedItemsByScope, getMarkedItemMonthKey, getMediaTypeNoun } from "@/utils/months";

// How many marked items to materialize per page. The list virtualizes rows on
// top of this, but capping the data keeps the initial open cheap and grouping
// work bounded even when thousands of items are marked. Grows via onEndReached.
const PAGE_SIZE = 60;
const TILE_COLUMNS = 3;

type ReviewRow =
  | { type: "header"; key: string; label: string; count: number; bytes: number }
  | { type: "tiles"; key: string; items: MarkedForDeletionItem[] };

export function ReviewDeleteListScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const allMarked = useAppStore((state) => state.markedForDeletion);
  const selectedMonthKey = useAppStore((state) => state.selectedMonthKey);
  const selectedMediaType = useAppStore((state) => state.selectedMediaType);
  const photos = useIndexedMediaAssets();
  const restore = useAppStore((state) => state.restoreMarkedPhoto);
  const deleteMarked = useAppStore((state) => state.permanentlyDeleteMarked);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const marked = useMemo(
    () => filterMarkedItemsByScope(allMarked, selectedMonthKey, selectedMediaType, photos),
    [allMarked, photos, selectedMediaType, selectedMonthKey]
  );

  // Sort by month descending (stable, so within-month order is preserved). This
  // makes pagination reveal months top-to-bottom consistently as the user scrolls.
  const sortedMarked = useMemo(
    () => [...marked].sort((a, b) => getMarkedItemMonthKey(b).localeCompare(getMarkedItemMonthKey(a))),
    [marked]
  );

  // Full per-month totals (count + bytes) so a section header stays accurate even
  // while only part of that month is paged in.
  const monthTotals = useMemo(() => {
    const totals = new Map<string, { label: string; count: number; bytes: number }>();
    for (const item of sortedMarked) {
      const key = getMarkedItemMonthKey(item);
      const current = totals.get(key) ?? { label: monthLabel(key), count: 0, bytes: 0 };
      current.count += 1;
      current.bytes += item.sizeBytes ?? 0;
      totals.set(key, current);
    }
    return totals;
  }, [sortedMarked]);

  // Reset pagination when the scope changes (render-phase adjustment, not an
  // effect) so switching filters doesn't keep a large window from the previous
  // scope — and it resets before paint, avoiding a flash of the stale window.
  const scopeKey = `${selectedMonthKey}|${selectedMediaType}`;
  const [activeScope, setActiveScope] = useState(scopeKey);
  if (scopeKey !== activeScope) {
    setActiveScope(scopeKey);
    setVisibleCount(PAGE_SIZE);
  }

  const totalBytes = sumBytes(marked);
  const tileSize = getPhotoTileSize(width);
  const hasMore = visibleCount < sortedMarked.length;

  const rows = useMemo(() => buildRows(sortedMarked.slice(0, visibleCount), monthTotals), [sortedMarked, visibleCount, monthTotals]);

  const loadMore = useCallback(() => {
    setVisibleCount((count) => (count < sortedMarked.length ? Math.min(count + PAGE_SIZE, sortedMarked.length) : count));
  }, [sortedMarked.length]);

  const handleOpen = useCallback((photoId: string) => {
    router.push({ pathname: "/photo-preview", params: { id: photoId } });
  }, []);

  async function confirmDelete() {
    setConfirmVisible(false);
    try {
      const result = await deleteMarked(marked.map((item) => item.photoId));
      Alert.alert(
        t("reviewDelete.cleanupCompleteTitle"),
        t("reviewDelete.cleanupCompleteMessage", {
          clearedBytes: formatBytes(result.clearedBytes),
          deletedCount: result.deletedCount,
          mediaType: getMediaTypeNoun(selectedMediaType, result.deletedCount)
        }),
        // Show a capped interstitial at this natural task-end (Free users only).
        [{ text: t("common.done"), onPress: () => InterstitialAdService.maybeShow() }]
      );
    } catch (error) {
      Alert.alert(t("reviewDelete.deletionFailedTitle"), error instanceof Error ? error.message : t("reviewDelete.deletionFailedFallback"));
    }
  }

  const renderRow = useCallback(
    ({ item: row }: { item: ReviewRow }) => {
      if (row.type === "header") {
        return (
          <View style={{ marginTop: 16, marginBottom: 8 }}>
            <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}>
              {row.label}
            </Text>
            <Text selectable style={{ color: theme.muted, fontSize: 12 }}>
              {row.count} {getMediaTypeNoun(selectedMediaType, row.count)} - {formatBytes(row.bytes)}
            </Text>
          </View>
        );
      }
      return (
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          {row.items.map((item) => (
            <PhotoTile key={item.photoId} item={item} size={tileSize} onRestore={restore} onOpen={handleOpen} />
          ))}
        </View>
      );
    },
    [handleOpen, restore, selectedMediaType, theme.muted, theme.text, tileSize]
  );

  const listHeader =
    marked.length > 0 ? (
      <View style={{ backgroundColor: theme.surfaceSoft, borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "900" }}>
            {marked.length} {getMediaTypeNoun(selectedMediaType, marked.length)}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 14 }}>
            {t("reviewDelete.countSelected", { count: formatBytes(totalBytes) })}
          </Text>
        </View>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#ffd8d5", alignItems: "center", justifyContent: "center" }}>
          <Trash2 size={18} color={theme.red} />
        </View>
      </View>
    ) : null;

  // Fixed action bar pinned to the bottom (above the system nav bar via the
  // safe-area inset), so the delete action is always reachable without scrolling
  // to the end of a long marked list.
  const bottomBar =
    marked.length > 0 ? (
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 10,
          paddingTop: 10,
          paddingBottom: insets.bottom + 10,
          backgroundColor: theme.background,
          borderTopWidth: 1,
          borderTopColor: theme.border
        }}
      >
        <Pressable
          onPress={() => setConfirmVisible(true)}
          style={{
            backgroundColor: "#c9171d",
            borderRadius: 12,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8
          }}
        >
          <Trash2 size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{t("reviewDelete.deleteSelectedButton", { count: marked.length })}</Text>
        </Pressable>
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
          <ArrowLeft size={24} color={theme.text} />
        </Pressable>
        <Text selectable style={{ color: theme.accent, fontSize: 20, fontWeight: "900" }}>
          {t("reviewDelete.heading")}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <EmptyState
            icon={Images}
            title={t("reviewDelete.emptyStateTitle", { mediaType: getMediaTypeNoun(selectedMediaType) })}
            message={t("reviewDelete.emptyStateMessage", { mediaType: getMediaTypeNoun(selectedMediaType) })}
          />
        }
        // paddingBottom clears the fixed bottom bar (≈48 button + 20 padding +
        // 1 border + safe-area inset) plus a gap, so the last row never hides
        // behind the Delete button.
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 88, flexGrow: 1 }}
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={1.2}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews
        showsVerticalScrollIndicator
      />
      {bottomBar}
      <DeleteConfirmationDialog visible={confirmVisible} onCancel={() => setConfirmVisible(false)} onConfirm={confirmDelete} />
    </View>
  );
}

// Flatten the (already month-desc, stable-sorted) visible items into list rows:
// a header row per month followed by rows of up to TILE_COLUMNS tiles. Header
// count/bytes come from the full month totals so they stay accurate while paging.
function buildRows(items: MarkedForDeletionItem[], monthTotals: Map<string, { label: string; count: number; bytes: number }>): ReviewRow[] {
  const rows: ReviewRow[] = [];
  let index = 0;
  while (index < items.length) {
    const monthKey = getMarkedItemMonthKey(items[index]);
    const runStart = index;
    while (index < items.length && getMarkedItemMonthKey(items[index]) === monthKey) {
      index += 1;
    }
    const run = items.slice(runStart, index);
    const total = monthTotals.get(monthKey);
    rows.push({
      type: "header",
      key: `h:${monthKey}`,
      label: total?.label ?? monthLabel(monthKey),
      count: total?.count ?? run.length,
      bytes: total?.bytes ?? sumBytes(run)
    });
    for (let offset = 0; offset < run.length; offset += TILE_COLUMNS) {
      const chunk = run.slice(offset, offset + TILE_COLUMNS);
      rows.push({ type: "tiles", key: `t:${monthKey}:${chunk[0].photoId}`, items: chunk });
    }
  }
  return rows;
}
