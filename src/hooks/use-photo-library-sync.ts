import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAppStore } from "@/store/app-store";

const POLL_INTERVAL_MS = 45_000;

export function usePhotoLibrarySync() {
  const status = useAppStore((state) => state.permission.status);
  const refreshPhotos = useAppStore((state) => state.refreshPhotos);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      await refreshPhotos();
    } finally {
      refreshing.current = false;
    }
  }, [refreshPhotos]);

  // Always-on foreground reload — attached even while access is denied. This is
  // what makes "grant in system Settings → return to the app → instant load"
  // work from any screen, and it re-reads the accessible set after the user
  // edits their "selected photos" (Android delivers no selection-change event,
  // so this foreground pass is what reconciles the limited set there).
  // refreshPhotos re-checks the live permission and either loads (granted /
  // limited) or refreshes the gate (denied); it never re-prompts.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  // Library-change events and the periodic poll both need read access, so wire
  // them only when the app can actually read media. When refreshPhotos flips the
  // permission status, this effect re-runs and attaches/detaches accordingly.
  useEffect(() => {
    if (status !== "granted" && status !== "limited") {
      return undefined;
    }

    const mediaSubscription = MediaLibrary.addListener(() => {
      void refresh();
    });
    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      mediaSubscription.remove();
      clearInterval(interval);
    };
  }, [status, refresh]);
}
