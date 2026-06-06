import { LinearGradient } from "expo-linear-gradient";
import { Check, Star } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  onPress: () => void;
  compact?: boolean;
};

export function PremiumCard({ onPress, compact = false }: Props) {
  const theme = useAppTheme();
  return (
    <LinearGradient
      colors={[theme.accent, "#2d7df0"]}
      style={{ width: "100%", borderRadius: 18, padding: compact ? 18 : 22, gap: 16, boxShadow: "0 16px 32px rgba(7, 94, 200, 0.22)" }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
            <Star size={21} color="#fff" fill="#fff" />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text selectable numberOfLines={1} style={{ color: "#fff", fontSize: compact ? 20 : 24, fontWeight: "900" }}>
              SwipeClean Pro
            </Text>
            <Text selectable numberOfLines={1} style={{ color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "700" }}>
              One-time app upgrade
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor: "#6ee7b7", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text selectable style={{ color: "#065f46", fontSize: 11, fontWeight: "900", letterSpacing: 0 }}>
            SOON
          </Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {["No ads while cleaning", "Advanced storage stats", "Faster batch cleanup tools"].map((item) => (
          <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Check size={17} color="#d1fae5" strokeWidth={3} />
            <Text selectable style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 19, fontWeight: "700", flexShrink: 1 }}>
              {item}
            </Text>
          </View>
        ))}
      </View>
      <Pressable onPress={onPress} style={{ marginTop: 2, backgroundColor: "#fff", minHeight: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.accent, fontSize: 17, fontWeight: "900" }}>
          Get SwipeClean Pro
        </Text>
      </Pressable>
    </LinearGradient>
  );
}
