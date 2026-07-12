import { router } from "expo-router";
import { ArrowLeft, ExternalLink } from "lucide-react-native";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";

const SUPPORT_EMAIL = "info.cognitix@gmail.com";

// Third-party components bundled in the app. Names and SPDX identifiers are
// proper nouns and are intentionally not localized. LAME is handled separately
// because its LGPL terms require an explicit source offer (see the screen body).
const COMPONENTS: { name: string; license: string }[] = [
  { name: "React Native", license: "MIT" },
  { name: "React", license: "MIT" },
  { name: "Expo SDK & modules", license: "MIT" },
  { name: "Zustand", license: "MIT" },
  { name: "react-native-reanimated", license: "MIT" },
  { name: "react-native-gesture-handler", license: "MIT" },
  { name: "react-native-google-mobile-ads", license: "Apache-2.0" },
  { name: "react-native-purchases (RevenueCat)", license: "MIT" },
  { name: "react-native-compressor", license: "MIT" },
  { name: "lucide-react-native", license: "ISC" },
  { name: "jpeg-js", license: "BSD-3-Clause" }
];

export function LicensesScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const requestSource = async () => {
    const subject = "SwipeClean — LAME (LGPL) source request";
    const body =
      "Hi Cognitix,\n\nPlease send me the corresponding source for the LGPL-licensed LAME library included in SwipeClean.\n\n" +
      `Device: ${Platform.OS} ${String(Platform.Version)}`;
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(mailto);
    } catch {
      Alert.alert(t("settings.supportEmailUnavailableTitle"), t("settings.supportEmailUnavailableMessage"));
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 16, gap: 18, paddingBottom: insets.bottom + 28 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }} accessibilityRole="button" accessibilityLabel={t("common.cancel")}>
          <ArrowLeft size={26} color={theme.text} />
        </Pressable>
        <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>
          {t("licenses.title")}
        </Text>
        <View style={{ width: 34 }} />
      </View>

      <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 21 }}>
        {t("licenses.intro")}
      </Text>

      {/* LAME / LGPL — explicit attribution + written offer for the library source. */}
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 16,
          gap: 12
        }}
      >
        <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}>
          {t("licenses.lgplHeading")}
        </Text>
        <Text selectable style={{ color: theme.muted, fontSize: 13.5, lineHeight: 20 }}>
          {t("licenses.lgplBody")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("licenses.requestSource")}
          onPress={() => void requestSource()}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 46,
            borderRadius: 12,
            backgroundColor: pressed ? theme.surfaceStrong : theme.surfaceSoft,
            borderWidth: 1,
            borderColor: theme.accent
          })}
        >
          <ExternalLink size={18} color={theme.accent} />
          <Text style={{ color: theme.accent, fontSize: 14.5, fontWeight: "900" }}>{t("licenses.requestSource")}</Text>
        </Pressable>
      </View>

      <View style={{ gap: 6 }}>
        <Text selectable style={{ color: theme.text, fontSize: 15, fontWeight: "900", paddingHorizontal: 2 }}>
          {t("licenses.componentsHeading")}
        </Text>
        <View style={{ backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
          {COMPONENTS.map((component, index) => (
            <View
              key={component.name}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: theme.border
              }}
            >
              <Text selectable style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: "700" }}>
                {component.name}
              </Text>
              <Text selectable style={{ color: theme.muted, fontSize: 12.5, fontWeight: "800" }}>
                {component.license}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
