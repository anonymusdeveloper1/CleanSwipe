import BackgroundService, { BackgroundTaskOptions } from "react-native-background-actions";

/**
 * Smart Clean scan foreground-service wrapper.
 *
 * Structural clone of {@link ../services/background-compression-worker.ts} with a
 * DISTINCT `taskName` so it never collides with the compression task. Both use
 * `react-native-background-actions` (RNBA), which is a HARD SINGLETON (one task at
 * a time). The two are kept from ever overlapping by the runner's acquisition
 * guard (`SmartCleanScan` starts the service only when neither this worker nor the
 * compression worker is running) plus a one-directional yield (the scan releases
 * the service when a compression job starts; never the reverse).
 *
 * Running the scan loop INSIDE the RNBA task callback is what keeps the JS thread
 * alive while the app is backgrounded / screen-off. If the service is later
 * stopped mid-scan (compression took priority), the task promise keeps running as
 * plain foreground JS — the documented graceful degradation.
 */

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

export const BackgroundSmartCleanScanWorker = {
  isRunning() {
    return BackgroundService.isRunning();
  },

  async run<T>(description: string, task: () => Promise<T>): Promise<T> {
    if (BackgroundService.isRunning()) {
      throw new Error("A background task is already running.");
    }

    return new Promise<T>((resolve, reject) => {
      const options: BackgroundTaskOptions & { parameters?: undefined } = {
        taskName: "SwipeCleanScan",
        taskTitle: "SwipeClean is scanning",
        taskDesc: description,
        taskIcon,
        color: "#075ec8",
        linkingURI: "swipeclean://",
        progressBar: {
          max: 100,
          value: 0,
          indeterminate: false
        },
        foregroundServiceType: ["dataSync"]
      };

      const workerTask = async () => {
        try {
          resolve(await task());
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
      taskTitle: notification.title ?? "SwipeClean is scanning",
      taskDesc: notification.description ?? "Scanning your library in the background.",
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
