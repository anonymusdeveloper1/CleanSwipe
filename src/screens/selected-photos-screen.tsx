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
  StyleSheet,
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
import { formatBytes, sumBytes } from "@/utils/format";
import { buildMonthSpans, hitTestGridIndex, rangeIndices } from "@/utils/gallery-grid";
import { filterPhotosByMediaType, filterPhotosByScope, getMediaTypeAllLabel, getMediaTypeNoun, groupPhotosByMonth } from "@/utils/months";

// Dense gallery: tiny inter-cell gap (content container inset by GAP/2 on every
// edge), cells sized to a ~100 dp target so phones land on 4 columns / tablets
// more. Edge auto-scroll while drag-selecting near the top/bottom.
const GAP = 2;
const TARGET_CELL = 100;
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

  const selectedPhotos = useMemo(
    () => filterPhotosByScope(photos, selectedMonthKey, selectedMediaType),
    [photos, selectedMediaType, selectedMonthKey]
  );
  const total = selectedPhotos.length;
  const selectedLabel = useMemo(
    () =>
      groupPhotosByMonth(filterPhotosByMediaType(photos, selectedMediaType), getMediaTypeAllLabel(selectedMediaType)).find(
        (month) => month.key === selectedMonthKey
      )?.label ?? getMediaTypeAllLabel(selectedMediaType),
    [photos, selectedMediaType, selectedMonthKey]
  );
  const spans = useMemo(() => buildMonthSpans(selectedPhotos), [selectedPhotos]);

  // ── Grid geometry (depends on the measured list width) ──────────────────────
  const [listW, setListW] = useState(0);
  const [listH, setListH] = useState(0);
  const numColumns = listW > 0 ? clamp(Math.round(listW / TARGET_CELL), 3, 6) : 4;
  const columnWidth = listW > 0 ? (listW - GAP) / numColumns : 0; // square slot pitch
  const cellDp = Math.round(columnWidth);
  const rows = Math.ceil(total / numColumns);
  const paddingBottom = insets.bottom + 24;
  const contentHeight = rows * columnWidth + GAP / 2 + paddingBottom;
  const maxScroll = Math.max(1, contentHeight - listH);
  const showScrubber = spans.length > 1 && maxScroll > 1;

  // ── Selection state ─────────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Mirrors + geometry snapshots read by the (stable) gesture/auto-scroll callbacks.
  const listRef = useRef<FlashListRef<PhotoAsset>>(null);
  const scrollYRef = useRef(0);
  const scrollYSV = useSharedValue(0);
  const lastHitSV = useSharedValue(-1);
  const photosRef = useRef(selectedPhotos);
  const selectedIdsRef = useRef(selectedIds);
  const selectModeRef = useRef(selectMode);
  const anchorIndexRef = useRef<number | null>(null);
  const selectionBeforeDragRef = useRef<Set<string>>(new Set());
  const geoRef = useRef({ cellSize: 0, numColumns: 4, gap: GAP, total: 0 });
  const maxScrollRef = useRef(1);
  const lastFingerRef = useRef({ x: 0, y: 0 });
  const autoDirRef = useRef(0);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep the latest values reachable from the (stable) gesture/auto-scroll
  // callbacks. Written after commit — the callbacks only fire during interaction.
  useEffect(() => {
    photosRef.current = selectedPhotos;
    geoRef.current = { cellSize: columnWidth, numColumns, gap: GAP, total };
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
    if (index < 0) return;
    if (anchorIndexRef.current == null) anchorIndexRef.current = index;
    const anchor = anchorIndexRef.current;
    const next = new Set(selectionBeforeDragRef.current);
    for (const i of rangeIndices(anchor, index)) {
      const photo = photosRef.current[i];
      if (photo) next.add(photo.id);
    }
    setSelectedIds(next);
  }, []);

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
    const index = hitTestGridIndex(lastFingerRef.current.x, lastFingerRef.current.y, next, geoRef.current);
    if (index != null) {
      lastHitSV.value = index;
      applyDragTo(index);
    }
  }, [applyDragTo, scrollYSV, lastHitSV, stopAutoScroll]);

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

  const beginDrag = useCallback((index: number) => {
    selectionBeforeDragRef.current = new Set(selectedIdsRef.current);
    anchorIndexRef.current = index >= 0 ? index : null;
    if (index >= 0) applyDragTo(index);
  }, [applyDragTo]);

  const endDrag = useCallback(() => {
    stopAutoScroll();
    autoDirRef.current = 0;
    anchorIndexRef.current = null;
    lastHitSV.value = -1;
  }, [stopAutoScroll, lastHitSV]);

  const toggleAt = useCallback((index: number) => {
    const photo = photosRef.current[index];
    if (!photo) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
  }, []);

  const enterSelect = useCallback((item: PhotoAsset) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectMode(true);
    setSelectedIds(new Set([item.id]));
  }, []);

  const exitSelect = useCallback(() => {
    endDrag();
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

  // ── Drag/tap selection gesture over the grid (overlay only in select mode) ──
  // scrollEnabled is off in select mode, so this overlay owns all touches and
  // the list can't fight the pan. Hit math is inlined in each worklet (captures
  // the geometry snapshot at build time; rebuilt when the grid reflows).
  const selectGesture = useMemo(() => {
    const cols = numColumns;
    const pitch = columnWidth;
    const count = total;
    const pad = GAP / 2;
    const viewportH = listH;

    const pan = Gesture.Pan()
      .onStart((event) => {
        "worklet";
        const lx = event.x - pad;
        const ly = event.y + scrollYSV.value - pad;
        let index = -1;
        if (lx >= 0 && ly >= 0 && pitch > 0) {
          const col = Math.floor(lx / pitch);
          if (col >= 0 && col < cols) {
            const i = Math.floor(ly / pitch) * cols + col;
            if (i >= 0 && i < count) index = i;
          }
        }
        lastHitSV.value = index;
        runOnJS(beginDrag)(index);
      })
      .onUpdate((event) => {
        "worklet";
        const lx = event.x - pad;
        const ly = event.y + scrollYSV.value - pad;
        let index = -1;
        if (lx >= 0 && ly >= 0 && pitch > 0) {
          const col = Math.floor(lx / pitch);
          if (col >= 0 && col < cols) {
            const i = Math.floor(ly / pitch) * cols + col;
            if (i >= 0 && i < count) index = i;
          }
        }
        if (index !== -1 && index !== lastHitSV.value) {
          lastHitSV.value = index;
          runOnJS(applyDragTo)(index);
        }
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
      const lx = event.x - pad;
      const ly = event.y + scrollYSV.value - pad;
      if (lx >= 0 && ly >= 0 && pitch > 0) {
        const col = Math.floor(lx / pitch);
        if (col >= 0 && col < cols) {
          const i = Math.floor(ly / pitch) * cols + col;
          if (i >= 0 && i < count) runOnJS(toggleAt)(i);
        }
      }
    });

    return Gesture.Exclusive(pan, tap);
  }, [numColumns, columnWidth, total, listH, scrollYSV, lastHitSV, beginDrag, applyDragTo, setAutoScroll, endDrag, toggleAt]);

  const renderItem = useCallback(
    ({ item }: { item: PhotoAsset }) => (
      <View style={{ flex: 1, padding: GAP / 2 }}>
        <GalleryTile
          item={item}
          isSelected={selectedIds.has(item.id)}
          isMarked={markedIds.has(item.id)}
          selectMode={selectMode}
          cellDp={cellDp}
          colors={tileColors}
          onOpen={handleOpen}
          onLongPressSelect={enterSelect}
        />
      </View>
    ),
    [selectedIds, markedIds, selectMode, cellDp, tileColors, handleOpen, enterSelect]
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
            <FlashList
              ref={listRef}
              data={selectedPhotos}
              extraData={selectedIds}
              keyExtractor={(item) => item.id}
              numColumns={numColumns}
              scrollEnabled={!selectMode}
              onScroll={onScroll}
              scrollEventThrottle={16}
              contentInsetAdjustmentBehavior="never"
              contentContainerStyle={{ padding: GAP / 2, paddingBottom }}
              renderItem={renderItem}
              style={{ flex: 1 }}
            />
          ) : null}

          {selectMode ? (
            <GestureDetector gesture={selectGesture}>
              <View style={StyleSheet.absoluteFill} />
            </GestureDetector>
          ) : null}

          {showScrubber && !selectMode ? (
            <GalleryMonthScrubber
              scrollY={scrollYSV}
              maxScroll={maxScroll}
              trackHeight={listH}
              total={total}
              spans={spans}
              onScrubTo={scrubTo}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

/**
 * One dense gallery cell. Memoized so changing the selection only re-renders the
 * tiles whose state actually changed (the mounted window), not all of them. In
 * select mode the tile is non-interactive — the screen's overlay owns gestures —
 * so touches fall through to the drag/tap selector.
 */
const GalleryTile = memo(function GalleryTile({
  item,
  isSelected,
  isMarked,
  selectMode,
  cellDp,
  colors,
  onOpen,
  onLongPressSelect
}: {
  item: PhotoAsset;
  isSelected: boolean;
  isMarked: boolean;
  selectMode: boolean;
  cellDp: number;
  colors: TileColors;
  onOpen: (id: string) => void;
  onLongPressSelect: (item: PhotoAsset) => void;
}) {
  const content = (
    <View
      style={{
        width: "100%",
        aspectRatio: 1,
        overflow: "hidden",
        backgroundColor: colors.surfaceStrong,
        borderRadius: isSelected ? 12 : 0,
        transform: isSelected ? [{ scale: 0.84 }] : undefined
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

  if (selectMode) {
    return (
      <View pointerEvents="none" style={{ flex: 1 }}>
        {content}
      </View>
    );
  }

  return (
    <Pressable onPress={() => onOpen(item.id)} onLongPress={() => onLongPressSelect(item)} delayLongPress={280} style={{ flex: 1 }}>
      {content}
    </Pressable>
  );
});
