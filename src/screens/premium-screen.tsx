import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BarChart3, Check, Crown, RotateCcw, ShieldOff, Sparkles, Video, Wand2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import Animated, { Easing, FadeInDown, FadeInRight, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { AdBanner } from "@/components/ad-banner";
import { AppHeader } from "@/components/app-header";
import { SmartCleanScreen } from "@/screens/smart-clean-screen";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSubscriptionStore } from "@/store/subscription-store";

type PaidPlan = "monthly" | "yearly";

/** Add an alpha channel to a `#rgb`/`#rrggbb` accent color for soft tints. */
function hexToRgba(hex: string, alpha: number) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  let h = match[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Subscription / Upgrade screen (the Premium tab).
 *
 * Free users see an animated Pro upsell; Pro users get Smart Clean in this tab.
 */
export function PremiumScreen() {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const { isPro } = useFeatureAccess();
  // Pro users get Smart Clean in this tab (it renders its own AppHeader, so we
  // return it directly to avoid a doubled header). Free users see the upsell.
  if (isPro) {
    return <SmartCleanScreen />;
  }
  const horizontalPadding = width < 380 ? 18 : 22;
  const contentWidth = Math.min(width - horizontalPadding * 2, 680);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingBottom: 28 }}>
      <AppHeader />
      <View style={{ width: contentWidth, alignSelf: "center", gap: 16 }}>
        <UpgradeView />
        <AdBanner />
      </View>
    </ScrollView>
  );
}

