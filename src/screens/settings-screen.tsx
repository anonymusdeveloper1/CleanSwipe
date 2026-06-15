import { router } from "expo-router";
import { Archive, ArrowLeft, Bell, Bug, Check, ChevronRight, Fingerprint, Images, KeyRound, Languages, Layers, Lock, Moon, Palette, Shield, Star, ToggleLeft, XCircle } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdBanner } from "@/components/ad-banner";
import { PasscodePad } from "@/components/passcode-pad";
import { SettingsRow } from "@/components/settings-row";
import { SettingsSection } from "@/components/settings-section";
import { useFeatureAccess } from "@/features/subscription/use-feature-access";
import { accentColors } from "@/theme/colors";
import { useAppTheme } from "@/hooks/use-app-theme";
import { languageOptions } from "@/i18n/languages";
import { AfterCompressionOriginalPolicy, LanguagePreference } from "@/models/photo";
import { AppLockService, BiometricKind, PASSCODE_LENGTH } from "@/services/app-lock-service";
import { PermissionService } from "@/services/permission-service";
import { ReminderNotificationService } from "@/services/reminder-notification-service";
import { useAppStore } from "@/store/app-store";
import { useSubscriptionStore } from "@/store/subscription-store";

type PasscodePurpose = "enable" | "disable" | "change";
type PasscodeFlow = { mode: "setup" | "verify"; purpose: PasscodePurpose };
type BioCapability = { moduleAvailable: boolean; available: boolean; kind: BiometricKind };

