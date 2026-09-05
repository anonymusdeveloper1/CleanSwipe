import { BrushCleaning } from "lucide-react-native";
import { useEffect } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PermissionService } from "@/services/permission-service";
import { useAppStore } from "@/store/app-store";

type Props = {
  /** Screen-specific explanation shown while the OS can still be asked. */
  message?: string;
  /** Render without the app header (for surfaces that draw their own). */
  hideHeader?: boolean;
};

/**
 * The single media-permission gate. Every screen that reads the media library
 * renders this when access is missing, so the recovery path is identical
 * everywhere instead of being re-implemented per screen.
 *
 * WHY THIS RE-READS THE OS ON MOUNT — the bug this fixes:
 * `app-store`'s `partialize` deliberately refuses to persist a non-readable
 * permission, rewriting it to `{ status: "not-requested" }`. That drops
 * `canAskAgain`, so after a cold launch a permanently-denied user rehydrates as
 * "never asked". The gate would then offer "Allow Access", the OS would refuse
 * to present a dialog (Android after two denials, iOS after one), and the tap
 * would do nothing visible — the app appearing to "just block".
 *
 * Reading the live grant on mount restores `canAskAgain` before the first paint
 * of the CTA, so the button always reflects what the OS will actually do.
 *
 * WHY IT ALSO LISTENS TO AppState:
 * `usePhotoLibrarySync` attaches its poll and MediaLibrary listener ONLY while
 * access is readable — it early-returns when denied. So in exactly the state
 * this gate is shown, there is no periodic safety net, and a grant made in
 * system Settings would not be noticed until something else happened to
 * refresh. Re-reading on every foreground is what makes "allow in Settings →
 * come back → it loads" work. This is deliberately duplicated with the sync
 * hook's own listener: that one is about the library, this one is about
 * escaping the gate, and it must keep working even if the other is detached.
 */
export function MediaPermissionGate({ message, hideHeader }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const permission = useAppStore((state) => state.permission);
  const requestingPermission = useAppStore((state) => state.requestingPermission);
  const requestPhotoPermission = useAppStore((state) => state.requestPhotoPermission);
  const refreshPermissionStatus = useAppStore((state) => state.refreshPermissionStatus);
  const error = useAppStore((state) => state.error);

  useEffect(() => {
    void refreshPermissionStatus();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPermissionStatus();
    });
    return () => subscription.remove();
  }, [refreshPermissionStatus]);

  // The OS will not present a dialog again. Settings is the only route left.
  // Anything else — including "not-requested" — still gets a real prompt, which
  // is what makes the gate re-ask rather than dead-end.
  const permanentlyDenied = permission.status === "denied" && permission.canAskAgain === false;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {hideHeader ? null : <AppHeader />}
      <EmptyState
        icon={BrushCleaning}
        title={t("permissions.mediaTitle")}
        message={
          permanentlyDenied
            ? t("permissions.deniedMessage")
            : error ?? message ?? t("permissions.photosMessage")
        }
        actionLabel={
          permanentlyDenied
            ? t("common.openSettings")
            : requestingPermission
              ? t("common.requesting")
              : t("common.allowAccess")
        }
        onAction={permanentlyDenied ? PermissionService.openSettings : requestPhotoPermission}
      />
      {permanentlyDenied ? null : (
        <View style={{ paddingHorizontal: 28 }}>
          <Pressable onPress={PermissionService.openSettings} style={{ alignItems: "center", padding: 16 }}>
            <Text style={{ color: theme.accent, fontWeight: "800", fontSize: 16 }}>{t("common.openSettings")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
