import * as MediaLibrary from "expo-media-library";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAppStore } from "@/store/app-store";

const POLL_INTERVAL_MS = 45_000;

export function usePhotoLibrarySync() {
  const permission = useAppStore((state) => state.permission);
  const refreshPhotos = useAppStore((state) => state.refreshPhotos);
  const refreshing = useRef(false);

  useEffect(() => {
    if (permission.status !== "granted" && permission.status !== "limited") {
      return undefined;
    }

    const refresh = async () => {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        await refreshPhotos();
      } finally {
        refreshing.current = false;
      }
    };

    const mediaSubscription = MediaLibrary.addListener(() => {
      void refresh();
    });
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
      }
    });
    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      mediaSubscription.remove();
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [permission.status, refreshPhotos]);
}
