import "react-native-gesture-handler";
import "@/i18n";
import { Image as ExpoImage } from "expo-image";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import mobileAds from "react-native-google-mobile-ads";
import { AppLockGate } from "@/components/app-lock-gate";
import { ProUpgradeSheet } from "@/components/pro-upgrade-sheet";
import { AdsConsentService } from "@/features/ads/consent.service";
import { InterstitialAdService } from "@/features/ads/interstitial.service";
import { RewardedAdService } from "@/features/ads/rewarded.service";
import { SmartCleanPreviewOverlay } from "@/features/smart-clean/components/smart-clean-preview-overlay";
import { SmartCleanReviewSheet } from "@/features/smart-clean/components/smart-clean-review-sheet";
import { SmartCleanScanNotifications } from "@/features/smart-clean/smart-clean-notifications";
import { useSmartCleanStore } from "@/features/smart-clean/smart-clean-store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePhotoLibrarySync } from "@/hooks/use-photo-library-sync";
import i18n, { applyLanguagePreference } from "@/i18n";
import { ReminderNotificationService } from "@/services/reminder-notification-service";
import { useAppStore } from "@/store/app-store";
import { useMediaIndexStore } from "@/store/media-index-store";
import { useSubscriptionStore } from "@/store/subscription-store";
import { flushAllDebouncedStorages } from "@/utils/debounced-storage";

export default function RootLayout() {
  const theme = useAppTheme();
  usePhotoLibrarySync();

  useEffect(() => {
    // GDPR/UMP: gather consent BEFORE initializing the Mobile Ads SDK. The gather
    // call fails open, so ad init always runs regardless of the consent outcome.
    void AdsConsentService.gather().finally(() => {
      void mobileAds()
        .initialize()
        .then(() => {
          InterstitialAdService.preload();
          RewardedAdService.preload();
        })
        .catch(() => undefined);
    });
  }, []);

  // Smart Clean scan notification: clear any stale "Scanning…" notification left
  // over from a killed session, and wire the notification's Stop button to cancel
  // the scan even when the Smart Clean screen isn't mounted.
  useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    let mounted = true;

    void SmartCleanScanNotifications.dismiss();
    void SmartCleanScanNotifications.addStopListener(() => {
      useSmartCleanStore.getState().cancel();
    }).then((listener) => {
      if (!mounted) {
        listener?.remove();
        return;
      }
      subscription = listener;
    });

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <I18nPreferenceSync />
      <SubscriptionSync />
      <SmartCleanResumeSync />
      <ImageCacheManager />
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background }
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: "card" }} />
        <Stack.Screen
          name="month-selector"
          options={{ presentation: "formSheet", sheetAllowedDetents: [0.58, 0.92], sheetGrabberVisible: false, sheetCornerRadius: 28 }}
        />
        <Stack.Screen name="review-delete-list" options={{ presentation: "card" }} />
        <Stack.Screen name="selected-photos" options={{ presentation: "card" }} />
        <Stack.Screen name="photo-preview" options={{ presentation: "modal" }} />
        <Stack.Screen name="compression-media-viewer" options={{ presentation: "transparentModal", animation: "fade", contentStyle: { backgroundColor: "transparent" } }} />
        <Stack.Screen name="compression-detail" options={{ presentation: "card" }} />
        <Stack.Screen name="compress-run" options={{ presentation: "card", gestureEnabled: false }} />
      </Stack>
      <ProUpgradeSheet />
      {/* Mounted above the tab navigator so the review sheet overlays the bottom
          tab bar (an overlay inside a tab screen paints under it). */}
      <SmartCleanReviewSheet />
      {/* Above the review sheet: a full-screen image/video viewer (long-press a
          review cell) that covers the sheet without unmounting it. */}
      <SmartCleanPreviewOverlay />
      <ReminderSync />
      {/* Mounted LAST so the lock screen covers the entire app (tabs + sheets). */}
      <AppLockGate />
    </GestureHandlerRootView>
  );
}

