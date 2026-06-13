import BackgroundService, { BackgroundTaskOptions } from "react-native-background-actions";

type WorkerNotification = {
  title?: string;
  description?: string;
  progress?: number;
  linkingURI?: string;
};

const taskIcon = {
  name: "ic_launcher",
  type: "mipmap"
};

export const BackgroundCompressionWorker = {
  isRunning() {
    return BackgroundService.isRunning();
  },

  async run<T>(description: string, task: () => Promise<T>): Promise<T> {
    if (BackgroundService.isRunning()) {
      throw new Error("Compression worker is already running.");
    }

    return new Promise<T>((resolve, reject) => {
      const options: BackgroundTaskOptions & { parameters?: undefined } = {
        taskName: "SwipeCleanCompression",
        taskTitle: "SwipeClean is compressing",
        taskDesc: description,
        taskIcon,
        color: "#075ec8",
        linkingURI: "swipeclean://compression-detail",
        progressBar: {
          max: 100,
          value: 0,
          indeterminate: false
        },
        foregroundServiceType: ["dataSync"]
      };

      const workerTask = async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      BackgroundService.start(workerTask, options).catch(reject);
    });
  },

  async update(notification: WorkerNotification) {
    if (!BackgroundService.isRunning()) return;
    await BackgroundService.updateNotification({
      taskTitle: notification.title ?? "SwipeClean is compressing",
      taskDesc: notification.description ?? "Compression is running in the background.",
      linkingURI: notification.linkingURI,
      progressBar:
        typeof notification.progress === "number"
          ? {
              max: 100,
              value: Math.max(0, Math.min(100, Math.round(notification.progress * 100))),
              indeterminate: false
            }
          : undefined
    }).catch(() => undefined);
  },

  async stop() {
    if (!BackgroundService.isRunning()) return;
    await BackgroundService.stop().catch(() => undefined);
  }
};
