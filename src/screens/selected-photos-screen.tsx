import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowLeft, BrushCleaning, Check, Trash2 } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BackHandler,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  View
} from "react-native";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GalleryMonthScrubber } from "@/components/gallery-month-scrubber";
import { MediaThumbnail } from "@/components/media-thumbnail";
import { EmptyState } from "@/components/empty-state";
import { SelectionActionBar } from "@/components/selection-action-bar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PhotoAsset } from "@/models/photo";
import { useAppStore } from "@/store/app-store";
import { useIndexedMediaAssets } from "@/store/media-index-store";
import { formatDate, formatWeekdayDay, monthLabel } from "@/utils/date";
import { formatBytes, sumBytes } from "@/utils/format";
import { buildGalleryLayout, hitTestSectionedIndex, photoIndexAtOffset, rangeIndices, type GalleryRow } from "@/utils/gallery-grid";
import { filterPhotosByMediaType, filterPhotosByScope, getMediaTypeAllLabel, getMediaTypeNoun, groupPhotosByMonth } from "@/utils/months";

// Dense gallery: tiny inter-cell gap (each tile padded by GAP/2 so edges + gaps
// stay even), cells sized to a ~100 dp target so phones land on 4 columns /
// tablets more. Photos are grouped under per-month text headers (HEADER_H tall).
// Edge auto-scroll while drag-selecting near the top/bottom.
const GAP = 2;
const TARGET_CELL = 100;
const HEADER_H = 52; // month section header row height (must match the rendered header)
const EDGE_ZONE = 76; // px band that triggers auto-scroll during a drag
const AUTO_STEP = 26; // px per tick
const AUTO_MS = 30;

type TileColors = { surfaceStrong: string; red: string; accent: string };

function clamp(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}

