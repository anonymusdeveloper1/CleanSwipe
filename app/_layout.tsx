import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CompressionProgressNotification } from "@/components/compression-progress-notification";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePhotoLibrarySync } from "@/hooks/use-photo-library-sync";

export default function RootLayout() {
  const theme = useAppTheme();
  usePhotoLibrarySync();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background }
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: "card" }} />
        <Stack.Screen
          name="month-selector"
          options={{ presentation: "formSheet", sheetAllowedDetents: [0.58, 0.92], sheetGrabberVisible: false, sheetCornerRadius: 28 }}
        />
        <Stack.Screen name="review-delete-list" options={{ presentation: "card" }} />
        <Stack.Screen name="selected-photos" options={{ presentation: "card" }} />
        <Stack.Screen name="largest-photos" options={{ presentation: "card" }} />
        <Stack.Screen name="photo-preview" options={{ presentation: "modal" }} />
        <Stack.Screen name="compression-media-viewer" options={{ presentation: "transparentModal", animation: "fade", contentStyle: { backgroundColor: "transparent" } }} />
        <Stack.Screen name="compression-detail" options={{ presentation: "card" }} />
      </Stack>
      <CompressionProgressNotification />
    </GestureHandlerRootView>
  );
}
