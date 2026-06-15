import { RotateCcw } from "lucide-react-native";
import { memo } from "react";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { MediaThumbnail } from "@/components/media-thumbnail";
import { MarkedForDeletionItem } from "@/models/photo";
import { useAppTheme } from "@/hooks/use-app-theme";

export const PHOTO_GRID_COLUMNS = 3;
export const PHOTO_GRID_GAP = 12;

// The review screen pads its content 16 on each side (total horizontal 32).
// Keep this in sync with `ReviewDeleteListScreen`'s contentContainer padding.
export function getPhotoTileSize(width: number) {
  return Math.floor((width - 32 - PHOTO_GRID_GAP * (PHOTO_GRID_COLUMNS - 1)) / PHOTO_GRID_COLUMNS);
}

type PhotoTileProps = {
  item: MarkedForDeletionItem;
  size: number;
  onRestore: (photoId: string) => void;
  onOpen?: (photoId: string) => void;
};

/**
 * A single marked-for-deletion thumbnail tile with a restore button.
 *
 * Memoized so that paginating/scrolling the review list (which appends rows)
 * does not re-render tiles that are already mounted. Callers MUST pass stable
 * `onRestore`/`onOpen` references (e.g. zustand actions or `useCallback`) for
 * the memo to be effective.
 */
export const PhotoTile = memo(function PhotoTile({ item, size, onRestore, onOpen }: PhotoTileProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => onOpen?.(item.photoId)}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: theme.surfaceStrong,
        borderWidth: 1,
        borderColor: theme.border
      }}
    >
      <MediaThumbnail uri={item.uri} id={item.photoId} mediaType={item.mediaType} contentFit="cover" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
      <Pressable
        accessibilityLabel={t("reviewDelete.restorePhoto")}
        onPress={() => onRestore(item.photoId)}
        hitSlop={6}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: theme.surface,
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 10px rgba(0,0,0,0.16)"
        }}
      >
        <RotateCcw size={15} color={theme.accent} />
      </Pressable>
    </Pressable>
  );
});