export function SelectedPhotosScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const photos = useIndexedMediaAssets();
  const selectedMonthKey = useAppStore((state) => state.selectedMonthKey);
  const selectedMediaType = useAppStore((state) => state.selectedMediaType);
  const markMany = useAppStore((state) => state.markManyForDeletion);
  const marked = useAppStore((state) => state.markedForDeletion);
  const markedIds = useMemo(() => new Set(marked.map((item) => item.photoId)), [marked]);

  // Scope-filtered media MINUS anything already queued for deletion — the gallery
  // only shows items that are NOT marked for deletion (marking removes them here).
  const selectedPhotos = useMemo(
    () => filterPhotosByScope(photos, selectedMonthKey, selectedMediaType).filter((photo) => !markedIds.has(photo.id)),
    [photos, selectedMediaType, selectedMonthKey, markedIds]
  );
  const total = selectedPhotos.length;
  const selectedLabel = useMemo(
    () =>
      groupPhotosByMonth(filterPhotosByMediaType(photos, selectedMediaType), getMediaTypeAllLabel(selectedMediaType)).find(
        (month) => month.key === selectedMonthKey
      )?.label ?? getMediaTypeAllLabel(selectedMediaType),
    [photos, selectedMediaType, selectedMonthKey]
  );
  // ── Sectioned grid geometry (depends on the measured list width) ────────────
  const [listW, setListW] = useState(0);
  const [listH, setListH] = useState(0);
  const numColumns = listW > 0 ? clamp(Math.round(listW / TARGET_CELL), 3, 6) : 4;
  const rowHeight = listW > 0 ? listW / numColumns : 0; // square tile slot pitch
  const cellDp = rowHeight > 0 ? Math.round(rowHeight - GAP) : 0;
  // Flatten photos into month-header + photo rows with absolute tops. Depends
  // only on the photo list + grid metrics (NOT selection), so it isn't rebuilt
  // while drag-selecting.
  const layout = useMemo(
    () => buildGalleryLayout(selectedPhotos, { numColumns, rowHeight, headerHeight: HEADER_H }),
    [selectedPhotos, numColumns, rowHeight]
  );
  const paddingBottom = insets.bottom + 24;
  const contentHeight = layout.contentHeight + paddingBottom;
  const maxScroll = Math.max(1, contentHeight - listH);
  // Show the fast-scroll scrubber whenever the list actually scrolls (incl. a
  // single-month scope — the bubble then shows the weekday+day instead of a date).
  const showScrubber = maxScroll > 1 && total > 0;
  const isSingleMonth = selectedMonthKey !== "all";

  // ── Selection state ─────────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Mirrors + geometry snapshots read by the (stable) gesture/auto-scroll callbacks.
  const listRef = useRef<FlashListRef<GalleryRow>>(null);
  const scrollYRef = useRef(0);
  const scrollYSV = useSharedValue(0);
  const lastHitRef = useRef(-1);
  const photosRef = useRef(selectedPhotos);
  const selectedIdsRef = useRef(selectedIds);
  const selectModeRef = useRef(selectMode);
  const anchorIndexRef = useRef<number | null>(null);
  const selectionBeforeDragRef = useRef<Set<string>>(new Set());
  // Whether the active drag-paint stroke is adding or removing from the selection
  // (decided from the anchor tile's state at stroke start).
  const paintModeRef = useRef<"select" | "deselect">("select");
  const layoutRef = useRef({ rows: layout.rows, numColumns, rowHeight });
  const maxScrollRef = useRef(1);
  const lastFingerRef = useRef({ x: 0, y: 0 });
  const autoDirRef = useRef(0);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // True while the user drags the right-edge scrubber thumb. Disables the list's
  // native scroll so the scrub gesture isn't stolen by the ScrollView.
  const [scrubbing, setScrubbing] = useState(false);
  // True while a long-press paint stroke is active — disables native scroll so
  // the drag paints (and the edge auto-scroll drives scrolling) instead of the
  // list scrolling under the finger. Normal flicks keep scroll enabled.
  const [painting, setPainting] = useState(false);


  // Keep the latest values reachable from the (stable) gesture/auto-scroll
  // callbacks. Written after commit — the callbacks only fire during interaction.
  useEffect(() => {
    photosRef.current = selectedPhotos;
    layoutRef.current = { rows: layout.rows, numColumns, rowHeight };
    maxScrollRef.current = maxScroll;
  });
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  useEffect(() => {
    selectModeRef.current = selectMode;
  }, [selectMode]);

  const tileColors = useMemo<TileColors>(
    () => ({ surfaceStrong: theme.surfaceStrong, red: theme.red, accent: theme.accent }),
    [theme.surfaceStrong, theme.red, theme.accent]
  );

  // ── Stable callbacks (read live data via refs) ──────────────────────────────
  const handleOpen = useCallback((id: string) => router.push({ pathname: "/photo-preview", params: { id } }), []);

  const stopAutoScroll = useCallback(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const applyDragTo = useCallback((index: number) => {
    const anchor = anchorIndexRef.current;
    if (index < 0 || anchor == null) return;
    const select = paintModeRef.current === "select";
    const next = new Set(selectionBeforeDragRef.current);
    for (const i of rangeIndices(anchor, index)) {
      const photo = photosRef.current[i];
      if (!photo) continue;
      if (select) next.add(photo.id);
      else next.delete(photo.id);
    }
    setSelectedIds(next);
  }, []);

  // Map a viewport touch to a photo index in the sectioned layout (null = a
  // header row, an inter-row gap, or past the columns). contentY folds in the
  // live scroll offset so it's correct mid auto-scroll too.
  const hitAt = useCallback((x: number, viewportY: number) => hitTestSectionedIndex(x, viewportY + scrollYRef.current, layoutRef.current), []);

  // Paint the range anchor→hit. The first real hit of a stroke fixes the anchor
  // AND the direction: a stroke that STARTS on an already-selected tile deselects
  // (so re-dragging over selected items removes them); otherwise it selects.
  const paintAt = useCallback(
    (x: number, viewportY: number) => {
      const index = hitAt(x, viewportY);
      if (index == null) return;
      if (anchorIndexRef.current == null) {
        const photo = photosRef.current[index];
        paintModeRef.current = photo && selectionBeforeDragRef.current.has(photo.id) ? "deselect" : "select";
        anchorIndexRef.current = index;
      }
      if (index === lastHitRef.current) return;
      lastHitRef.current = index;
      applyDragTo(index);
    },
    [applyDragTo, hitAt]
  );

  const tickAutoScroll = useCallback(() => {
    const dir = autoDirRef.current;
    if (dir === 0) {
      stopAutoScroll();
      return;
    }
    const next = clamp(scrollYRef.current + dir * AUTO_STEP, 0, maxScrollRef.current);
    if (next === scrollYRef.current) return; // reached an end
    scrollYRef.current = next;
    scrollYSV.value = next;
    listRef.current?.scrollToOffset({ offset: next, animated: false });
    paintAt(lastFingerRef.current.x, lastFingerRef.current.y);
  }, [paintAt, scrollYSV, stopAutoScroll]);

  const setAutoScroll = useCallback(
    (dir: number, x: number, y: number) => {
      lastFingerRef.current = { x, y };
      if (dir === autoDirRef.current) return;
      autoDirRef.current = dir;
      if (dir === 0) {
        stopAutoScroll();
      } else if (!autoTimerRef.current) {
        autoTimerRef.current = setInterval(tickAutoScroll, AUTO_MS);
      }
    },
    [stopAutoScroll, tickAutoScroll]
  );

  // Long-press-drag paint stroke (also enters select mode on the first stroke, so
  // a long-press in normal mode begins selecting). A fresh snapshot per stroke
  // lets a later drag add to OR remove from the prior selection.
  const beginPaintAt = useCallback(
    (x: number, y: number) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPainting(true); // freeze native scroll for the stroke
      if (!selectModeRef.current) {
        selectModeRef.current = true;
        setSelectMode(true);
      }
      selectionBeforeDragRef.current = new Set(selectedIdsRef.current);
      anchorIndexRef.current = null;
      lastHitRef.current = -1;
      paintModeRef.current = "select";
      paintAt(x, y);
    },
    [paintAt]
  );

  const updateDragAt = useCallback(
    (x: number, y: number) => {
      lastFingerRef.current = { x, y };
      paintAt(x, y);
    },
    [paintAt]
  );

  const endDrag = useCallback(() => {
    stopAutoScroll();
    autoDirRef.current = 0;
    anchorIndexRef.current = null;
    lastHitRef.current = -1;
    setPainting(false); // re-enable native scroll
  }, [stopAutoScroll]);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Quick tap: toggle the tile in select mode, otherwise open the previewer.
  const tapAt = useCallback(
    (x: number, y: number) => {
      const index = hitAt(x, y);
      if (index == null) return;
      const photo = photosRef.current[index];
      if (!photo) return;
      if (selectModeRef.current) toggleId(photo.id);
      else handleOpen(photo.id);
    },
    [hitAt, toggleId, handleOpen]
  );

  const exitSelect = useCallback(() => {
    endDrag();
    selectModeRef.current = false;
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [endDrag]);

  const handleDelete = useCallback(() => {
    const ids = selectedIdsRef.current;
    const items = photosRef.current.filter((photo) => ids.has(photo.id));
    if (items.length === 0) {
      exitSelect();
      return;
    }
    markMany(items);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    exitSelect();
  }, [markMany, exitSelect]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollYRef.current = y;
      scrollYSV.value = y;
    },
    [scrollYSV]
  );

  const scrubTo = useCallback(
    (offset: number) => {
      const clamped = clamp(offset, 0, maxScrollRef.current);
      scrollYRef.current = clamped;
      scrollYSV.value = clamped;
      listRef.current?.scrollToOffset({ offset: clamped, animated: false });
    },
    [scrollYSV]
  );

  // Scrubber bubble label: the creation date of the item at the top of the
  // viewport for a given scroll offset. Multi-month scope → full date
  // ("Dec 25, 2025"); single-month scope → weekday + day ("Mon 24").
  const labelForOffset = useCallback(
    (offset: number) => {
      const photos = photosRef.current;
      const index = photoIndexAtOffset(offset, { rows: layoutRef.current.rows, total: photos.length });
      const time = index >= 0 ? photos[index]?.creationTime : undefined;
      if (!time) return "";
      return isSingleMonth ? formatWeekdayDay(time) : formatDate(time);
    },
    [isSingleMonth]
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setListW(event.nativeEvent.layout.width);
    setListH(event.nativeEvent.layout.height);
  }, []);

  // Hardware back exits selection instead of leaving the screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectModeRef.current) {
        exitSelect();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [exitSelect]);

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  // ── Grid gesture, composed Simultaneous with the list's native scroll ───────
  // A quick TAP toggles a tile (select mode) or opens it (normal mode). A
  // long-press-DRAG paints selection — entering select mode if needed — and
  // edge-auto-scrolls. The pan only ACTIVATES after a long press; until then the
  // native scroll (running Simultaneous) handles flicks, so the list scrolls
  // normally in AND out of select mode. When the pan activates it flips the
  // `painting` flag, which sets `scrollEnabled={false}` for the stroke so the
  // drag paints instead of the list scrolling under the finger.
  const gridGesture = useMemo(() => {
    const viewportH = listH;

    const pan = Gesture.Pan()
      .activateAfterLongPress(180)
      .onStart((event) => {
        "worklet";
        runOnJS(beginPaintAt)(event.x, event.y);
      })
      .onUpdate((event) => {
        "worklet";
        runOnJS(updateDragAt)(event.x, event.y);
        let dir = 0;
        if (event.y < EDGE_ZONE) dir = -1;
        else if (event.y > viewportH - EDGE_ZONE) dir = 1;
        runOnJS(setAutoScroll)(dir, event.x, event.y);
      })
      .onEnd(() => {
        "worklet";
        runOnJS(endDrag)();
      })
      .onFinalize(() => {
        "worklet";
        runOnJS(endDrag)();
      });

    const tap = Gesture.Tap().onEnd((event) => {
      "worklet";
      runOnJS(tapAt)(event.x, event.y);
    });

    return Gesture.Exclusive(pan, tap);
  }, [listH, beginPaintAt, updateDragAt, setAutoScroll, endDrag, tapAt]);


  // Re-render the mounted rows when selection/marks change (rows themselves are
  // selection-independent, so FlashList needs this nudge).
  const listExtraData = useMemo(() => ({ selectedIds, markedIds }), [selectedIds, markedIds]);

  const renderRow = useCallback(
    ({ item: row }: { item: GalleryRow }) => {
      if (row.type === "header") {
        return (
          <View style={{ height: HEADER_H, justifyContent: "center", paddingHorizontal: GAP / 2 + 4 }}>
            <Text selectable numberOfLines={1} style={{ color: theme.text, fontSize: 15, fontWeight: "900" }}>
              {monthLabel(row.monthKey)}
            </Text>
            <Text selectable style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }}>
              {row.count.toLocaleString()} {getMediaTypeNoun(selectedMediaType, row.count)} - {formatBytes(row.bytes)}
            </Text>
          </View>
        );
      }
      return (
        <View style={{ flexDirection: "row", height: row.height }}>
          {Array.from({ length: numColumns }, (_, col) => {
            const photo = col < row.count ? selectedPhotos[row.startIndex + col] : undefined;
            if (!photo) return <View key={`pad:${row.startIndex}:${col}`} style={{ flex: 1 }} />;
            return (
              <View key={photo.id} style={{ flex: 1, padding: GAP / 2 }}>
                <GalleryTile item={photo} isSelected={selectedIds.has(photo.id)} isMarked={markedIds.has(photo.id)} cellDp={cellDp} colors={tileColors} />
              </View>
            );
          })}
        </View>
      );
    },
    [numColumns, selectedPhotos, selectedIds, markedIds, cellDp, tileColors, theme.text, theme.muted, selectedMediaType]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top + 16 }}>
      {selectMode ? (
        <SelectionActionBar count={selectedIds.size} onClose={exitSelect} onDelete={handleDelete} />
      ) : (
        <View
          style={{
            paddingHorizontal: 22,
            paddingBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12
          }}
        >
          <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
            <ArrowLeft size={30} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text selectable numberOfLines={1} style={{ color: theme.accent, fontSize: 19, fontWeight: "900" }}>
              {selectedLabel}
            </Text>
            <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>
              {total.toLocaleString()} {getMediaTypeNoun(selectedMediaType, total)} - {formatBytes(sumBytes(selectedPhotos))}
            </Text>
          </View>
          <View style={{ width: 46 }} />
        </View>
      )}

      {total === 0 ? (
        <EmptyState
          icon={BrushCleaning}
          title={t("swipe.noMediaTitle", { noun: getMediaTypeNoun(selectedMediaType) })}
          message={t("swipe.noMediaMessage", { noun: getMediaTypeNoun(selectedMediaType) })}
        />
      ) : (
        <View style={{ flex: 1 }} onLayout={onLayout}>
          {listW > 0 ? (
            <GestureDetector gesture={gridGesture}>
              <FlashList
                ref={listRef}
                data={layout.rows}
                extraData={listExtraData}
                keyExtractor={(row) => row.key}
                getItemType={(row) => row.type}
                scrollEnabled={!scrubbing && !painting}
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentInsetAdjustmentBehavior="never"
                contentContainerStyle={{ paddingBottom }}
                showsVerticalScrollIndicator={false}
                renderItem={renderRow}
                style={{ flex: 1 }}
              />
            </GestureDetector>
          ) : null}

          {showScrubber && !selectMode ? (
            <GalleryMonthScrubber
              scrollY={scrollYSV}
              maxScroll={maxScroll}
              trackHeight={listH}
              labelForOffset={labelForOffset}
              onScrubbingChange={setScrubbing}
              onScrubTo={scrubTo}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

/**
 * One dense gallery cell — purely presentational and memoized, so changing the
 * selection only re-renders the tiles whose state actually changed (the mounted
 * window). All touch handling (tap/open/toggle, long-press-drag select, scroll)
 * lives on the grid's wrapper gesture, so the tile itself is non-interactive.
 */
const GalleryTile = memo(function GalleryTile({
  item,
  isSelected,
  isMarked,
  cellDp,
  colors
}: {
  item: PhotoAsset;
  isSelected: boolean;
  isMarked: boolean;
  cellDp: number;
  colors: TileColors;
}) {
  const content = (
    <View
      style={{
        width: "100%",
        aspectRatio: 1,
        overflow: "hidden",
        backgroundColor: colors.surfaceStrong,
        borderRadius: isSelected ? 12 : 0,
        // Always a valid transform array. Toggling between an array and undefined
        // makes RN's prop diff reset transform to `null`, which crashes
        // _validateTransforms (`Cannot read property 'forEach' of null`).
        transform: [{ scale: isSelected ? 0.84 : 1 }]
      }}
    >
      <MediaThumbnail
        uri={item.uri}
        id={item.id}
        mediaType={item.mediaType}
        cellDp={cellDp}
        contentFit="cover"
        backgroundColor={colors.surfaceStrong}
        style={{ flex: 1 }}
      />
      {isMarked ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: "rgba(220,38,38,0.22)" }} /> : null}
      {isMarked ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 4,
            left: 4,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.red,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Trash2 size={11} color="#fff" />
        </View>
      ) : null}
      {isSelected ? (
        <>
          <View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: `${colors.accent}26` }} />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 5,
              right: 5,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: "#fff"
            }}
          >
            <Check size={12} color="#fff" strokeWidth={3.5} />
          </View>
        </>
      ) : null}
    </View>
  );

  return content;
});