function UpgradeView() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const initializeBilling = useSubscriptionStore((state) => state.initializeBilling);
  const purchasePlan = useSubscriptionStore((state) => state.purchasePlan);
  const restorePurchases = useSubscriptionStore((state) => state.restorePurchases);
  const plans = useSubscriptionStore((state) => state.plans);
  const offeringsLoading = useSubscriptionStore((state) => state.offeringsLoading);
  const purchaseInProgress = useSubscriptionStore((state) => state.purchaseInProgress);
  const billingError = useSubscriptionStore((state) => state.billingError);
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan>("yearly");

  useEffect(() => {
    void initializeBilling();
  }, [initializeBilling]);

  // Looping halo behind the crown + a subtle CTA breathing pulse.
  const glow = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) }), -1, true);
    pulse.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [glow, pulse]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.22 + glow.value * 0.4, transform: [{ scale: 1 + glow.value * 0.24 }] }));
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.018 }] }));

  const proFeatures = [
    { icon: Wand2, label: t("subscription.pro.smartClean") },
    { icon: Video, label: t("subscription.pro.videoCompression") },
    { icon: Sparkles, label: t("subscription.pro.advancedCompression") },
    { icon: BarChart3, label: t("subscription.pro.advancedStats") },
    { icon: ShieldOff, label: t("subscription.pro.noAds") }
  ];

  // Keep RevenueCat errors user-readable without leaking configuration details.
  const formatBillingError = (message?: string) => {
    if (!message) return t("subscription.purchaseFailedMessage");
    return message.includes("not configured") ? t("subscription.billingNotConfigured") : message;
  };

  const handleStart = async (plan: PaidPlan) => {
    try {
      const snapshot = await purchasePlan(plan);
      if (snapshot.isPro) {
        Alert.alert(t("subscription.purchaseSuccessTitle"), t("subscription.purchaseSuccessMessage"));
      }
    } catch (error) {
      Alert.alert(t("subscription.purchaseFailedTitle"), formatBillingError(error instanceof Error ? error.message : billingError));
    }
  };

  const handleRestore = () => {
    void (async () => {
      try {
        const snapshot = await restorePurchases();
        if (snapshot.isPro) {
          Alert.alert(t("subscription.restoreSuccessTitle"), t("subscription.restoreSuccessMessage"));
        } else {
          Alert.alert(t("subscription.restoredTitle"), t("subscription.restoredMessage"));
        }
      } catch (error) {
        Alert.alert(t("subscription.restoreFailedTitle"), formatBillingError(error instanceof Error ? error.message : billingError));
      }
    })();
  };

  const priceFor = (plan: PaidPlan) =>
    plans[plan]?.priceString ?? (offeringsLoading ? t("subscription.loadingPlans") : t("subscription.plansUnavailable"));
  const displayError = billingError?.includes("not configured") ? t("subscription.billingNotConfigured") : billingError;
  const selectedAvailable = Boolean(plans[selectedPlan]);

  return (
    <View style={{ gap: 16 }}>
      {/* Hero */}
      <Animated.View entering={FadeInDown.duration(450)} style={{ alignItems: "center", gap: 12, paddingTop: 6 }}>
        <View style={{ width: 100, height: 100, alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={[{ position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: theme.accent }, haloStyle]} />
          <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", boxShadow: `0 12px 30px ${hexToRgba(theme.accent, 0.4)}` }}>
            <Crown size={38} color="#fff" fill="#fff" />
          </View>
        </View>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text selectable style={{ color: theme.text, fontSize: 30, lineHeight: 35, fontWeight: "900", textAlign: "center" }}>
            {t("premium.title")}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 21, textAlign: "center", maxWidth: 460 }}>
            {t("premium.subtitle")}
          </Text>
        </View>
      </Animated.View>

      {/* What's included — compact Pro feature showcase */}
      <Animated.View
        entering={FadeInDown.delay(110).duration(450)}
        style={{ borderRadius: 18, borderWidth: 1.5, borderColor: theme.accent, backgroundColor: theme.surface, overflow: "hidden" }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: hexToRgba(theme.accent, 0.12) }}>
          <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: "900" }}>{t("premium.included")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: theme.accent, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4 }}>
            <Crown size={12} color="#fff" fill="#fff" />
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }}>{t("subscription.proTitle").toUpperCase()}</Text>
          </View>
        </View>
        <View style={{ padding: 14, gap: 10 }}>
          {proFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Animated.View key={feature.label} entering={FadeInRight.delay(220 + index * 70).duration(360)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: hexToRgba(theme.accent, 0.12), alignItems: "center", justifyContent: "center" }}>
                  <Icon size={19} color={theme.accent} />
                </View>
                <Text selectable style={{ flex: 1, color: theme.text, fontSize: 15, fontWeight: "800" }}>{feature.label}</Text>
                <Check size={18} color={theme.green} strokeWidth={3} />
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>

      {/* Plan selection */}
      <Animated.View entering={FadeInUp.delay(170).duration(450)} style={{ gap: 10 }}>
        <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>{t("subscription.choosePlan")}</Text>
        <PlanCard
          title={t("subscription.yearlyTitle")}
          price={priceFor("yearly")}
          badge={t("subscription.yearlyBadge")}
          selected={selectedPlan === "yearly"}
          disabled={!plans.yearly}
          onPress={() => setSelectedPlan("yearly")}
        />
        <PlanCard
          title={t("subscription.monthlyTitle")}
          price={priceFor("monthly")}
          selected={selectedPlan === "monthly"}
          disabled={!plans.monthly}
          onPress={() => setSelectedPlan("monthly")}
        />
        {displayError ? (
          <Text selectable style={{ color: theme.red, fontSize: 13, lineHeight: 18, fontWeight: "700" }}>
            {displayError}
          </Text>
        ) : null}
      </Animated.View>

      {/* CTA */}
      <Animated.View entering={FadeInUp.delay(240).duration(450)} style={ctaStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selectedPlan === "yearly" ? t("subscription.startYearly") : t("subscription.startMonthly")}
          disabled={purchaseInProgress || !selectedAvailable}
          onPress={() => void handleStart(selectedPlan)}
          style={{ borderRadius: 16, overflow: "hidden", opacity: purchaseInProgress || !selectedAvailable ? 0.7 : 1, boxShadow: `0 14px 30px ${hexToRgba(theme.accent, 0.34)}` }}
        >
          <View style={{ minHeight: 58, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}>
            {/* Glossy top highlight for a livelier button. */}
            <LinearGradient colors={["rgba(255,255,255,0.24)", "rgba(255,255,255,0)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 29 }} />
            {purchaseInProgress ? <ActivityIndicator color="#fff" /> : <Crown size={20} color="#fff" fill="#fff" />}
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
              {purchaseInProgress ? t("subscription.processing") : selectedPlan === "yearly" ? t("subscription.startYearly") : t("subscription.startMonthly")}
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("subscription.restore")}
        disabled={purchaseInProgress}
        onPress={handleRestore}
        style={{ minHeight: 44, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: purchaseInProgress ? 0.55 : 1 }}
      >
        <RotateCcw size={17} color={theme.accent} />
        <Text style={{ color: theme.accent, fontSize: 15, fontWeight: "900" }}>{t("subscription.restore")}</Text>
      </Pressable>

      <Text selectable style={{ color: theme.faint, fontSize: 12, lineHeight: 17, textAlign: "center" }}>
        {t("subscription.billingDisclaimer")}
      </Text>
    </View>
  );
}

function PlanCard({
  title,
  price,
  badge,
  selected,
  disabled = false,
  onPress
}: {
  title: string;
  price: string;
  badge?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 14,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.accent : theme.border,
        backgroundColor: selected ? hexToRgba(theme.accent, 0.07) : theme.surface,
        paddingHorizontal: 14,
        paddingVertical: 14,
        opacity: disabled ? 0.55 : 1
      }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? theme.accent : theme.border, alignItems: "center", justifyContent: "center" }}>
        {selected ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: theme.accent }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: "900" }}>{title}</Text>
          {badge ? (
            <View style={{ backgroundColor: "#6ee7b7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: "#065f46", fontSize: 10, fontWeight: "900", letterSpacing: 0.3 }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text selectable style={{ color: theme.muted, fontSize: 14, fontWeight: "800", marginTop: 2 }}>{price}</Text>
      </View>
    </Pressable>
  );
}