export function SettingsScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [policyDialogVisible, setPolicyDialogVisible] = useState(false);
  const [passcodeFlow, setPasscodeFlow] = useState<PasscodeFlow | null>(null);
  const [bioCap, setBioCap] = useState<BioCapability>({ moduleAvailable: false, available: false, kind: "generic" });
  const [notifStatus, setNotifStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");

  const settings = useAppStore((state) => state.settings);
  const update = useAppStore((state) => state.updateSetting);
  const permission = useAppStore((state) => state.permission);
  const requestPhotoPermission = useAppStore((state) => state.requestPhotoPermission);
  const refreshPermissionStatus = useAppStore((state) => state.refreshPermissionStatus);
  const subscriptionStatus = useSubscriptionStore((state) => state.subscriptionStatus);
  const cancelSubscription = useSubscriptionStore((state) => state.cancelSubscription);
  const { isPro } = useFeatureAccess();
  const selectedLanguage = languageOptions.find((option) => option.value === settings.language) ?? languageOptions[0];

  const refreshNotifStatus = useCallback(() => {
    void ReminderNotificationService.getPermissionStatus().then(setNotifStatus);
  }, []);

  // Keep the displayed access levels fresh, including after the user returns from
  // the system settings screen having changed a grant.
  useEffect(() => {
    void refreshPermissionStatus();
    refreshNotifStatus();
    void AppLockService.getBiometricCapability().then((cap) =>
      setBioCap({ moduleAvailable: AppLockService.isBiometricModuleAvailable(), available: cap.available, kind: cap.kind })
    );
  }, [refreshPermissionStatus, refreshNotifStatus]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshPermissionStatus();
        refreshNotifStatus();
      }
    });
    return () => subscription.remove();
  }, [refreshPermissionStatus, refreshNotifStatus]);

  const mediaAccessGranted = permission.status === "granted" || permission.status === "limited";
  const mediaAccessLabel =
    permission.status === "granted"
      ? t("permissions.statusFull")
      : permission.status === "limited"
        ? t("permissions.statusLimited")
        : t("permissions.statusNone");

  const handleMediaAccessPress = () => {
    if (mediaAccessGranted) {
      void PermissionService.openSettings();
    } else {
      void requestPhotoPermission();
    }
  };

  const handleNotificationAccessPress = () => {
    if (notifStatus === "granted") {
      void PermissionService.openSettings();
    } else {
      void ReminderNotificationService.requestPermission().then(() => refreshNotifStatus());
    }
  };

  // --- Account & Security ---------------------------------------------------
  const handleAppLockToggle = (next: boolean) => {
    if (next) {
      if (!AppLockService.isSecureStoreAvailable()) {
        Alert.alert(t("lock.unavailableTitle"), t("lock.unavailableMessage"));
        return;
      }
      setPasscodeFlow({ mode: "setup", purpose: "enable" });
    } else {
      setPasscodeFlow({ mode: "verify", purpose: "disable" });
    }
  };

  const handleChangePasscode = () => setPasscodeFlow({ mode: "verify", purpose: "change" });

  const handleBiometricToggle = (next: boolean) => {
    if (!next) {
      update("biometricAuthEnabled", false);
      return;
    }
    if (!settings.appLockEnabled) {
      Alert.alert(t("lock.needAppLockTitle"), t("lock.needAppLockMessage"));
      return;
    }
    if (!AppLockService.isBiometricModuleAvailable()) {
      Alert.alert(t("lock.unavailableTitle"), t("lock.biometricUnavailableMessage"));
      return;
    }
    void (async () => {
      const cap = await AppLockService.getBiometricCapability();
      if (!cap.available) {
        Alert.alert(t("lock.noBiometricTitle"), t("lock.noBiometricMessage"));
        return;
      }
      const result = await AppLockService.authenticateBiometric(t("lock.enablePrompt"), t("common.cancel"));
      if (result.success) update("biometricAuthEnabled", true);
    })();
  };

  const handlePasscodeSetupComplete = async (pin: string) => {
    const saved = await AppLockService.setPasscode(pin);
    if (!saved) {
      setPasscodeFlow(null);
      Alert.alert(t("lock.unavailableTitle"), t("lock.unavailableMessage"));
      return;
    }
    if (passcodeFlow?.purpose === "enable") update("appLockEnabled", true);
    setPasscodeFlow(null);
  };

  const handlePasscodeVerified = async () => {
    const purpose = passcodeFlow?.purpose;
    if (purpose === "disable") {
      await AppLockService.clearPasscode();
      update("appLockEnabled", false);
      update("biometricAuthEnabled", false);
      setPasscodeFlow(null);
    } else if (purpose === "change") {
      setPasscodeFlow({ mode: "setup", purpose: "change" });
    }
  };

  const biometricSubtitle = !bioCap.moduleAvailable
    ? t("settings.featureAfterUpdate")
    : !bioCap.available
      ? t("settings.biometricNotEnrolled")
      : t("settings.biometricSubtitle");
  const appLockSubtitle = AppLockService.isSecureStoreAvailable() ? t("settings.appLockSubtitle") : t("settings.featureAfterUpdate");

  const handleSelectPolicy = (policy: AfterCompressionOriginalPolicy) => {
    update("afterCompressionOriginalPolicy", policy);
    setPolicyDialogVisible(false);
  };

  const setLanguage = (language: LanguagePreference) => {
    update("language", language);
    setLanguagePickerVisible(false);
  };

  const notifMaster = settings.notificationsEnabled;
  const chevron = <ChevronRight size={20} color={theme.muted} />;

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
        <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>{t("settings.title")}</Text>
        <View style={{ width: 34 }} />
      </View>

      <SettingsSection title={t("settings.accountSecurity")}>
        <SettingsRow icon={Fingerprint} title={t("settings.biometricAuth")} subtitle={biometricSubtitle} value={settings.biometricAuthEnabled} onValueChange={handleBiometricToggle} />
        <SettingsRow icon={Lock} title={t("settings.appLock")} subtitle={appLockSubtitle} value={settings.appLockEnabled} onValueChange={handleAppLockToggle} />
        {settings.appLockEnabled ? (
          <SettingsRow icon={KeyRound} title={t("settings.changePasscode")} subtitle={t("settings.changePasscodeSubtitle")} onPress={handleChangePasscode} trailing={chevron} />
        ) : null}
      </SettingsSection>

      <SettingsSection title={t("settings.appearance")}>
        <SettingsRow icon={Moon} title={t("settings.darkMode")} subtitle={t("settings.darkModeSubtitle")} value={settings.darkModeEnabled} onValueChange={(value) => update("darkModeEnabled", value)} />
        <AccentColorRow selected={settings.accentColor} onSelect={(name) => update("accentColor", name)} />
      </SettingsSection>

      <SettingsSection title={t("settings.languageSection")}>
        <SettingsRow icon={Languages} title={t("settings.language")} subtitle={t(selectedLanguage.labelKey)} onPress={() => setLanguagePickerVisible(true)} trailing={chevron} />
      </SettingsSection>

      <SettingsSection title={t("settings.permissions")}>
        <SettingsRow icon={Images} title={t("settings.mediaAccess")} subtitle={mediaAccessLabel} onPress={handleMediaAccessPress} trailing={<Checkbox checked={mediaAccessGranted} />} />
        <SettingsRow
          icon={Bell}
          title={t("settings.notificationsPermission")}
          subtitle={notifStatus === "granted" ? t("permissions.notificationsGranted") : t("permissions.notificationsNone")}
          onPress={handleNotificationAccessPress}
          trailing={<Checkbox checked={notifStatus === "granted"} />}
        />
      </SettingsSection>

      <SettingsSection title={t("settings.notifications")}>
        <SettingsRow icon={Bell} title={t("settings.allowNotifications")} subtitle={t("settings.allowNotificationsSubtitle")} value={notifMaster} onValueChange={(value) => {
          update("notificationsEnabled", value);
          if (value) void ReminderNotificationService.requestPermission().then(() => refreshNotifStatus());
        }} />
        <SettingsRow icon={Layers} title={t("settings.cleanupReminders")} subtitle={t("settings.cleanupRemindersSubtitle")} value={settings.cleanupRemindersEnabled} onValueChange={(value) => update("cleanupRemindersEnabled", value)} disabled={!notifMaster} />
        <SettingsRow icon={Archive} title={t("settings.compressionReminders")} subtitle={t("settings.compressionRemindersSubtitle")} value={settings.compressionRemindersEnabled} onValueChange={(value) => update("compressionRemindersEnabled", value)} disabled={!notifMaster} />
        <SettingsRow icon={Star} title={t("settings.proNotifications")} subtitle={t("settings.proNotificationsSubtitle")} value={settings.proNotificationsEnabled} onValueChange={(value) => update("proNotificationsEnabled", value)} disabled={!notifMaster} />
      </SettingsSection>

      <SettingsSection title={t("settings.compression")}>
        <SettingsRow icon={Shield} title={t("settings.afterCompression")} subtitle={formatOriginalPolicy(settings.afterCompressionOriginalPolicy, t)} onPress={() => setPolicyDialogVisible(true)} trailing={chevron} />
      </SettingsSection>

      <SettingsSection title={t("settings.support")}>
        {!isPro ? (
          <SettingsRow icon={Star} title={t("settings.upgradePremium")} subtitle={t("settings.upgradePremiumSubtitle")} onPress={() => router.push("/premium") as never} trailing={chevron} />
        ) : null}
        {subscriptionStatus === "active" ? (
          <SettingsRow
            icon={XCircle}
            title={t("settings.cancelSubscription")}
            subtitle={t("settings.cancelSubscriptionSubtitle")}
            onPress={() => void cancelSubscription()}
            trailing={chevron}
          />
        ) : null}
        <SettingsRow icon={ToggleLeft} title={t("settings.leaveFeedback")} onPress={() => undefined} trailing={chevron} />
        <SettingsRow icon={Bug} title={t("settings.reportBug")} onPress={() => undefined} trailing={chevron} />
      </SettingsSection>

      <AdBanner />
      <Text selectable style={{ color: theme.faint, textAlign: "center", fontWeight: "700" }}>
        {t("settings.madeBy")}
      </Text>

      <LanguagePickerDialog
        visible={languagePickerVisible}
        selectedLanguage={settings.language}
        onSelect={setLanguage}
        onCancel={() => setLanguagePickerVisible(false)}
      />
      <AfterCompressionDialog
        visible={policyDialogVisible}
        currentPolicy={settings.afterCompressionOriginalPolicy}
        onSelect={handleSelectPolicy}
        onCancel={() => setPolicyDialogVisible(false)}
      />
      <PasscodeDialog
        flow={passcodeFlow}
        onCancel={() => setPasscodeFlow(null)}
        onSetupComplete={handlePasscodeSetupComplete}
        verify={AppLockService.verifyPasscode}
        onVerified={handlePasscodeVerified}
      />
    </ScrollView>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 7,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: checked ? theme.accent : "transparent",
        borderWidth: checked ? 0 : 2,
        borderColor: theme.faint
      }}
    >
      {checked ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
    </View>
  );
}

