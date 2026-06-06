import { router } from "expo-router";
import { ArrowLeft, BarChart3, Bell, Bug, Check, ChevronRight, Fingerprint, Languages, Lock, Moon, Palette, Shield, Star, ToggleLeft } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdBanner } from "@/components/ad-banner";
import { SettingsRow } from "@/components/settings-row";
import { SettingsSection } from "@/components/settings-section";
import { accentColors } from "@/theme/colors";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";

export function SettingsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const settings = useAppStore((state) => state.settings);
  const update = useAppStore((state) => state.updateSetting);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 20, gap: 26, paddingBottom: 30 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <ArrowLeft size={26} color={theme.text} />
        </Pressable>
        <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>Settings</Text>
        <Check size={24} color={theme.accent} />
      </View>
      <SettingsSection title="Account & Security">
        <SettingsRow icon={Fingerprint} title="Biometric Auth" subtitle="Use FaceID or TouchID" value={settings.biometricAuthEnabled} onValueChange={(value) => update("biometricAuthEnabled", value)} />
        <SettingsRow icon={Lock} title="App Lock" subtitle="Require passcode on start" value={settings.appLockEnabled} onValueChange={(value) => update("appLockEnabled", value)} />
      </SettingsSection>
      <SettingsSection title="Appearance">
        <SettingsRow icon={Moon} title="Dark Mode" subtitle="Toggle light/dark theme" value={settings.darkModeEnabled} onValueChange={(value) => update("darkModeEnabled", value)} />
        <SettingsRow icon={Palette} title="Accent Color">
          <View style={{ flexDirection: "row", gap: 12, paddingTop: 12 }}>
            {Object.entries(accentColors).map(([name, color]) => (
              <Pressable
                key={name}
                accessibilityLabel={`${name} accent color`}
                onPress={() => update("accentColor", name as typeof settings.accentColor)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: color,
                  borderWidth: settings.accentColor === name ? 3 : 0,
                  borderColor: theme.surface
                }}
              />
            ))}
          </View>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="Language">
        <SettingsRow icon={Languages} title="Language" subtitle="English" onPress={() => undefined}>
          <ChevronRight size={20} color={theme.muted} />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="Notifications">
        <SettingsRow icon={Bell} title="Allow Notifications" subtitle="App updates and reminders" value={settings.notificationsEnabled} onValueChange={(value) => update("notificationsEnabled", value)} />
        <SettingsRow icon={Bell} title="Cleanup reminders" subtitle="Daily nudge to swipe photos" value={settings.cleanupRemindersEnabled} onValueChange={(value) => update("cleanupRemindersEnabled", value)} />
      </SettingsSection>
      <SettingsSection title="Support">
        <SettingsRow icon={Star} title="Upgrade to Premium" subtitle="Unlock all features" onPress={() => router.push("/premium") as never} />
        <SettingsRow icon={ToggleLeft} title="Leave Feedback" onPress={() => undefined} />
        <SettingsRow icon={Bug} title="Report a Bug" onPress={() => undefined} />
        <SettingsRow icon={Shield} title="Privacy Policy" onPress={() => undefined} />
      </SettingsSection>
      <SettingsSection title="Privacy">
        <SettingsRow icon={BarChart3} title="Analytics Collection" value={settings.analyticsCollectionEnabled} onValueChange={(value) => update("analyticsCollectionEnabled", value)} />
        <SettingsRow icon={BarChart3} title="Usage Data Collection" value={settings.usageDataCollectionEnabled} onValueChange={(value) => update("usageDataCollectionEnabled", value)} />
        <SettingsRow icon={Bug} title="Error Reporting" value={settings.errorReportingEnabled} onValueChange={(value) => update("errorReportingEnabled", value)} />
      </SettingsSection>
      <AdBanner />
      <Text selectable style={{ color: theme.faint, textAlign: "center", fontWeight: "700" }}>
        SwipeClean Free v0.1.0
      </Text>
    </ScrollView>
  );
}
