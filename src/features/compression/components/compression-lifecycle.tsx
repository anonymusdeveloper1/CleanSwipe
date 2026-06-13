import { useEffect } from "react";
import { AppState } from "react-native";
import { useCompressionStore } from "@/features/compression/compression.store";

export function CompressionLifecycle() {
  useEffect(() => {
    void useCompressionStore.getState().resumePendingJobs();
    const subscription = AppState.addEventListener("change", (state) => {
      useCompressionStore.getState().handleAppStateChange(state);
    });
    return () => subscription.remove();
  }, []);

  return null;
}
