import { router } from "expo-router";
import { ArrowRight, BrushCleaning, CheckCircle2, Images, RotateCcw, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle } from "react-native-svg";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { MonthSelector } from "@/components/month-selector";
import { SwipePhotoCard } from "@/components/swipe-photo-card";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PermissionService } from "@/services/permission-service";
import { useAppStore } from "@/store/app-store";
import { useIndexedMediaAssets } from "@/store/media-index-store";
import { formatDate } from "@/utils/date";
import { formatBytes, formatResolution } from "@/utils/format";
import { filterMarkedItemsByScope, filterPhotosByMediaType, filterPhotosByScope, getMediaTypeAllLabel, getMediaTypeNoun, groupPhotosByMonth } from "@/utils/months";

export function SwipeScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [restartBlockedCount, setRestartBlockedCount] = useState<number | undefined>();
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const requestPhotoPermission = useAppStore((state) => state.requestPhotoPermission);
  const permission = useAppStore((state) => state.permission);
  const loadingPhotos = useAppStore((state) => state.loadingPhotos);
  const requestingPermission = useAppStore((state) => state.requestingPermission);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const error = useAppStore((state) => state.error);
  const photos = useIndexedMediaAssets();
  const selectedMonthKey = useAppStore((state) => state.selectedMonthKey);
  const selectedMediaType = useAppStore((state) => state.selectedMediaType);
  const currentIndex = useAppStore((state) => state.currentIndex);
  const reviewedPhotoIds = useAppStore((state) => state.reviewedPhotoIds);
  const setSelectedMonth = useAppStore((state) => state.setSelectedMonth);
  const swipe = useAppStore((state) => state.swipeCurrentPhoto);
  const undo = useAppStore((state) => state.undoLastSwipe);
  const restartCurrentSelection = useAppStore((state) => state.restartCurrentSelection);
  const hasLastSwipe = useAppStore((state) => Boolean(state.lastSwipe));
  const markedItems = useAppStore((state) => state.markedForDeletion);
  const markedIds = useMemo(() => new Set(markedItems.map((item) => item.photoId)), [markedItems]);
  const reviewedIds = useMemo(() => new Set(reviewedPhotoIds), [reviewedPhotoIds]);
  const selectedPhotos = useMemo(() => filterPhotosByScope(photos, selectedMonthKey, selectedMediaType), [photos, selectedMediaType, selectedMonthKey]);
  const visiblePhotos = useMemo(
    () => selectedPhotos.filter((item) => !reviewedIds.has(item.id) && !markedIds.has(item.id)),
    [markedIds, reviewedIds, selectedPhotos]
  );
  const markedInSelection = useMemo(
    () => filterMarkedItemsByScope(markedItems, selectedMonthKey, selectedMediaType, photos),
    [markedItems, photos, selectedMediaType, selectedMonthKey]
  );
  const visibleMarkedCount = markedInSelection.length;
  const activeIndex = Math.min(currentIndex, Math.max(visiblePhotos.length - 1, 0));
  const photo = visiblePhotos[activeIndex];
  const swipeStackPhotos = useMemo(() => visiblePhotos.slice(activeIndex, activeIndex + 4), [activeIndex, visiblePhotos]);
  const clearedCount = useMemo(
    () => selectedPhotos.filter((item) => reviewedIds.has(item.id) || markedIds.has(item.id)).length,
    [markedIds, reviewedIds, selectedPhotos]
  );
  const totalCount = selectedPhotos.length;
  const progress = totalCount > 0 ? clearedCount / totalCount : 0;
  const monthOptions = useMemo(
    () => groupPhotosByMonth(filterPhotosByMediaType(photos, selectedMediaType), getMediaTypeAllLabel(selectedMediaType)),
    [photos, selectedMediaType]
  );
  const selectedMonthLabel =
    monthOptions.find((month) => month.key === selectedMonthKey)?.label ?? getMediaTypeAllLabel(selectedMediaType);
  const concreteMonths = useMemo(() => monthOptions.filter((month) => month.key !== "all"), [monthOptions]);
  const nextMonth = useMemo(() => {
    if (concreteMonths.length === 0) return undefined;
    if (selectedMonthKey === "all") return concreteMonths[0];
    const currentMonthIndex = concreteMonths.findIndex((month) => month.key === selectedMonthKey);
    return currentMonthIndex >= 0 ? concreteMonths[currentMonthIndex + 1] : concreteMonths[0];
  }, [concreteMonths, selectedMonthKey]);
  const selectionComplete = selectedPhotos.length > 0 && visiblePhotos.length === 0;

  useEffect(() => {
    if (hasHydrated) {
      void loadInitialData();
    }
  }, [hasHydrated, loadInitialData]);

  const needsMediaPermission = permission.status !== "granted" && permission.status !== "limited";

  const handleStartOver = () => {
    const result = restartCurrentSelection();
    if (result.ok) return;

    const blockedCount = result.blockedCount ?? visibleMarkedCount;
    setRestartBlockedCount(blockedCount);
  };

  const handleNextMonth = () => {
    if (nextMonth) {
      setSelectedMonth(nextMonth.key);
      return;
    }
    router.push("/month-selector");
  };

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <AppHeader />
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
    // Show the in-app OS dialog while the OS still allows prompting; only route
    // to system Settings once it won't prompt anymore (Android flips
    // canAskAgain:false after repeated denials, iOS after the first denial).
    const permanentlyDenied = permission.status === "denied" && permission.canAskAgain === false;
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <AppHeader />
        <EmptyState
          icon={BrushCleaning}
          title={t("permissions.mediaTitle")}
          message={error ?? t("permissions.photosMessage")}
          actionLabel={
            permanentlyDenied ? t("common.openSettings") : requestingPermission ? t("common.requesting") : t("common.allowAccess")
          }
          onAction={permanentlyDenied ? PermissionService.openSettings : requestPhotoPermission}
        />
        {permanentlyDenied ? null : (
          <View style={{ paddingHorizontal: 28 }}>
            <Pressable onPress={PermissionService.openSettings} style={{ alignItems: "center", padding: 16 }}>
              <Text style={{ color: theme.accent, fontWeight: "800", fontSize: 16 }}>{t("common.openSettings")}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader />
      <View style={{ paddingHorizontal: 22, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ControlIconButton label={t("swipe.undoLastSwipe")} disabled={!hasLastSwipe} onPress={undo}>
          <RotateCcw size={21} color={hasLastSwipe ? theme.accent : theme.faint} />
        </ControlIconButton>
        <ControlIconButton label={t("swipe.viewSelectedPhotos")} onPress={() => router.push("/selected-photos")}>
          <Images size={22} color={theme.muted} />
        </ControlIconButton>
        <MonthSelector />
        <ControlIconButton label={t("swipe.openMarkedForDeletion")} badgeCount={visibleMarkedCount} onPress={() => router.push("/review-delete-list")}>
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
        ) : selectionComplete ? (
          <CompletedSelectionState
            title={visibleMarkedCount > 0 ? t("swipe.monthReviewed") : t("swipe.monthComplete")}
            message={
              visibleMarkedCount > 0
                ? t("swipe.markedMessage", { count: visibleMarkedCount, noun: getMediaTypeNoun(selectedMediaType, visibleMarkedCount), month: selectedMonthLabel })
                : t("swipe.reviewedEverything", { month: selectedMonthLabel })
            }
            pendingDeleteCount={visibleMarkedCount}
            nextMonthLabel={nextMonth?.label}
            onReviewDelete={() => router.push("/review-delete-list")}
            onStartOver={handleStartOver}
            onNextMonth={handleNextMonth}
          />
        ) : (
          <EmptyState icon={BrushCleaning} title={t("swipe.noMediaTitle", { noun: getMediaTypeNoun(selectedMediaType) })} message={t("swipe.noMediaMessage", { noun: getMediaTypeNoun(selectedMediaType) })} />
        )}
      </View>
      <RestartBlockedDialog
        visible={restartBlockedCount !== undefined}
        count={restartBlockedCount ?? 0}
        noun={getMediaTypeNoun(selectedMediaType, restartBlockedCount ?? 0)}
        onCancel={() => setRestartBlockedCount(undefined)}
        onReview={() => {
          setRestartBlockedCount(undefined);
          router.push("/review-delete-list");
        }}
      />
    </View>
  );
}