function AccentColorRow({ selected, onSelect }: { selected: keyof typeof accentColors; onSelect: (name: keyof typeof accentColors) => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={{ minHeight: 58, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: theme.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
        <Palette size={19} color={theme.accent} />
      </View>
      <Text selectable style={{ flex: 1, color: theme.text, fontSize: 15, fontWeight: "600" }}>{t("settings.accentColor")}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {(Object.entries(accentColors) as [keyof typeof accentColors, string][]).map(([name, color]) => {
          const isSelected = selected === name;
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t("settings.accentColorLabel", { name })}
              onPress={() => onSelect(name)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: isSelected ? 2 : 0,
                borderColor: color
              }}
            >
              <View style={{ width: isSelected ? 18 : 20, height: isSelected ? 18 : 20, borderRadius: 10, backgroundColor: color }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PasscodeDialog({
  flow,
  onCancel,
  onSetupComplete,
  verify,
  onVerified
}: {
  flow: PasscodeFlow | null;
  onCancel: () => void;
  onSetupComplete: (pin: string) => void;
  verify: (pin: string) => Promise<boolean>;
  onVerified: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"enter" | "confirm">("enter");
  const [value, setValue] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState<"mismatch" | "wrong" | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = flow !== null;
  const mode = flow?.mode ?? "setup";
  // Bumped on every (re)open / mode change so an in-flight verify whose flow has
  // since changed or been cancelled is ignored (cancelling mid-verify must NOT
  // still apply the result, e.g. silently disabling App Lock after Cancel).
  const tokenRef = useRef(0);

  // Reset whenever the dialog is (re)opened or its mode changes (e.g. change-passcode
  // transitions verify -> setup).
  useEffect(() => {
    tokenRef.current += 1;
    setPhase("enter");
    setValue("");
    setFirstPin("");
    setError(null);
    setBusy(false);
  }, [flow?.mode, flow?.purpose, visible]);

  // Completion is handled imperatively in handleChange (NOT a value-effect): an
  // effect that both sets `busy` and lists it as a dep would re-run and cancel
  // its own in-flight verify via the cleanup, so verification could never land.
  const handleChange = (next: string) => {
    if (error) setError(null);
    if (next.length < PASSCODE_LENGTH) {
      setValue(next);
      return;
    }

    if (mode === "setup") {
      if (phase === "enter") {
        setFirstPin(next);
        setValue("");
        setPhase("confirm");
        return;
      }
      if (next === firstPin) {
        setValue("");
        onSetupComplete(next);
      } else {
        setError("mismatch");
        setFirstPin("");
        setValue("");
        setPhase("enter");
      }
      return;
    }

    // verify: show the filled dots while the (near-instant) secure-store check runs.
    setValue(next);
    setBusy(true);
    const token = tokenRef.current;
    void verify(next).then((ok) => {
      if (token !== tokenRef.current) return; // flow changed/cancelled mid-verify — ignore.
      setBusy(false);
      if (ok) {
        setValue("");
        onVerified();
      } else {
        setError("wrong");
        setValue("");
      }
    });
  };

  if (!visible) return null;

  const title = mode === "verify" ? t("lock.verifyTitle") : phase === "confirm" ? t("lock.setupConfirmTitle") : t("lock.setupTitle");
  const subtitle = error === "mismatch"
    ? t("lock.mismatch")
    : error === "wrong"
      ? t("lock.wrongPasscode")
      : mode === "verify"
        ? t("lock.verifyEnter")
        : phase === "confirm"
          ? t("lock.setupConfirm")
          : t("lock.setupEnter");

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.42)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 22, gap: 22, alignItems: "center" }}>
          <View style={{ gap: 6, alignItems: "center" }}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: "900" }}>{title}</Text>
            <Text style={{ color: error ? theme.red : theme.muted, fontSize: 14, textAlign: "center" }}>{subtitle}</Text>
          </View>
          <PasscodePad value={value} onChange={handleChange} error={error !== null} disabled={busy} />
          <Pressable onPress={onCancel} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <Text style={{ color: theme.accent, fontSize: 16, fontWeight: "900" }}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AfterCompressionDialog({
  visible,
  currentPolicy,
  onSelect,
  onCancel
}: {
  visible: boolean;
  currentPolicy: AfterCompressionOriginalPolicy;
  onSelect: (policy: AfterCompressionOriginalPolicy) => void;
  onCancel: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  // "options" lists the three policies; selecting the destructive one routes to
  // an in-app confirm step (replaces the old nested native Alert).
  const [view, setView] = useState<"options" | "confirmDelete">("options");

  useEffect(() => {
    if (visible) setView("options");
  }, [visible]);

  const options: { policy: AfterCompressionOriginalPolicy; label: string; destructive?: boolean }[] = [
    { policy: "ask_every_time", label: t("policy.askEveryTime") },
    { policy: "keep_original", label: t("policy.keepOriginal") },
    { policy: "delete_original_after_success", label: t("policy.deleteOriginalVerified"), destructive: true }
  ];

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.42)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 18, gap: 14 }}>
          {view === "options" ? (
            <>
              <View style={{ gap: 5, paddingHorizontal: 2 }}>
                <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "900" }}>{t("policy.title")}</Text>
                <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>{t("policy.message")}</Text>
              </View>
              <View style={{ gap: 8 }}>
                {options.map((option) => {
                  const selected = currentPolicy === option.policy;
                  const tint = option.destructive ? theme.red : theme.accent;
                  return (
                    <Pressable
                      key={option.policy}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => (option.destructive ? setView("confirmDelete") : onSelect(option.policy))}
                      style={{
                        minHeight: 52,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: selected ? theme.surfaceSoft : "transparent",
                        borderWidth: 1,
                        borderColor: selected ? tint : theme.border,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12
                      }}
                    >
                      <Text selectable style={{ flex: 1, color: option.destructive ? theme.red : theme.text, fontSize: 15, fontWeight: "700" }}>
                        {option.label}
                      </Text>
                      {selected ? (
                        <Check size={20} color={tint} strokeWidth={3} />
                      ) : option.destructive ? (
                        <ChevronRight size={18} color={theme.red} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={onCancel} style={{ alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ color: theme.accent, fontSize: 16, fontWeight: "900" }}>{t("common.cancel")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={{ gap: 8, paddingHorizontal: 2 }}>
                <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "900" }}>{t("policy.confirmTitle")}</Text>
                <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>{t("policy.confirmMessage")}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
                <Pressable accessibilityRole="button" onPress={() => setView("options")} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                  <Text style={{ color: theme.muted, fontSize: 16, fontWeight: "700" }}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => onSelect("delete_original_after_success")} style={{ paddingVertical: 12, paddingHorizontal: 18, backgroundColor: theme.red, borderRadius: 12 }}>
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>{t("policy.enableAutoDelete")}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function LanguagePickerDialog({
  visible,
  selectedLanguage,
  onSelect,
  onCancel
}: {
  visible: boolean;
  selectedLanguage: LanguagePreference;
  onSelect: (language: LanguagePreference) => void;
  onCancel: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.42)", justifyContent: "center", padding: 24 }}>
        <View style={{ maxHeight: "86%", backgroundColor: theme.surface, borderRadius: 20, padding: 18, gap: 12 }}>
          <View style={{ gap: 5, paddingHorizontal: 2 }}>
            <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>
              {t("settings.chooseLanguage")}
            </Text>
            <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
              {t("settings.systemLanguageHint")}
            </Text>
          </View>
          <ScrollView style={{ maxHeight: 430 }} contentContainerStyle={{ gap: 6 }}>
            {languageOptions.map((option) => {
              const selected = selectedLanguage === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(option.value)}
                  style={{
                    minHeight: 48,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: selected ? theme.surfaceSoft : "transparent",
                    borderWidth: 1,
                    borderColor: selected ? theme.accent : theme.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text selectable numberOfLines={1} style={{ color: theme.text, fontSize: 15, fontWeight: "900" }}>
                      {t(option.labelKey)}
                    </Text>
                    <Text selectable numberOfLines={1} style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>
                      {option.nativeName}
                    </Text>
                  </View>
                  {selected ? <Check size={20} color={theme.accent} strokeWidth={3} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={onCancel} style={{ alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ color: theme.accent, fontSize: 16, fontWeight: "900" }}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function formatOriginalPolicy(policy: AfterCompressionOriginalPolicy, t: (key: string) => string) {
  if (policy === "keep_original") return t("policy.keepOriginal");
  if (policy === "delete_original_after_success") return t("policy.deleteOriginalVerified");
  return t("policy.askEveryTime");
}
