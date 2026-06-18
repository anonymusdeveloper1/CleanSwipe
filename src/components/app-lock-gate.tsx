import { Fingerprint, LucideIcon, ScanFace } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Platform, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppLogo } from "@/components/app-logo";
import { PasscodePad } from "@/components/passcode-pad";
import { AppLockService, BiometricKind, PASSCODE_LENGTH } from "@/services/app-lock-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";

type LockView = "resolving" | "biometric" | "pin";

/**
 * Root-mounted, cold-start-only app lock. A configured and usable biometric
 * method gets its own first screen; the PIN pad is an explicit fallback. If
 * biometrics are unavailable/disabled, PIN is the first screen. The gate still
 * fails open when no encrypted passcode exists so a broken native module can
 * never strand the user.
 */
export function AppLockGate() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const appLockEnabled = useAppStore((state) => state.settings.appLockEnabled);
  const biometricEnabled = useAppStore((state) => state.settings.biometricAuthEnabled);

  const [locked, setLocked] = useState(false);
  const [lockView, setLockView] = useState<LockView>("resolving");
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [biometricKind, setBiometricKind] = useState<BiometricKind>("generic");
  const [biometricUsable, setBiometricUsable] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const initializedRef = useRef(false);
  const promptedRef = useRef(false);
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceY = useRef(new Animated.Value(16)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const unlock = useCallback(() => {
    promptedRef.current = false;
    setValue("");
    setError(false);
    setAuthenticating(false);
    setLockView("resolving");
    setLocked(false);
  }, []);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  // Resolve the two facts that select the first lock screen in parallel. The
  // full-screen gate is already covering app content while these checks run.
  useEffect(() => {
    if (!hasHydrated || initializedRef.current) return;
    initializedRef.current = true;
    if (!appLockEnabled) return;

    let active = true;
    setLocked(true);
    setLockView("resolving");
    const capability = biometricEnabled
      ? AppLockService.getBiometricCapability()
      : Promise.resolve({ available: false, enrolled: false, kind: "generic" as BiometricKind });

    void Promise.all([AppLockService.hasPasscode(), capability]).then(([hasPasscode, biometric]) => {
      if (!active) return;
      if (!hasPasscode) {
        unlock();
        return;
      }
      const usable = biometricEnabled && biometric.available;
      setBiometricKind(biometric.kind);
      setBiometricUsable(usable);
      promptedRef.current = false;
      setLockView(usable ? "biometric" : "pin");
    });

    return () => {
      active = false;
    };
  }, [appLockEnabled, biometricEnabled, hasHydrated, unlock]);

  // Disabling App Lock from Settings must drop any active lock.
  useEffect(() => {
    if (!appLockEnabled) unlock();
  }, [appLockEnabled, unlock]);

  const triggerBiometric = useCallback(async () => {
    if (authenticating) return;
    setAuthenticating(true);
    const result = await AppLockService.authenticateBiometric(t("lock.biometricPrompt"), t("common.cancel"));
    setAuthenticating(false);
    if (result.success) unlock();
  }, [authenticating, t, unlock]);

  // Present the native biometric sheet after the dedicated screen has rendered
  // once. A cancellation stays on this screen; PIN is only opened by its button.
  useEffect(() => {
    if (!locked || lockView !== "biometric" || promptedRef.current) return;
    promptedRef.current = true;
    const frame = requestAnimationFrame(() => void triggerBiometric());
    return () => cancelAnimationFrame(frame);
  }, [lockView, locked, triggerBiometric]);

  // Entrance motion runs on both real lock views; the biometric halo continues
  // breathing until the user authenticates. Reduced-motion users get no motion.
  useEffect(() => {
    entranceOpacity.stopAnimation();
    entranceY.stopAnimation();
    pulse.stopAnimation();
    if (!locked || lockView === "resolving") return;

    if (reduceMotion) {
      entranceOpacity.setValue(1);
      entranceY.setValue(0);
      pulse.setValue(0);
      return;
    }

    entranceOpacity.setValue(0);
    entranceY.setValue(16);
    pulse.setValue(0);
    Animated.parallel([
      Animated.timing(entranceOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(entranceY, { toValue: 0, damping: 16, stiffness: 150, mass: 0.7, useNativeDriver: true })
    ]).start();

    if (lockView !== "biometric") return;
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true })
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [entranceOpacity, entranceY, lockView, locked, pulse, reduceMotion]);

  // Verify once a full passcode is entered.
  useEffect(() => {
    if (value.length < PASSCODE_LENGTH) return;
    let active = true;
    void AppLockService.verifyPasscode(value).then((ok) => {
      if (!active) return;
      if (ok) {
        unlock();
      } else {
        setError(true);
        setValue("");
      }
    });
    return () => {
      active = false;
    };
  }, [value, unlock]);

  const handleChange = (next: string) => {
    if (error) setError(false);
    setValue(next);
  };

  const showPin = () => {
    setValue("");
    setError(false);
    setLockView("pin");
  };

  const showBiometric = () => {
    if (!biometricUsable) return;
    promptedRef.current = false;
    setValue("");
    setError(false);
    setLockView("biometric");
  };

  const BiometricIcon: LucideIcon = biometricKind === "face" ? ScanFace : Fingerprint;
  const biometricActionLabel = useMemo(() => {
    if (biometricKind === "face") return t("lock.useFaceId");
    if (biometricKind === "fingerprint") return Platform.OS === "ios" ? t("lock.useTouchId") : t("lock.useFingerprint");
    return t("lock.useBiometrics");
  }, [biometricKind, t]);
  const rippleScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.35] });
  const rippleOpacity = pulse.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0.42, 0.16, 0] });

  if (!locked) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.background,
        paddingTop: insets.top + 30,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
        zIndex: 1000
      }}
    >
      {lockView === "resolving" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
          <AppLogo size={58} color={theme.accent} />
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <Animated.View style={{ flex: 1, width: "100%", opacity: entranceOpacity, transform: [{ translateY: entranceY }] }}>
          {lockView === "biometric" ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "space-between" }}>
              <AppLogo size={48} color={theme.accent} />

              <View style={{ alignItems: "center", gap: 24 }}>
                <View style={{ width: 190, height: 190, alignItems: "center", justifyContent: "center" }}>
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      width: 160,
                      height: 160,
                      borderRadius: 80,
                      borderWidth: 2,
                      borderColor: theme.accent,
                      opacity: rippleOpacity,
                      transform: [{ scale: rippleScale }]
                    }}
                  />
                  <View
                    style={{
                      width: 138,
                      height: 138,
                      borderRadius: 69,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: theme.surfaceSoft,
                      borderWidth: 1.5,
                      borderColor: theme.accent,
                      boxShadow: `0 16px 38px ${theme.accent}38`
                    }}
                  >
                    <BiometricIcon size={62} color={theme.accent} strokeWidth={1.8} />
                  </View>
                </View>

                <View style={{ alignItems: "center", gap: 10 }}>
                  <Text style={{ color: theme.text, fontSize: 28, lineHeight: 34, fontWeight: "900", textAlign: "center" }}>
                    {t("lock.biometricTitle")}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 16, lineHeight: 23, textAlign: "center", maxWidth: 300 }}>
                    {t("lock.biometricSubtitle")}
                  </Text>
                </View>
              </View>

              <View style={{ width: "100%", gap: 12 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={biometricActionLabel}
                  disabled={authenticating}
                  onPress={() => void triggerBiometric()}
                  style={({ pressed }) => ({
                    minHeight: 56,
                    borderRadius: 16,
                    backgroundColor: theme.accent,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    opacity: authenticating ? 0.72 : pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                    boxShadow: `0 10px 24px ${theme.accent}40`
                  })}
                >
                  {authenticating ? <ActivityIndicator size="small" color="#fff" /> : <BiometricIcon size={22} color="#fff" />}
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{biometricActionLabel}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("lock.usePasscode")}
                  onPress={showPin}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed ? theme.surfaceStrong : theme.surface,
                    borderWidth: 1,
                    borderColor: theme.border
                  })}
                >
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}>{t("lock.usePasscode")}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ alignItems: "center", gap: 14 }}>
                <AppLogo size={56} color={theme.accent} />
                <Text style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>{t("lock.title")}</Text>
                <Text style={{ color: error ? theme.red : theme.muted, fontSize: 15, textAlign: "center" }}>
                  {error ? t("lock.wrongPasscode") : t("lock.subtitle")}
                </Text>
              </View>

              <PasscodePad value={value} onChange={handleChange} error={error} />

              {biometricUsable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={biometricActionLabel}
                  onPress={showBiometric}
                  style={({ pressed }) => ({
                    minHeight: 48,
                    paddingHorizontal: 18,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: pressed ? 0.7 : 1
                  })}
                >
                  <BiometricIcon size={20} color={theme.accent} />
                  <Text style={{ color: theme.accent, fontSize: 15, fontWeight: "900" }}>{biometricActionLabel}</Text>
                </Pressable>
              ) : (
                <View style={{ height: 48 }} />
              )}
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}
