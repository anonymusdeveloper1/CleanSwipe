import { Platform } from "react-native";

const COMPRESSION_CHANNEL_ID = "compression-progress";
const MIN_PROGRESS_STEP = 0.15;

type ExpoNotificationsModule = typeof import("expo-notifications");

type CompressionNotificationState = {
  notificationId?: string;
  lastProgress: number;
  permissionChecked: boolean;
  available: boolean;
};

const state: CompressionNotificationState = {
  lastProgress: -1,
  permissionChecked: false,
  available: true
};

async function getNotifications(): Promise<ExpoNotificationsModule | undefined> {
  if (!state.available) return undefined;
  try {
    return await import("expo-notifications");
  } catch {
    state.available = false;
    return undefined;
  }
}

export const NotificationService = {
  async requestCompressionPermission() {
    const Notifications = await getNotifications();
    if (!Notifications) return false;

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true
        })
      });

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(COMPRESSION_CHANNEL_ID, {
          name: "Compression progress",
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0],
          lightColor: "#075ec8"
        });
      }

      const existing = await Notifications.getPermissionsAsync();
      if (existing.granted || existing.status === "granted") {
        state.permissionChecked = true;
        return true;
      }

      if (existing.canAskAgain === false) {
        state.permissionChecked = true;
        return false;
      }

      const requested = await Notifications.requestPermissionsAsync();
      state.permissionChecked = true;
      return requested.granted || requested.status === "granted";
    } catch {
      state.available = false;
      return false;
    }
  },

  async notifyCompressionStarted(label: string) {
    state.lastProgress = -1;
    const allowed = await this.requestCompressionPermission();
    if (!allowed) return;
    await this.showCompressionNotification("Compression started", `${label} - 0%`, 0);
  },

  async notifyCompressionProgress(label: string, progress: number) {
    if (!state.permissionChecked) {
      await this.requestCompressionPermission();
    }

    const clampedProgress = Math.max(0, Math.min(progress, 1));
    if (clampedProgress < 1 && state.lastProgress >= 0 && clampedProgress - state.lastProgress < MIN_PROGRESS_STEP) {
      return;
    }

    state.lastProgress = clampedProgress;
    await this.showCompressionNotification("Compression in progress", `${label} - ${Math.round(clampedProgress * 100)}%`, clampedProgress);
  },

  async notifyCompressionComplete(label: string) {
    state.lastProgress = 1;
    await this.showCompressionNotification("Compression complete", `${label} was saved to your library.`, 1);
  },

  async notifyCompressionFailed(message: string) {
    await this.showCompressionNotification("Compression failed", message, 0);
  },

  async showCompressionNotification(title: string, body: string, progress: number) {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    try {
      if (state.notificationId) {
        await Notifications.dismissNotificationAsync(state.notificationId).catch(() => undefined);
      }

      state.notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: "compression", progress },
          sound: false
        },
        trigger: null
      });
    } catch {
      state.available = false;
    }
  }
};
