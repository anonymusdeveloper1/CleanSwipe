import { router } from "expo-router";
import { BrushCleaning, Images, RotateCcw, Trash2 } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { MonthSelector } from "@/components/month-selector";
import { SwipePhotoCard } from "@/components/swipe-photo-card";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PermissionService } from "@/services/permission-service";
import { useAppStore } from "@/store/app-store";
import { formatDate } from "@/utils/date";
import { formatBytes, formatResolution } from "@/utils/format";
import { filterMarkedItemsByScope, filterPhotosByScope, getMediaTypeNoun } from "@/utils/months";

export function SwipeScreen() {
  const theme = useAppTheme();
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const requestPhotoPermission = useAppStore((state) => state.requestPhotoPermission);
  const permission = useAppStore((state) => state.permission);
  const loadingPhotos = useAppStore((state) => state.loadingPhotos);
  const requestingPermission = useAppStore((state) => state.requestingPermission);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const error = useAppStore((state) => state.error);
  const photos = useAppStore((state) => state.photos);
  const selectedMonthKey = useAppStore((state) => state.selectedMonthKey);
  const selectedMediaType = useAppStore((state) => state.selectedMediaType);
  const currentIndex = useAppStore((state) => state.currentIndex);
  const reviewedPhotoIds = useAppStore((state) => state.reviewedPhotoIds);
  const swipe = useAppStore((state) => state.swipeCurrentPhoto);
  const undo = useAppStore((state) => state.undoLastSwipe);
  const hasLastSwipe = useAppStore((state) => Boolean(state.lastSwipe));
  const markedItems = useAppStore((state) => state.markedForDeletion);
  const markedIds = useMemo(() => new Set(markedItems.map((item) => item.photoId)), [markedItems]);
  const reviewedIds = useMemo(() => new Set(reviewedPhotoIds), [reviewedPhotoIds]);
  const selectedPhotos = useMemo(() => filterPhotosByScope(photos, selectedMonthKey, selectedMediaType), [photos, selectedMediaType, selectedMonthKey]);
  const visiblePhotos = useMemo(
    () => selectedPhotos.filter((item) => !reviewedIds.has(item.id) && !markedIds.has(item.id)),
    [markedIds, reviewedIds, selectedPhotos]
  );
  const visibleMarkedCount = useMemo(
    () => filterMarkedItemsByScope(markedItems, selectedMonthKey, selectedMediaType, photos).length,
    [markedItems, photos, selectedMediaType, selectedMonthKey]
  );
  const activeIndex = Math.min(currentIndex, Math.max(visiblePhotos.length - 1, 0));
  const photo = visiblePhotos[activeIndex];
  const swipeStackPhotos = useMemo(() => visiblePhotos.slice(activeIndex, activeIndex + 4), [activeIndex, visiblePhotos]);
  const clearedCount = useMemo(
    () => selectedPhotos.filter((item) => reviewedIds.has(item.id) || markedIds.has(item.id)).length,
    [markedIds, reviewedIds, selectedPhotos]
  );
  const totalCount = selectedPhotos.length;
  const progress = totalCount > 0 ? clearedCount / totalCount : 0;

  useEffect(() => {
    if (hasHydrated) {
      void loadInitialData();
    }
  }, [hasHydrated, loadInitialData]);

  const needsMediaPermission = permission.status !== "granted" && permission.status !== "limited";

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <AppHeader />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text selectable style={{ color: theme.muted, fontSize: 16, fontWeight: "800", textAlign: "center" }}>
            Loading your media library...
          </Text>
        </View>
      </View>
    );
  }

  if (needsMediaPermission) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <AppHeader />
        <EmptyState
          icon={BrushCleaning}
          title="Allow photo access"
          message={error ?? "SwipeClean needs Photos and Videos access so you can review and clean your gallery."}
          actionLabel={requestingPermission ? "Requesting..." : "Allow Access"}
          onAction={requestPhotoPermission}
        />
        <View style={{ paddingHorizontal: 28 }}>
          <Pressable onPress={PermissionService.openSettings} style={{ alignItems: "center", padding: 16 }}>
            <Text style={{ color: theme.accent, fontWeight: "800", fontSize: 16 }}>Open Settings</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader />
      <View style={{ paddingHorizontal: 22, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ControlIconButton label="Undo last swipe" disabled={!hasLastSwipe} onPress={undo}>
          <RotateCcw size={21} color={hasLastSwipe ? theme.accent : theme.faint} />
        </ControlIconButton>
        <ControlIconButton label="View selected photos" onPress={() => router.push("/selected-photos")}>
          <Images size={22} color={theme.muted} />
        </ControlIconButton>
        <MonthSelector />
        <ControlIconButton label="Open marked for deletion" badgeCount={visibleMarkedCount} onPress={() => router.push("/review-delete-list")}>
          <Trash2 size={22} color={visibleMarkedCount > 0 ? theme.accent : theme.muted} />
        </ControlIconButton>
      </View>
      <View style={{ flex: 1, minHeight: 0, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 12, gap: 12 }}>
        {loadingPhotos ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
            <ActivityIndicator color={theme.accent} size="large" />
            <Text selectable style={{ color: theme.muted, fontSize: 16, fontWeight: "800", textAlign: "center" }}>
              Loading your media library...
            </Text>
          </View>
        ) : photo ? (
          <>
            <View style={{ flex: 1, minHeight: 0 }}>
              <SwipePhotoCard key={photo.id} photo={photo} stackPhotos={swipeStackPhotos} onSwipe={swipe} onOpen={() => router.push({ pathname: "/photo-preview", params: { id: photo.id } })} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <CircularProgress progress={progress} label={`${clearedCount}/${totalCount}`} />
              <Text selectable numberOfLines={2} style={{ flexShrink: 1, color: theme.muted, fontSize: 15, lineHeight: 21 }}>
                {formatDate(photo.creationTime)} - {formatBytes(photo.sizeBytes)} - {formatResolution(photo.width, photo.height)}
              </Text>
            </View>
          </>
        ) : (
          <EmptyState icon={BrushCleaning} title={`No ${getMediaTypeNoun(selectedMediaType)} found.`} message={`No ${getMediaTypeNoun(selectedMediaType)} found for this selection.`} />
        )}
      </View>
    </View>
  );
}

function CircularProgress({ progress, label }: { progress: number; label: string }) {
  const theme = useAppTheme();
  const size = 44;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(progress, 1));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.surfaceStrong} strokeWidth={stroke} fill="transparent" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.accent}
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clampedProgress)}
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <Text selectable={false} adjustsFontSizeToFit numberOfLines={1} style={{ color: theme.text, fontSize: 10, fontWeight: "900", maxWidth: 32 }}>
        {label}
      </Text>
    </View>
  );
}

type ControlIconButtonProps = {
  label: string;
  badgeCount?: number;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
};

function ControlIconButton({ label, badgeCount = 0, disabled, onPress, children }: ControlIconButtonProps) {
  const theme = useAppTheme();
  const showBadge = badgeCount > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.surfaceStrong,
        opacity: disabled ? 0.55 : 1
      }}
    >
      {children}
      {showBadge ? (
        <View
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            paddingHorizontal: 5,
            backgroundColor: theme.red,
            borderWidth: 2,
            borderColor: theme.background,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", lineHeight: 13 }}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
