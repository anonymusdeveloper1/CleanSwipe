import type { TFunction } from "i18next";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/empty-state";
import { StatsCard } from "@/components/stats-card";
import { CleanupEvent } from "@/features/advanced-stats/cleanup-event.types";
import {
  buildCleanupHistory,
  buildCompressionHistory,
  buildMonthlyReport,
  buildStorageTrend,
  buildWeeklyReport
} from "@/features/advanced-stats/cleanup-report.selectors";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCleanupEventsStore } from "@/store/cleanup-events-store";
import { AlertTriangle, Archive, ArrowDown, BarChart3, Trash2, Wand2, type LucideIcon } from "lucide-react-native";
import { formatBytes } from "@/utils/format";
import { formatDate } from "@/utils/date";

/**
 * Pro advanced-stats block. Subscribes to the STABLE `events` array + the
 * `hasHydrated` primitive only — all reports are derived via pure selectors in
 * useMemo (never a fresh-object Zustand selector, which would crash).
 */
export function AdvancedStatsSection() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const events = useCleanupEventsStore((state) => state.events);
  const hasHydrated = useCleanupEventsStore((state) => state.hasHydrated);
  const now = Date.now();

  // `now` is intentionally excluded from deps: it changes every render and week
  // bucketing tolerates a slightly stale value; recompute only when events change.
  const weekly = useMemo(() => buildWeeklyReport(events, now), [events]);
  const monthly = useMemo(() => buildMonthlyReport(events, now), [events]);
  const trend = useMemo(() => buildStorageTrend(events, now, 6), [events]);
  const cleanupHistory = useMemo(() => buildCleanupHistory(events, 12), [events]);
  const compressionHistory = useMemo(() => buildCompressionHistory(events, 12), [events]);

  if (!hasHydrated) {
    return (
      <View style={{ minHeight: 120, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>
        {t("advancedStats.title")}
      </Text>

      {events.length === 0 ? (
        <EmptyState icon={BarChart3} title={t("advancedStats.emptyTitle")} message={t("advancedStats.emptyMessage")} />
      ) : (
        <>
          <Text selectable style={{ color: theme.muted, fontSize: 15, fontWeight: "800" }}>
            {t("advancedStats.weekly")}
          </Text>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <StatsCard label={t("advancedStats.itemsRemoved")} value={(weekly.deletedCount + weekly.originalsDeletedCount).toLocaleString()} />
            {/* "Reclaimed" = space actually freed: manual deletes + originals deleted
                after compression (whose bytes already equal the net savedBytes).
                Compression-only savings (itemCompressed) are NOT counted here — a kept
                original frees nothing — which also prevents double-counting. */}
            <StatsCard label={t("advancedStats.spaceReclaimed")} value={formatBytes(weekly.deletedBytes + weekly.originalsDeletedBytes)} tone="green" />
          </View>

          <Text selectable style={{ color: theme.muted, fontSize: 15, fontWeight: "800" }}>
            {t("advancedStats.monthly")}
          </Text>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <StatsCard label={t("advancedStats.itemsRemoved")} value={(monthly.deletedCount + monthly.originalsDeletedCount).toLocaleString()} />
            <StatsCard label={t("advancedStats.compressed")} value={monthly.compressedCount.toLocaleString()} />
          </View>

          <StorageTrendChart trend={trend} />

          <HistoryList title={t("advancedStats.cleanupHistory")} events={cleanupHistory} renderLabel={(e) => cleanupRowLabel(e, t)} emptyIcon={Trash2} />
          <HistoryList title={t("advancedStats.compressionHistory")} events={compressionHistory} renderLabel={(e) => compressionRowLabel(e, t)} emptyIcon={Archive} />
        </>
      )}
    </View>
  );
}

function StorageTrendChart({ trend }: { trend: { weeksAgo: number; reclaimedBytes: number }[] }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const maxBytes = Math.max(1, ...trend.map((bucket) => bucket.reclaimedBytes));

  return (
    <View style={{ padding: 16, borderRadius: 14, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border, gap: 12 }}>
      <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}>
        {t("advancedStats.storageTrend")}
      </Text>
      <View style={{ gap: 9 }}>
        {trend.map((bucket) => (
          <View key={bucket.weeksAgo} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text selectable style={{ color: theme.muted, fontSize: 12, fontWeight: "800", width: 64 }}>
              {bucket.weeksAgo === 0 ? t("advancedStats.weekThis") : t("advancedStats.weekAgo", { n: bucket.weeksAgo })}
            </Text>
            <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: theme.surfaceStrong, overflow: "hidden" }}>
              <View style={{ width: `${Math.round((bucket.reclaimedBytes / maxBytes) * 100)}%`, height: 10, backgroundColor: theme.accent }} />
            </View>
            <Text selectable style={{ color: theme.muted, fontSize: 12, fontWeight: "800", width: 64, textAlign: "right" }}>
              {formatBytes(bucket.reclaimedBytes)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function HistoryList({
  title,
  events,
  renderLabel,
  emptyIcon
}: {
  title: string;
  events: CleanupEvent[];
  renderLabel: (event: CleanupEvent) => string;
  emptyIcon: LucideIcon;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const EmptyIcon = emptyIcon;
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}>
        {title}
      </Text>
      <View style={{ backgroundColor: theme.surfaceSoft, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 4, paddingVertical: 4 }}>
        {events.length === 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(theme.faint, 0.18) }}>
              <EmptyIcon size={16} color={theme.faint} />
            </View>
            <Text selectable style={{ color: theme.faint, fontSize: 13, fontWeight: "700" }}>
              {t("advancedStats.noEntries")}
            </Text>
          </View>
        ) : (
          events.map((event, index) => {
            const { Icon, colorKey } = eventVisual(event);
            const color = theme[colorKey];
            const isLast = index === events.length - 1;
            return (
              <View
                key={event.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(color, 0.14) }}>
                  <Icon size={18} strokeWidth={2.2} color={color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text selectable numberOfLines={1} style={{ color: theme.text, fontSize: 14, fontWeight: "800" }}>
                    {renderLabel(event)}
                  </Text>
                  <Text selectable style={{ color: theme.muted, fontSize: 12, fontWeight: "600" }}>
                    {formatDate(event.at)}
                  </Text>
                </View>
                {(event.bytes ?? 0) > 0 ? (
                  <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9, backgroundColor: withAlpha(theme.green, 0.14) }}>
                    <Text selectable style={{ color: theme.green, fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                      {formatBytes(event.bytes)}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

// Appends an alpha channel to a 6-digit hex (theme tokens are all #RRGGBB) to make
// soft tinted badges without new color tokens; non-hex input is returned as-is.
function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.max(0, Math.min(alpha, 1)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

// Maps each cleanup/compression event type to its badge icon + theme color key.
function eventVisual(event: CleanupEvent): { Icon: LucideIcon; colorKey: "red" | "green" | "accent" | "muted" } {
  switch (event.type) {
    case "smartCleanActionConfirmed":
      return { Icon: Wand2, colorKey: "accent" };
    case "itemCompressed":
      return { Icon: Archive, colorKey: "green" };
    case "originalDeletedAfterCompression":
      return { Icon: ArrowDown, colorKey: "accent" };
    case "compressionFailed":
      return { Icon: AlertTriangle, colorKey: "red" };
    case "itemDeleted":
      return { Icon: Trash2, colorKey: "red" };
    default:
      return { Icon: Trash2, colorKey: "muted" };
  }
}

function cleanupRowLabel(event: CleanupEvent, t: TFunction): string {
  if (event.type === "smartCleanActionConfirmed") return t("advancedStats.rowSmartClean", { count: event.count ?? 1 });
  return t("advancedStats.rowDeleted", { count: event.count ?? 1 });
}

function compressionRowLabel(event: CleanupEvent, t: TFunction): string {
  if (event.type === "compressionFailed") return t("advancedStats.rowFailed");
  if (event.type === "originalDeletedAfterCompression") return t("advancedStats.rowOriginalDeleted");
  return t("advancedStats.rowCompressed");
}
