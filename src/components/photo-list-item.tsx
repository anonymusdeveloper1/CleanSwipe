import { CheckCircle2, Heart, Trash2 } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { CachedImage } from "@/components/cached-image";
import { PhotoAsset } from "@/models/photo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatBytes, formatResolution } from "@/utils/format";
import { formatDate } from "@/utils/date";

type Props = {
  photo: PhotoAsset;
  selected?: boolean;
  onKeep?: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
};

export function PhotoListItem({ photo, selected, onKeep, onDelete, onOpen }: Props) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onOpen}
      style={{
        overflow: "hidden",
        borderRadius: 15,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border
      }}
    >
      <View style={{ aspectRatio: 1.9, backgroundColor: theme.surfaceStrong }}>
        <CachedImage uri={photo.uri} contentFit="contain" backgroundColor={theme.surfaceStrong} style={{ flex: 1 }} />
        <View style={{ position: "absolute", right: 14, top: 14, borderRadius: 18, backgroundColor: theme.surface }}>
          <CheckCircle2 size={30} color={selected ? theme.accent : theme.faint} fill={selected ? theme.surfaceSoft : theme.surface} />
        </View>
      </View>
      <View style={{ padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <Text selectable style={{ color: theme.text, fontSize: 24, fontWeight: "900" }}>
            {formatBytes(photo.sizeBytes)}
          </Text>
          <Text selectable numberOfLines={1} style={{ color: theme.text, fontSize: 15 }}>
            {formatDate(photo.creationTime)} • {formatResolution(photo.width, photo.height)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable onPress={onKeep} style={{ padding: 12, borderRadius: 14, backgroundColor: theme.surfaceSoft }}>
            <Heart size={24} color={theme.green} />
          </Pressable>
          <Pressable onPress={onDelete} style={{ padding: 12, borderRadius: 14, backgroundColor: "#fff1f1" }}>
            <Trash2 size={24} color={theme.red} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
