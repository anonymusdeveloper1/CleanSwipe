import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";
import { ConvertScreen } from "@/screens/convert-screen";
import { SmartCleanScreen } from "@/screens/smart-clean-screen";
import { useAppTheme } from "@/hooks/use-app-theme";

type StudioMode = "clean" | "convert";

/**
 * Pro "Studio" tab (tab 4 when subscribed) — hosts Smart Clean and the media
 * format Converter behind one shared brand header + a [ Clean | Convert ]
 * segmented control. Free users never reach this screen: premium-screen.tsx
 * renders the paywall for them, which keeps Convert Pro-gated.
 *
 * The brand AppHeader lives here (not in the child bodies) so the toggle sits
 * directly under it; SmartCleanScreen is rendered with `showHeader={false}` to
 * avoid a doubled header.
 */
export function StudioScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<StudioMode>("clean");

  const options: { key: StudioMode; label: string }[] = [
    { key: "clean", label: t("studio.clean") },
    { key: "convert", label: t("studio.convert") }
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader />
      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <View
          accessibilityRole="tablist"
          style={{ minHeight: 44, borderRadius: 22, padding: 4, backgroundColor: theme.surfaceStrong, flexDirection: "row", gap: 4 }}
        >
          {options.map((option) => {
            const active = mode === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setMode(option.key)}
                style={{ flex: 1, minHeight: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: active ? theme.surface : "transparent" }}
              >
                <Text style={{ color: active ? theme.accent : theme.muted, fontSize: 15, fontWeight: "900" }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {mode === "clean" ? <SmartCleanScreen showHeader={false} /> : <ConvertScreen />}
      </View>
    </View>
  );
}
