import { router } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePaywallStore } from "@/store/paywall-store";
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "@/config/contact";

/**
 * Global paywall / upgrade prompt. Mounted once in the root layout; opened from
 * anywhere via `usePaywallStore.getState().open(featureKey)` (or the hook).
 *
 * It explains what the gated feature does and offers:
 *   - Upgrade to Pro  -> navigates to the subscription screen (Premium tab)
 *   - Maybe Later     -> dismisses
 *
 * Purchases happen on the Premium tab through RevenueCat; this sheet only
 * routes there.
 */
export function ProUpgradeSheet() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const featureKey = usePaywallStore((state) => state.featureKey);
  const close = usePaywallStore((state) => state.close);

  const visible = Boolean(featureKey);
  // Per-feature explanation falls back to a generic message for any feature
  // that doesn't have a dedicated string yet.
  const message = featureKey ? t(`paywall.${featureKey}`, { defaultValue: t("paywall.genericMessage") }) : "";

  const handleUpgrade = () => {
    close();
    router.navigate("/premium");
  };

  const openLegalUrl = (url: string) => {
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={close}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("paywall.maybeLater")} onPress={close} style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", padding: 26 }}>
        {/* Inner pressable stops backdrop taps from closing when interacting with the card. */}
        <Pressable onPress={() => undefined} style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 24, gap: 18, borderWidth: 1, borderColor: theme.border }}>
          <View style={{ alignItems: "center", gap: 14 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={30} color="#fff" />
            </View>
            <View style={{ gap: 8 }}>
              <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900", textAlign: "center" }}>
                {t("paywall.title")}
              </Text>
              <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 22, textAlign: "center" }}>
                {message}
              </Text>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("paywall.upgrade")}
              onPress={handleUpgrade}
              style={{ minHeight: 52, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("paywall.upgrade")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("paywall.maybeLater")}
              onPress={close}
              style={{ minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: theme.muted, fontSize: 16, fontWeight: "800" }}>{t("paywall.maybeLater")}</Text>
            </Pressable>
          </View>
          <View style={{ gap: 8, alignItems: "center" }}>
            <Text selectable style={{ color: theme.muted, fontSize: 11, lineHeight: 16, textAlign: "center" }}>
              {t("subscription.billingDisclaimer")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
              <Pressable accessibilityRole="link" accessibilityLabel={t("subscription.termsOfUse")} onPress={() => openLegalUrl(TERMS_OF_USE_URL)} hitSlop={8}>
                <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" }}>
                  {t("subscription.termsOfUse")}
                </Text>
              </Pressable>
              <Text style={{ color: theme.muted, fontSize: 12, marginHorizontal: 8 }}>·</Text>
              <Pressable accessibilityRole="link" accessibilityLabel={t("settings.privacyPolicy")} onPress={() => openLegalUrl(PRIVACY_POLICY_URL)} hitSlop={8}>
                <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" }}>
                  {t("settings.privacyPolicy")}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
