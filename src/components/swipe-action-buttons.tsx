import { Heart, RotateCcw, Star, Trash2 } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { SwipeAction } from "@/models/photo";

type Props = {
  onAction: (action: SwipeAction) => void;
  onUndo: () => void;
};

export function SwipeActionButtons({ onAction, onUndo }: Props) {
  const theme = useAppTheme();
  const actions = [
    { label: "Undo", icon: RotateCcw, color: theme.muted, onPress: onUndo, size: 58 },
    { label: "Delete", icon: Trash2, color: theme.red, onPress: () => onAction("delete"), size: 74 },
    { label: "Keep", icon: Heart, color: theme.green, onPress: () => onAction("keep"), size: 74 },
    { label: "Favorite", icon: Star, color: theme.yellow, onPress: () => onAction("superLike"), size: 58 }
  ];

  return (
    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 18 }}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Pressable
            key={action.label}
            accessibilityLabel={action.label}
            accessibilityRole="button"
            onPress={action.onPress}
            style={{
              width: action.size,
              height: action.size,
              borderRadius: action.size / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.surfaceSoft,
              boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)"
            }}
          >
            <Icon size={action.size > 60 ? 32 : 27} color={action.color} strokeWidth={2.4} />
          </Pressable>
        );
      })}
    </View>
  );
}
