import { router } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import { Pressable, Text } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
import { filterPhotosByMediaType, getMediaTypeAllLabel, groupPhotosByMonth } from "@/utils/months";

export function MonthSelector() {
  const theme = useAppTheme();
  const photos = useAppStore((state) => state.photos);
  const selectedMonthKey = useAppStore((state) => state.selectedMonthKey);
  const selectedMediaType = useAppStore((state) => state.selectedMediaType);
  const scopedPhotos = filterPhotosByMediaType(photos, selectedMediaType);
  const label = groupPhotosByMonth(scopedPhotos, getMediaTypeAllLabel(selectedMediaType)).find((month) => month.key === selectedMonthKey)?.label ?? getMediaTypeAllLabel(selectedMediaType);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Select month"
      onPress={() => router.push("/month-selector")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backgroundColor: theme.surfaceStrong,
        paddingHorizontal: 16,
        minHeight: 46,
        borderRadius: 23,
        flex: 1
      }}
    >
      <Text selectable numberOfLines={1} style={{ color: theme.text, fontSize: 16, fontWeight: "800", letterSpacing: 0, flexShrink: 1 }}>
        {label}
      </Text>
      <ChevronDown size={18} color={theme.text} />
    </Pressable>
  );
}
