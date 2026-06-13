import type { LucideIcon } from "lucide-react-native";
import { ChevronRight, Lock } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SmartCleanStatus } from "@/features/smart-clean/smart-clean.types";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatBytes } from "@/utils/format";

type Props = {
  icon: LucideIcon;
  title: string;
  explanation: string;
  status: SmartCleanStatus;
  locked?: boolean;
  scanning?: boolean;
  itemCount?: number;
  estimatedReclaimableBytes?: number;
  onPrimary?: () => void;
};

/**
 * Presentational Smart Clean category card. Renders an honest state for each
 * detector status — in Stage 2 every detector is `not_available`, so the action
 * is disabled and NO count/bytes are shown (no fabricated destructive numbers).
 * The `ready` branch (count + "Review N items") is unreachable until a real
 * detector ships.
 */
export function SmartCleanCard({ icon: Icon, title, explanation, status, locked = false, scanning = false, itemCount, estimatedReclaimableBytes, onPrimary }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  const showStats = !scanning && status === "ready" && (itemCount ?? 0) > 0;
  // Only `ready` (real results), `needs_permission`, and `locked` expose an
  // enabled action — and never while this card is being scanned.
  const actionable = (locked || status === "ready" || status === "needs_permission") && !scanning;
  // Before a scan ("idle") there is no per-card action — the top "Scan now"
  // button drives it — so hide the button (unless this card is mid-scan).
  const showButton = scanning || status !== "idle";
  const statusPill = scanning
    ? null
    : status === "idle"
      ? t("smartClean.notScanned")
      : status === "empty"
        ? t("smartClean.nothingFound")
        : status === "not_available"
          ? t("smartClean.comingSoon")
          : null;
  const actionLabel = scanning
    ? t("smartClean.scanning")
    : locked
      ? t("smartClean.unlock")
      : status === "needs_permission"
        ? t("smartClean.grantAccess")
        : status === "ready"
          ? t("smartClean.reviewItems", { count: itemCount ?? 0 })
          : status === "empty"
            ? t("smartClean.nothingFound")
            : t("smartClean.comingSoon");

  return (
    <View style={{ backgroundColor: theme.surfaceSoft, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" }}>
          <Icon size={22} color={theme.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text selectable numberOfLines={1} style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}>
            {title}
          </Text>
          <Text selectable numberOfLines={2} style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>
            {explanation}
          </Text>
        </View>
        {!locked && !showStats && statusPill ? (
          <View style={{ backgroundColor: theme.surfaceStrong, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "900" }}>
              {statusPill}
            </Text>
          </View>
        ) : null}
      </View>

      {showStats ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: "800" }}>
            {t("smartClean.foundItems", { count: itemCount ?? 0 })}
          </Text>
          {(estimatedReclaimableBytes ?? 0) > 0 ? (
            <Text selectable style={{ color: theme.green, fontSize: 14, fontWeight: "800" }}>
              {t("smartClean.reclaimable", { size: formatBytes(estimatedReclaimableBytes) })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showButton ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !actionable }}
          accessibilityLabel={actionLabel}
          disabled={!actionable}
          onPress={onPrimary}
          style={{
            minHeight: 44,
            borderRadius: 11,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: actionable ? theme.accent : theme.surfaceStrong,
            opacity: actionable ? 1 : 0.7
          }}
        >
          {scanning ? <ActivityIndicator size="small" color={theme.muted} /> : locked ? <Lock size={16} color="#fff" /> : null}
          <Text style={{ color: scanning ? theme.muted : actionable ? "#fff" : theme.muted, fontSize: 14, fontWeight: "900" }}>
            {actionLabel}
          </Text>
          {!scanning && status === "ready" && !locked ? <ChevronRight size={16} color="#fff" /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}
