import { Platform } from "react-native";

const COMPRESSION_CHANNEL_ID = "compression-progress";
const COMPLETION_NOTIFICATION_ID = "compression-complete";
const PROGRESS_NOTIFICATION_STEP = 0.08;

type CompressionNoticeOptions = {
  current?: number;
  total?: number;
  sourceId?: string;
  outputUri?: string;
  mediaType?: "photo" | "video" | "unknown";
  url?: string;
};

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
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true
        })
      });

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(COMPRESSION_CHANNEL_ID, {
          name: "Compression progress",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 150, 80, 150],
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

  async notifyCompressionStarted(label: string, options: CompressionNoticeOptions = {}) {
    state.lastProgress = -1;
    if (!state.permissionChecked) {
      await this.requestCompressionPermission();
    }

    await this.showCompressionNotification({
      title: "Compression started",
      body: `${formatLabel(label, options)} is being compressed.`,
      progress: 0,
      sourceId: options.sourceId,
      outputUri: options.outputUri,
      mediaType: options.mediaType,
      url: options.url
    });
  },

  async notifyCompressionProgress(label: string, progress: number, options: CompressionNoticeOptions = {}) {
    if (!state.permissionChecked) {
      await this.requestCompressionPermission();
    }

    const clampedProgress = Math.max(0, Math.min(progress, 1));
    if (state.lastProgress >= 0 && clampedProgress < 1 && clampedProgress - state.lastProgress < PROGRESS_NOTIFICATION_STEP) {
      return;
    }

    state.lastProgress = clampedProgress;
    await this.showCompressionNotification({
      title: "Compressing media",
      body: `${formatLabel(label, options)} is ${Math.round(clampedProgress * 100)}% complete.`,
      progress: clampedProgress,
      sourceId: options.sourceId,
      outputUri: options.outputUri,
      mediaType: options.mediaType,
      url: options.url
    });
  },

  async notifyCompressionComplete(label: string, options: CompressionNoticeOptions = {}) {
    state.lastProgress = 1;
    await this.showCompressionNotification({
      title: "Compression finished",
      body: `${formatLabel(label, options)} was saved to your library.`,
      progress: 1,
      sourceId: options.sourceId,
      outputUri: options.outputUri,
      mediaType: options.mediaType,
      url: options.url
    });
  },

  async notifyCompressionQueueComplete(completedCount: number) {
    state.lastProgress = 1;
    if (completedCount <= 0) return;
    await this.showCompressionNotification({
      title: "Compression queue complete",
      body: `${completedCount} ${completedCount === 1 ? "item" : "items"} compressed successfully.`,
      progress: 1
    });
  },

  async notifyCompressionFailed(message: string) {
    await this.showCompressionNotification({
      title: "Compression failed",
      body: message,
      progress: 0
    });
  },

  async addCompressionResponseListener(onOpen: (url: string) => void) {
    const Notifications = await getNotifications();
    if (!Notifications) return undefined;

    try {
      const openResponse = (response: import("expo-notifications").NotificationResponse | null) => {
        const data = response?.notification.request.content.data;
        const url = typeof data?.url === "string" ? data.url : undefined;
        if (!url) return;
        onOpen(url);
      };

      openResponse(Notifications.getLastNotificationResponse());
      Notifications.clearLastNotificationResponse();

      return Notifications.addNotificationResponseReceivedListener(openResponse);
    } catch {
      state.available = false;
      return undefined;
    }
  },

  async showCompressionNotification({
    title,
    body,
    progress,
    sourceId,
    outputUri,
    mediaType,
    url
  }: {
    title: string;
    body: string;
    progress: number;
    sourceId?: string;
    outputUri?: string;
    mediaType?: "photo" | "video" | "unknown";
    url?: string;
  }) {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    try {
      // Re-use the stable identifier so the OS updates the existing notification
      // in place. Dismissing first caused a visible remove -> re-add flicker and
      // delayed the update from appearing.
      state.notificationId = await Notifications.scheduleNotificationAsync({
        identifier: COMPLETION_NOTIFICATION_ID,
        content: {
          title,
          body,
          data: {
            type: "compression",
            progress,
            sourceId,
            outputUri,
            mediaType,
            url
          },
          autoDismiss: true,
          priority: "default",
          sound: true,
          attachments:
            Platform.OS === "ios" && mediaType === "photo" && outputUri
              ? [
                  {
                    identifier: "compressed-media",
                    url: outputUri,
                    type: "image/jpeg"
                  }
                ]
              : undefined
        },
        trigger: Platform.OS === "android" ? { channelId: COMPRESSION_CHANNEL_ID } : null
      });
    } catch {
      state.available = false;
    }
  }
};

function formatLabel(label: string, options: CompressionNoticeOptions) {
  if (!options.total || options.total <= 1 || !options.current) return label;
  return `${label} (${options.current}/${options.total})`;
}
