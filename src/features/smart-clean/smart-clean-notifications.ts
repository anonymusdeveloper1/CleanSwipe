import { Platform } from "react-native";
import i18n from "@/i18n";

/**
 * Ongoing "Scanning…" notification for Smart Clean — DELIBERATELY SEPARATE from
 * the compression notification:
 *  - Compression's ongoing notification is a react-native-background-actions
 *    foreground service, which is a SINGLETON (only one task at a time), so the
 *    scan cannot reuse it without colliding with an in-flight compression.
 *  - Instead the scan posts its own expo-notifications notification on its OWN
 *    channel + identifier + category. Because the ids differ, the scan and
 *    compression notifications coexist and never overwrite each other.
 *
 * It is a sticky (non-dismissible on Android) notification with a "Stop" action
 * button. Caveat vs. compression: this is NOT a foreground service, so if the
 * app is fully backgrounded the JS scan may be suspended by the OS (the
 * notification stays, progress pauses, and resumes when the app returns).
 */
const SCAN_CHANNEL_ID = "smart-clean-scan";
const SCAN_NOTIFICATION_ID = "smart-clean-scan";
const SCAN_CATEGORY_ID = "smart-clean-scan";
const SCAN_DATA_TYPE = "smart-clean-scan";
export const SMART_CLEAN_STOP_ACTION = "smart-clean-stop";

type ExpoNotificationsModule = typeof import("expo-notifications");

let available = true;
let setupDone = false;

/**
 * All post/dismiss operations run through this FIFO chain so the native
 * schedule/dismiss calls execute in the exact order they were requested.
 *
 * Without it, `void showProgress()` and `void dismiss()` are independent async
 * calls whose native effects can land out of order (expo-notifications presents
 * via an IO coroutine while dismiss cancels synchronously). That race could
 * either strand the sticky/non-dismissible notification after a Stop, or wipe
 * the live run's notification during a post-delete re-scan. Serializing makes
 * "last call wins" hold: a dismiss requested after a show always runs after it,
 * and vice-versa.
 */
let opQueue: Promise<void> = Promise.resolve();

/**
 * Timestamp (ms) of the most recent scheduleNotificationAsync resolve. dismiss()
 * uses it to know whether a native present might still be in flight: the present
 * runs on an IO coroutine shortly AFTER the JS promise resolves, so a dismiss is
 * only safe to stop retrying once this window has elapsed AND the notification
 * is stably absent.
 */
let lastScheduleAt = 0;
const PRESENT_LATENCY_MS = 1500;

function enqueue(op: () => Promise<void>): Promise<void> {
  const next = opQueue.then(op).catch(() => {
    /* never let one failed op break the chain */
  });
  opQueue = next;
  return next;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isScanNotificationPresent(Notifications: ExpoNotificationsModule): Promise<boolean> {
  const presented = await Notifications.getPresentedNotificationsAsync();
  return presented.some((n) => n.request.identifier === SCAN_NOTIFICATION_ID);
}

async function getNotifications(): Promise<ExpoNotificationsModule | undefined> {
  if (!available) return undefined;
  try {
    return await import("expo-notifications");
  } catch {
    available = false;
    return undefined;
  }
}

async function ensureSetup(Notifications: ExpoNotificationsModule) {
  if (setupDone) return;
  // Self-sufficient foreground presentation: register our OWN handler so the
  // scan notification appears even if the compression permission flow (the only
  // other place that sets a handler) is refactored or hasn't run yet. Type-aware
  // so it stays fully compatible with the compression notification — both get
  // banner + list; only non-scan notifications request sound (and the LOW scan
  // channel is silent on Android regardless).
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const isScan = notification.request.content.data?.type === SCAN_DATA_TYPE;
      return {
        shouldPlaySound: !isScan,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true
      };
    }
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(SCAN_CHANNEL_ID, {
      name: "Smart Clean scanning",
      importance: Notifications.AndroidImportance.LOW,
      showBadge: false
    });
  }
  await Notifications.setNotificationCategoryAsync(SCAN_CATEGORY_ID, [
    { identifier: SMART_CLEAN_STOP_ACTION, buttonTitle: i18n.t("smartClean.stop"), options: { opensAppToForeground: false } }
  ]);
  setupDone = true;
}

export const SmartCleanScanNotifications = {
  /** Post/update the ongoing scan notification (Android). `body` is the live
   * status line (e.g. "Analyzing photos 1,240 of 3,355" / "Scanning Similar photos"). */
  showProgress(body: string): Promise<void> {
    if (Platform.OS !== "android") return Promise.resolve(); // "ongoing" notifications are an Android concept
    return enqueue(async () => {
      const Notifications = await getNotifications();
      if (!Notifications) return;
      try {
        await ensureSetup(Notifications);
        await Notifications.scheduleNotificationAsync({
          // Stable id → the OS updates the existing notification in place.
          identifier: SCAN_NOTIFICATION_ID,
          content: {
            title: i18n.t("smartClean.title"),
            body,
            data: { type: SCAN_DATA_TYPE },
            categoryIdentifier: SCAN_CATEGORY_ID,
            sticky: true,
            autoDismiss: false,
            sound: false
          },
          trigger: { channelId: SCAN_CHANNEL_ID }
        });
        // A native present is now queued behind this resolve — record when, so
        // dismiss() knows to keep retrying until it can't still be in flight.
        lastScheduleAt = Date.now();
      } catch {
        available = false;
      }
    });
  },

  /**
   * Remove the scan notification.
   *
   * `scheduleNotificationAsync` (with a channelId trigger) presents on a native
   * IO coroutine AFTER its JS promise resolves, so a single dismiss can be
   * overtaken by an in-flight present and strand the sticky/non-dismissible
   * notification ("Scanning 8 of 8…" with no scan running). We can't await the
   * native present from JS, so we poll getPresentedNotificationsAsync: cancel
   * every tick and only stop once the notification is STABLY absent AND enough
   * time has passed since the last schedule that no present can still be in
   * flight. This covers a delayed present, multiple queued presents, and the
   * "nothing pending" case (cancel after an already-cleared scan, or app start)
   * — which terminates promptly because lastScheduleAt is old/zero.
   */
  dismiss(): Promise<void> {
    if (Platform.OS !== "android") return Promise.resolve(); // scan notification is Android-only
    return enqueue(async () => {
      const Notifications = await getNotifications();
      if (!Notifications) return;
      const STABLE_ABSENT = 3;
      let absentStreak = 0;
      for (let attempt = 0; attempt < 30; attempt++) {
        let present: boolean;
        try {
          present = await isScanNotificationPresent(Notifications);
        } catch {
          try {
            await Notifications.dismissNotificationAsync(SCAN_NOTIFICATION_ID);
          } catch {
            /* no-op */
          }
          return;
        }
        absentStreak = present ? 0 : absentStreak + 1;
        try {
          await Notifications.dismissNotificationAsync(SCAN_NOTIFICATION_ID);
        } catch {
          return;
        }
        const noPresentInFlight = Date.now() - lastScheduleAt > PRESENT_LATENCY_MS;
        if (absentStreak >= STABLE_ABSENT && noPresentInFlight) return;
        await delay(110);
      }
    });
  },

  /** Fires `onStop` when the notification's Stop action button is pressed. */
  async addStopListener(onStop: () => void) {
    const Notifications = await getNotifications();
    if (!Notifications) return undefined;
    try {
      return Notifications.addNotificationResponseReceivedListener((response) => {
        if (response.actionIdentifier === SMART_CLEAN_STOP_ACTION) onStop();
      });
    } catch {
      return undefined;
    }
  }
};