function RestartBlockedDialog({
  visible,
  count,
  noun,
  onCancel,
  onReview
}: {
  visible: boolean;
  count: number;
  noun: string;
  onCancel: () => void;
  onReview: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.42)", justifyContent: "center", padding: 26 }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 24, gap: 18 }}>
          <View style={{ gap: 8 }}>
            <Text selectable style={{ color: theme.text, fontSize: 25, fontWeight: "900" }}>
              {t("swipe.deleteMarkedFirst")}
            </Text>
            <Text selectable style={{ color: theme.muted, fontSize: 16, lineHeight: 23 }}>
              {t("swipe.deleteMarkedMessage", { count, noun })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12, justifyContent: "flex-end" }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("swipe.cancelStartOver")} onPress={onCancel} style={{ paddingVertical: 14, paddingHorizontal: 18 }}>
              <Text style={{ color: theme.muted, fontSize: 16, fontWeight: "800" }}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("swipe.reviewDeleteList")}
              onPress={onReview}
              style={{ paddingVertical: 14, paddingHorizontal: 18, backgroundColor: theme.accent, borderRadius: 14 }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("swipe.reviewDeleteList")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type CompletedSelectionStateProps = {
  title: string;
  message: string;
  pendingDeleteCount: number;
  nextMonthLabel?: string;
  onReviewDelete: () => void;
  onStartOver: () => void;
  onNextMonth: () => void;
};

function CompletedSelectionState({
  title,
  message,
  pendingDeleteCount,
  nextMonthLabel,
  onReviewDelete,
  onStartOver,
  onNextMonth
}: CompletedSelectionStateProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const hasPendingDeletes = pendingDeleteCount > 0;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 12 }}>
      <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: theme.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
        <CheckCircle2 size={36} color={theme.accent} />
      </View>
      <View style={{ gap: 8, alignItems: "center" }}>
        <Text selectable style={{ color: theme.text, fontSize: 25, fontWeight: "900", textAlign: "center" }}>
          {title}
        </Text>
        <Text selectable style={{ color: theme.muted, fontSize: 16, lineHeight: 23, textAlign: "center" }}>
          {message}
        </Text>
      </View>
      <View style={{ width: "100%", gap: 10, paddingTop: 4 }}>
        {hasPendingDeletes ? (
          <CompletionButton label={t("swipe.reviewDeleteListCount", { count: pendingDeleteCount })} tone="primary" icon="trash" onPress={onReviewDelete} />
        ) : null}
        <CompletionButton label={t("swipe.startOver")} tone={hasPendingDeletes ? "secondary" : "primary"} icon="restart" onPress={onStartOver} />
        <CompletionButton
          label={nextMonthLabel ? t("swipe.nextMonth", { month: nextMonthLabel }) : t("swipe.chooseMonth")}
          tone="secondary"
          icon="next"
          onPress={onNextMonth}
        />
      </View>
    </View>
  );
}

function CompletionButton({
  label,
  tone,
  icon,
  onPress
}: {
  label: string;
  tone: "primary" | "secondary";
  icon: "trash" | "restart" | "next";
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const isPrimary = tone === "primary";
  const color = isPrimary ? "#fff" : theme.text;
  const Icon = icon === "trash" ? Trash2 : icon === "restart" ? RotateCcw : ArrowRight;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 52,
        borderRadius: 14,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 9,
        backgroundColor: isPrimary ? theme.accent : theme.surfaceStrong,
        borderWidth: isPrimary ? 0 : 1,
        borderColor: theme.border
      }}
    >
      <Icon size={19} color={color} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color, fontSize: 16, fontWeight: "900" }}>
        {label}
      </Text>
    </Pressable>
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
