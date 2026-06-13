import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppLogo } from "@/components/app-logo";
import { PasscodePad } from "@/components/passcode-pad";
import { AppLockService, BiometricKind, PASSCODE_LENGTH } from "@/services/app-lock-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";

/**
 * Root-mounted lock screen. When App Lock is on, it covers the entire app on
 * cold start only. It fails OPEN: if
 * no passcode is actually stored (secure store unavailable on the current APK,
 * or never set), it never locks — the user can't be stranded. When biometric
 * unlock is on AND available, the system sheet is prompted automatically; a
 * cancel drops the user onto the passcode pad in the SAME screen. A process
 * kill or force-stop counts as a new cold start; normal foregrounding does not
 * re-lock.
 */
export function AppLockGate() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const appLockEnabled = useAppStore((state) => state.settings.appLockEnabled);
  const biometricEnabled = useAppStore((state) => state.settings.biometricAuthEnabled);

  const [locked, setLocked] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [biometricKind, setBiometricKind] = useState<BiometricKind>("generic");
  const [biometricUsable, setBiometricUsable] = useState(false);

  const initializedRef = useRef(false);
  const promptedRef = useRef(false);

  const unlock = useCallback(() => {
    promptedRef.current = false;
    setValue("");
    setError(false);
    setLocked(false);
  }, []);

  // Probe biometric capability once (and refresh when the toggle flips on).
  useEffect(() => {
    let active = true;
    void AppLockService.getBiometricCapability().then((cap) => {
      if (!active) return;
      setBiometricKind(cap.kind);
      setBiometricUsable(cap.available);
    });
    return () => {
      active = false;
    };
  }, [biometricEnabled]);

  // Cold-start lock decision: cover optimistically, then unlock if no passcode.
  useEffect(() => {
    if (!hasHydrated || initializedRef.current) return;
    initializedRef.current = true;
    if (!appLockEnabled) return;
    setLocked(true);
    void AppLockService.hasPasscode().then((has) => {
      if (!has) setLocked(false);
    });
  }, [hasHydrated, appLockEnabled]);

  // Disabling App Lock from Settings must drop any active lock.
  useEffect(() => {
    if (!appLockEnabled) unlock();
  }, [appLockEnabled, unlock]);

  const triggerBiometric = useCallback(async () => {
    const result = await AppLockService.authenticateBiometric(t("lock.biometricPrompt"), t("common.cancel"));
    if (result.success) unlock();
  }, [t, unlock]);

  // Auto-prompt biometric when the lock appears.
  useEffect(() => {
    if (!locked) {
      promptedRef.current = false;
      return;
    }
    if (biometricEnabled && biometricUsable && !promptedRef.current) {
      promptedRef.current = true;
      void triggerBiometric();
    }
  }, [locked, biometricEnabled, biometricUsable, triggerBiometric]);

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

  if (!locked) return null;

  const showBiometric = biometricEnabled && biometricUsable;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.background,
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: 24,
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 1000
      }}
    >
      <View style={{ alignItems: "center", gap: 14 }}>
        <AppLogo size={56} color={theme.accent} />
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>{t("lock.title")}</Text>
        <Text style={{ color: theme.muted, fontSize: 15, textAlign: "center" }}>
          {error ? t("lock.wrongPasscode") : t("lock.subtitle")}
        </Text>
      </View>

      <PasscodePad
        value={value}
        onChange={handleChange}
        error={error}
        onBiometric={showBiometric ? () => void triggerBiometric() : undefined}
        biometricKind={biometricKind}
      />

      {showBiometric ? (
        <Pressable onPress={() => void triggerBiometric()} style={{ paddingVertical: 10 }}>
          <Text style={{ color: theme.accent, fontSize: 15, fontWeight: "800" }}>
            {biometricKind === "face" ? t("lock.useFaceId") : t("lock.useTouchId")}
          </Text>
        </Pressable>
      ) : (
        <View style={{ height: 20 }} />
      )}
    </View>
  );
}
