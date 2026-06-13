import { router } from "expo-router";
import { ArrowLeft, Images, Trash2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { EmptyState } from "@/components/empty-state";
import { InterstitialAdService } from "@/features/ads/interstitial.service";
import { PhotoGrid } from "@/components/photo-grid";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MarkedForDeletionItem } from "@/models/photo";
import { useAppStore } from "@/store/app-store";
import { useIndexedMediaAssets } from "@/store/media-index-store";
import { monthLabel } from "@/utils/date";
import { formatBytes, sumBytes } from "@/utils/format";
import { filterMarkedItemsByScope, getMarkedItemMonthKey, getMediaTypeNoun } from "@/utils/months";

export function ReviewDeleteListScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const allMarked = useAppStore((state) => state.markedForDeletion);
  const selectedMonthKey = useAppStore((state) => state.selectedMonthKey);
  const selectedMediaType = useAppStore((state) => state.selectedMediaType);
  const photos = useIndexedMediaAssets();
  const restore = useAppStore((state) => state.restoreMarkedPhoto);
  const deleteMarked = useAppStore((state) => state.permanentlyDeleteMarked);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const marked = useMemo(
    () => filterMarkedItemsByScope(allMarked, selectedMonthKey, selectedMediaType, photos),
    [allMarked, photos, selectedMediaType, selectedMonthKey]
  );
  const totalBytes = sumBytes(marked);
  const groups = useMemo(() => groupMarkedItemsByMonth(marked), [marked]);

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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, gap: 16, paddingBottom: 120 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
          <ArrowLeft size={24} color={theme.text} />
        </Pressable>
        <Text selectable style={{ color: theme.accent, fontSize: 20, fontWeight: "900" }}>
          {t("reviewDelete.heading")}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      {marked.length > 0 ? (
        <>
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
          <View style={{ gap: 16 }}>
            {groups.map((group) => (
              <View key={group.key} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <View>
                    <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}>
                      {group.label}
                    </Text>
                    <Text selectable style={{ color: theme.muted, fontSize: 12 }}>
                      {group.items.length} {getMediaTypeNoun(selectedMediaType, group.items.length)} - {formatBytes(sumBytes(group.items))}
                    </Text>
                  </View>
                </View>
                <PhotoGrid items={group.items} onRestore={restore} onOpen={(photoId) => router.push({ pathname: "/photo-preview", params: { id: photoId } })} />
              </View>
            ))}
          </View>
        </>
      ) : (
        <EmptyState icon={Images} title={t("reviewDelete.emptyStateTitle", { mediaType: getMediaTypeNoun(selectedMediaType) })} message={t("reviewDelete.emptyStateMessage", { mediaType: getMediaTypeNoun(selectedMediaType) })} />
      )}
      {marked.length > 0 ? (
        <Pressable
          onPress={() => setConfirmVisible(true)}
          style={{
            marginTop: 16,
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
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
            {t("reviewDelete.deleteSelectedButton", { count: marked.length })}
          </Text>
        </Pressable>
      ) : null}
      <DeleteConfirmationDialog visible={confirmVisible} onCancel={() => setConfirmVisible(false)} onConfirm={confirmDelete} />
    </ScrollView>
  );
}

type MarkedMonthGroup = {
  key: string;
  label: string;
  items: MarkedForDeletionItem[];
};

function groupMarkedItemsByMonth(items: MarkedForDeletionItem[]): MarkedMonthGroup[] {
  const map = new Map<string, MarkedForDeletionItem[]>();
  for (const item of items) {
    const key = getMarkedItemMonthKey(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }

  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, groupItems]) => ({
      key,
      label: monthLabel(key),
      items: groupItems
    }));
}
