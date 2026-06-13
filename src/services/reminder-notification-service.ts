import { Platform } from "react-native";
import i18n from "@/i18n";

/**
 * Recurring local reminder notifications (cleanup / compression / Pro).
 *
 * Uses expo-notifications, which is already in the installed APK (compression
 * uses it) — so this needs NO native rebuild. Each category owns a fixed set of
 * stable identifiers; `applyReminderSchedule` cancels them all and re-schedules
 * only the enabled ones, so toggling a setting is idempotent and never leaves
 * orphaned schedules. Content is pulled from the live i18n instance so the
 * reminders follow the selected app language.
 */

const REMINDERS_CHANNEL_ID = "reminders";

type ExpoNotificationsModule = typeof import("expo-notifications");

type ScheduleInput = {
  master: boolean;
  cleanup: boolean;
  compression: boolean;
  pro: boolean;
};

type DailySlot = { hour: number; minute: number };
type WeeklySlot = { weekday: number; hour: number; minute: number }; // weekday: 1 = Sunday … 7 = Saturday

// Cleanup nudges "throughout the day" — late morning + evening.
const CLEANUP_SLOTS: DailySlot[] = [
  { hour: 11, minute: 0 },
  { hour: 18, minute: 0 }
];
// Compression reminders 2–3× per week — Mon / Wed / Fri early evening.
const COMPRESSION_SLOTS: WeeklySlot[] = [
  { weekday: 2, hour: 18, minute: 0 },
  { weekday: 4, hour: 18, minute: 0 },
  { weekday: 6, hour: 18, minute: 0 }
];
// Pro highlight once a week — Sunday midday.
const PRO_SLOTS: WeeklySlot[] = [{ weekday: 1, hour: 12, minute: 0 }];

const CLEANUP_IDS = CLEANUP_SLOTS.map((_slot, index) => `reminder-cleanup-${index}`);
const COMPRESSION_IDS = COMPRESSION_SLOTS.map((_slot, index) => `reminder-compression-${index}`);
const PRO_IDS = PRO_SLOTS.map((_slot, index) => `reminder-pro-${index}`);
const ALL_REMINDER_IDS = [...CLEANUP_IDS, ...COMPRESSION_IDS, ...PRO_IDS];

let available = true;

async function getNotifications(): Promise<ExpoNotificationsModule | undefined> {
  if (!available) return undefined;
  try {
    return await import("expo-notifications");
  } catch {
    available = false;
    return undefined;
  }
}

async function ensureChannel(Notifications: ExpoNotificationsModule) {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
    name: "Reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#075ec8"
  });
}

async function cancelAllReminders(Notifications: ExpoNotificationsModule) {
  await Promise.all(
    ALL_REMINDER_IDS.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined))
  );
}

export const ReminderNotificationService = {
  async getPermissionStatus(): Promise<"granted" | "denied" | "undetermined"> {
    const Notifications = await getNotifications();
    if (!Notifications) return "denied";
    try {
      const permission = await Notifications.getPermissionsAsync();
      if (permission.granted || permission.status === "granted") return "granted";
      if (permission.canAskAgain === false) return "denied";
      return permission.status === "denied" ? "denied" : "undetermined";
    } catch {
      return "denied";
    }
  },

  async requestPermission(): Promise<boolean> {
    const Notifications = await getNotifications();
    if (!Notifications) return false;
    try {
      const existing = await Notifications.getPermissionsAsync();
      if (existing.granted || existing.status === "granted") return true;
      if (existing.canAskAgain === false) return false;
      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted || requested.status === "granted";
    } catch {
      return false;
    }
  },

  /**
   * Re-sync the OS schedule to match the current toggles. Cancels every reminder
   * first, then schedules the enabled categories — but only when the master
   * toggle is on AND the OS permission is granted (otherwise everything stays
   * cancelled). Safe to call on launch and on every toggle change.
   */
  async applyReminderSchedule(input: ScheduleInput): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    try {
      await cancelAllReminders(Notifications);

      if (!input.master) return;
      const status = await this.getPermissionStatus();
      if (status !== "granted") return;

      await ensureChannel(Notifications);
      const t = i18n.t.bind(i18n);
      const trigger = (extra: Record<string, number>, type: "DAILY" | "WEEKLY") => ({
        type: Notifications.SchedulableTriggerInputTypes[type],
        channelId: REMINDERS_CHANNEL_ID,
        ...extra
      });

      const jobs: Promise<string>[] = [];

      if (input.cleanup) {
        CLEANUP_SLOTS.forEach((slot, index) => {
          jobs.push(
            Notifications.scheduleNotificationAsync({
              identifier: CLEANUP_IDS[index],
              content: { title: t("reminders.cleanupTitle"), body: t("reminders.cleanupBody"), data: { type: "reminder-cleanup" } },
              trigger: trigger({ hour: slot.hour, minute: slot.minute }, "DAILY") as never
            })
          );
        });
      }

      if (input.compression) {
        COMPRESSION_SLOTS.forEach((slot, index) => {
          jobs.push(
            Notifications.scheduleNotificationAsync({
              identifier: COMPRESSION_IDS[index],
              content: { title: t("reminders.compressionTitle"), body: t("reminders.compressionBody"), data: { type: "reminder-compression" } },
              trigger: trigger({ weekday: slot.weekday, hour: slot.hour, minute: slot.minute }, "WEEKLY") as never
            })
          );
        });
      }

      if (input.pro) {
        PRO_SLOTS.forEach((slot, index) => {
          jobs.push(
            Notifications.scheduleNotificationAsync({
              identifier: PRO_IDS[index],
              content: { title: t("reminders.proTitle"), body: t("reminders.proBody"), data: { type: "reminder-pro" } },
              trigger: trigger({ weekday: slot.weekday, hour: slot.hour, minute: slot.minute }, "WEEKLY") as never
            })
          );
        });
      }

      await Promise.all(jobs);
    } catch {
      available = false;
    }
  }
};
