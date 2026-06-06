import { router } from "expo-router";
import { ArrowLeft, Images, Trash2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { EmptyState } from "@/components/empty-state";
import { PhotoGrid } from "@/components/photo-grid";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MarkedForDeletionItem } from "@/models/photo";
import { useAppStore } from "@/store/app-store";
import { monthLabel } from "@/utils/date";
import { formatBytes, sumBytes } from "@/utils/format";
import { filterMarkedItemsByScope, getMarkedItemMonthKey, getMediaTypeNoun } from "@/utils/months";

export function ReviewDeleteListScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const allMarked = useAppStore((state) => state.markedForDeletion);
  const selectedMonthKey = useAppStore((state) => state.selectedMonthKey);
  const selectedMediaType = useAppStore((state) => state.selectedMediaType);
  const photos = useAppStore((state) => state.photos);
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
      Alert.alert("Cleanup complete", `${formatBytes(result.clearedBytes)} cleared\n${result.deletedCount} ${getMediaTypeNoun(selectedMediaType, result.deletedCount)} deleted`);
    } catch (error) {
      Alert.alert("Deletion failed", error instanceof Error ? error.message : "Your marked photos are still safe.");
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: insets.top + 16, gap: 24, paddingBottom: 120 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
          <ArrowLeft size={32} color={theme.text} />
        </Pressable>
        <Text selectable style={{ color: theme.accent, fontSize: 28, fontWeight: "900" }}>
          Marked for Deletion
        </Text>
        <View style={{ width: 48 }} />
      </View>
      {marked.length > 0 ? (
        <>
          <View style={{ backgroundColor: theme.surfaceSoft, borderRadius: 20, padding: 26, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text selectable style={{ color: theme.text, fontSize: 30, fontWeight: "900" }}>
                {marked.length} {getMediaTypeNoun(selectedMediaType, marked.length)}
              </Text>
              <Text selectable style={{ color: theme.muted, fontSize: 21 }}>
                {formatBytes(totalBytes)} selected
              </Text>
            </View>
            <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: "#ffd8d5", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={30} color={theme.red} />
            </View>
          </View>
          <View style={{ gap: 24 }}>
            {groups.map((group) => (
              <View key={group.key} style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <View>
                    <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>
                      {group.label}
                    </Text>
                    <Text selectable style={{ color: theme.muted, fontSize: 15 }}>
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
        <EmptyState icon={Images} title={`No ${getMediaTypeNoun(selectedMediaType)} marked for deletion.`} message={`Swipe left on ${getMediaTypeNoun(selectedMediaType)} to queue them here before permanent deletion.`} />
      )}
      {marked.length > 0 ? (
        <Pressable
          onPress={() => setConfirmVisible(true)}
          style={{ marginTop: 30, backgroundColor: "#c9171d", borderRadius: 18, minHeight: 78, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 12 }}
        >
          <Trash2 size={26} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>Delete Selected {getMediaTypeNoun(selectedMediaType)} ({marked.length})</Text>
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