/**
 * Keeps the OS reminder schedule (cleanup / compression / Pro) in sync with the
 * notification toggles. Re-applies once settings hydrate, on any toggle change,
 * and when the app language changes (so reminder copy re-localizes). The service
 * only schedules when the master toggle is on AND notification permission is
 * granted; otherwise it cancels everything. Idempotent.
 */
function ReminderSync() {
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const master = useAppStore((state) => state.settings.notificationsEnabled);
  const cleanup = useAppStore((state) => state.settings.cleanupRemindersEnabled);
  const compression = useAppStore((state) => state.settings.compressionRemindersEnabled);
  const pro = useAppStore((state) => state.settings.proNotificationsEnabled);

  useEffect(() => {
    if (!hasHydrated) return;
    void ReminderNotificationService.applyReminderSchedule({ master, cleanup, compression, pro });
  }, [hasHydrated, master, cleanup, compression, pro]);

  // Re-localize reminders only once the language switch has actually landed.
  // `applyLanguagePreference` resolves `i18n.changeLanguage` asynchronously, so
  // reacting to the language SETTING would reschedule with the previous language;
  // the real "languageChanged" event fires after the swap completes.
  useEffect(() => {
    const reapply = () => {
      const state = useAppStore.getState();
      if (!state.hasHydrated) return;
      void ReminderNotificationService.applyReminderSchedule({
        master: state.settings.notificationsEnabled,
        cleanup: state.settings.cleanupRemindersEnabled,
        compression: state.settings.compressionRemindersEnabled,
        pro: state.settings.proNotificationsEnabled
      });
    };
    i18n.on("languageChanged", reapply);
    return () => {
      i18n.off("languageChanged", reapply);
    };
  }, []);

  return null;
}

function I18nPreferenceSync() {
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const language = useAppStore((state) => state.settings.language);

  useEffect(() => {
    if (hasHydrated) {
      void applyLanguagePreference(language);
    }
  }, [hasHydrated, language]);

  return null;
}

function SubscriptionSync() {
  const hasHydrated = useSubscriptionStore((state) => state.hasHydrated);
  const initializeBilling = useSubscriptionStore((state) => state.initializeBilling);
  const refreshSubscriptionStatus = useSubscriptionStore((state) => state.refreshSubscriptionStatus);

  useEffect(() => {
    if (hasHydrated) {
      void initializeBilling();
    }
  }, [hasHydrated, initializeBilling]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && useSubscriptionStore.getState().hasHydrated) {
        void refreshSubscriptionStatus();
      }
    });
    return () => subscription.remove();
  }, [refreshSubscriptionStatus]);

  return null;
}

/**
 * Auto-resume a Smart Clean scan that was cut off (background-kill / crash).
 * Fires once both the runner store and the media index are ready (reactive
 * primitives — no fresh-object selectors), and again whenever the app returns to
 * the foreground. `resumeIfInterrupted` is idempotent (no-ops if a scan is
 * already running or there is nothing to resume).
 */
function SmartCleanResumeSync() {
  const scanHydrated = useSmartCleanStore((state) => state.hasHydrated);
  const indexReady = useMediaIndexStore((state) => state.orderedIds.length > 0);

  useEffect(() => {
    if (scanHydrated && indexReady) {
      useSmartCleanStore.getState().resumeIfInterrupted();
    }
  }, [scanHydrated, indexReady]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        useSmartCleanStore.getState().resumeIfInterrupted();
      } else if (state === "background" || state === "inactive") {
        // Persist trailing scan + feature-cache writes immediately, before the OS
        // suspends (iOS) or an aggressive OEM kills the task (Android), so a resumed
        // scan continues from exactly where it stopped — no recomputed hashes.
        void flushAllDebouncedStorages();
      }
    });
    return () => subscription.remove();
  }, []);

  return null;
}

/**
 * Frees expo-image's in-memory bitmap cache when the app leaves the foreground.
 * Decoded thumbnails live on the native heap and the memory cache retains them
 * after they scroll off-screen; releasing it on background reclaims that memory
 * (the disk cache is untouched, so images re-display instantly on return).
 */
function ImageCacheManager() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        void ExpoImage.clearMemoryCache();
      }
    });
    return () => subscription.remove();
  }, []);

  return null;
}
