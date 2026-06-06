import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
import { formatBytes, sumBytes } from "@/utils/format";
import { filterMarkedItemsByScope, getMediaTypeNoun } from "@/utils/months";

export function ReviewDeleteButton() {
  const theme = useAppTheme();
  const allMarked = useAppStore((state) => state.markedForDeletion);
  const photos = useAppStore((state) => state.photos);
  const selectedMonthKey = useAppStore((state) => state.selectedMonthKey);
  const selectedMediaType = useAppStore((state) => state.selectedMediaType);
  const marked = filterMarkedItemsByScope(allMarked, selectedMonthKey, selectedMediaType, photos);
  const count = marked.length;

  if (count === 0) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        padding: 18,
        borderRadius: 22,
        backgroundColor: theme.surfaceSoft,
        borderWidth: 1,
        borderColor: theme.border
      }}
    >
      <View style={{ flexShrink: 1 }}>
        <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>
          {count} {getMediaTypeNoun(selectedMediaType, count)} marked
        </Text>
        <Text selectable style={{ color: theme.muted, fontSize: 17 }}>
          {formatBytes(sumBytes(marked))} ready to clear
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/review-delete-list")}
        style={{
          backgroundColor: theme.accent,
          minHeight: 64,
          borderRadius: 17,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
          flexShrink: 0
        }}
      >
        <Text selectable style={{ color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center" }}>
          Review Delete List ({count})
        </Text>
      </Pressable>
    </View>
  );
}
