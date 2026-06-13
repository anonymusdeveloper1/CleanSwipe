import { Platform } from "react-native";
import { CompressionJob, CompressionResult } from "@/features/compression/compression.types";
import { BackgroundCompressionWorker } from "@/services/background-compression-worker";
import { NotificationService } from "@/services/notification-service";
import { formatBytes } from "@/utils/format";

const MIN_NOTIFICATION_UPDATE_MS = 180;

type ProgressNotificationState = {
  inFlight: boolean;
  lastPercent: number;
  lastSentAt: number;
  pending?: {
    job: CompressionJob;
    progress: number;
  };
  timeout?: ReturnType<typeof setTimeout>;
};

const progressNotificationStates: Record<string, ProgressNotificationState> = {};

export const CompressionNotifications = {
  requestPermission() {
    return NotificationService.requestCompressionPermission();
  },

  addResponseListener(onOpen: (url: string) => void) {
    return NotificationService.addCompressionResponseListener(onOpen);
  },

  async runInForeground<T>(job: CompressionJob, task: () => Promise<T>) {
    const description = formatActiveDescription(job, 0);
    try {
      return await BackgroundCompressionWorker.run(description, task);
    } finally {
      await BackgroundCompressionWorker.stop();
      clearProgressNotificationState(job.id);
    }
  },

  async stopActive() {
    await BackgroundCompressionWorker.stop();
  },

  isForegroundRunning() {
    return BackgroundCompressionWorker.isRunning();
  },

  async updateProgress(job: CompressionJob, progress: number) {
    if (Platform.OS !== "android") return;
    const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
    const state = getProgressNotificationState(job.id);
    const isTerminalProgress = percent === 0 || percent === 100;
    const shouldSendNow = !state.inFlight && (isTerminalProgress || (percent !== state.lastPercent && Date.now() - state.lastSentAt >= MIN_NOTIFICATION_UPDATE_MS));

    state.pending = { job, progress };
    if (shouldSendNow) {
      await flushProgressNotification(job.id);
      return;
    }

    if (!state.timeout) {
      const waitMs = Math.max(MIN_NOTIFICATION_UPDATE_MS - (Date.now() - state.lastSentAt), 0);
      state.timeout = setTimeout(() => {
        state.timeout = undefined;
        void flushProgressNotification(job.id);
      }, waitMs);
    }
  },

  async showCompleted(job: CompressionJob, result: CompressionResult) {
    await NotificationService.showCompressionNotification({
      title: "Compression complete",
      body: job.shouldAskDeleteOriginal
        ? "Open SwipeClean to choose whether to delete the original."
        : result.savedBytes > 0
          ? `Saved ${formatBytes(result.savedBytes)} from ${job.fileName}.`
          : `${job.fileName} was compressed.`,
      progress: 1,
      sourceId: job.mediaId,
      outputUri: result.outputUri,
      mediaType: job.mediaType,
      url: getCompressionViewerPath(job.mediaId)
    });
  },

  async showQueueCompleted(completedCount: number, savedBytes: number) {
    if (completedCount <= 0) return;
    await NotificationService.showCompressionNotification({
      title: "Compression complete",
      body: `${completedCount} file${completedCount === 1 ? "" : "s"} compressed. Open SwipeClean to review originals.`,
      progress: 1,
      url: "/(tabs)/history"
    });
  },

  async showFailed(job: CompressionJob, message: string) {
    await NotificationService.showCompressionNotification({
      title: "Compression failed",
      body: `${job.fileName}: ${message}`,
      progress: 0,
      sourceId: job.mediaId,
      mediaType: job.mediaType,
      url: getCompressionDetailPath(job.mediaId)
    });
  }
};

function formatActiveDescription(job: CompressionJob, progress: number) {
  const position = job.queueTotal && job.queueTotal > 1 && job.queuePosition ? ` (${job.queuePosition}/${job.queueTotal})` : "";
  return `${job.fileName}${position} - ${Math.round(progress * 100)}%`;
}

function getProgressNotificationState(jobId: string) {
  progressNotificationStates[jobId] ??= {
    inFlight: false,
    lastPercent: -1,
    lastSentAt: 0
  };
  return progressNotificationStates[jobId];
}

async function flushProgressNotification(jobId: string) {
  const state = getProgressNotificationState(jobId);
  if (state.inFlight || !state.pending) return;

  const pending = state.pending;
  const percent = Math.max(0, Math.min(100, Math.round(pending.progress * 100)));
  if (percent === state.lastPercent && percent !== 0 && percent !== 100) {
    state.pending = undefined;
    return;
  }

  state.pending = undefined;
  state.inFlight = true;
  state.lastPercent = percent;
  state.lastSentAt = Date.now();

  try {
    await BackgroundCompressionWorker.update({
      description: formatActiveDescription(pending.job, pending.progress),
      progress: pending.progress,
      linkingURI: getCompressionDetailDeepLink(pending.job.mediaId)
    });
  } finally {
    state.inFlight = false;
    if (state.pending && !state.timeout) {
      const waitMs = Math.max(MIN_NOTIFICATION_UPDATE_MS - (Date.now() - state.lastSentAt), 0);
      state.timeout = setTimeout(() => {
        state.timeout = undefined;
        void flushProgressNotification(jobId);
      }, waitMs);
    }
  }
}

function clearProgressNotificationState(jobId: string) {
  const state = progressNotificationStates[jobId];
  if (state?.timeout) {
    clearTimeout(state.timeout);
  }
  delete progressNotificationStates[jobId];
}

function getCompressionDetailPath(sourceId: string) {
  return `/compression-detail?id=${encodeURIComponent(sourceId)}`;
}

function getCompressionViewerPath(sourceId: string) {
  // result=1 puts the viewer in Android result mode (shows the result sheet).
  return `/compression-media-viewer?id=${encodeURIComponent(sourceId)}&result=1`;
}

function getCompressionDetailDeepLink(sourceId: string) {
  return `swipeclean://compression-detail?id=${encodeURIComponent(sourceId)}`;
}
