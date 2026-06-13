import type { TFunction } from "i18next";
import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
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
import { BarChart3 } from "lucide-react-native";
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

          <HistoryList title={t("advancedStats.cleanupHistory")} events={cleanupHistory} renderLabel={(e) => cleanupRowLabel(e, t)} />
          <HistoryList title={t("advancedStats.compressionHistory")} events={compressionHistory} renderLabel={(e) => compressionRowLabel(e, t)} />
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

function HistoryList({ title, events, renderLabel }: { title: string; events: CleanupEvent[]; renderLabel: (event: CleanupEvent) => string }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}>
        {title}
      </Text>
      {events.length === 0 ? (
        <Text selectable style={{ color: theme.faint, fontSize: 13, fontWeight: "700" }}>
          {t("advancedStats.noEntries")}
        </Text>
      ) : (
        events.map((event) => (
          <View key={event.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Text selectable numberOfLines={1} style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: "700" }}>
              {renderLabel(event)}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {(event.bytes ?? 0) > 0 ? (
                <Text selectable style={{ color: theme.green, fontSize: 13, fontWeight: "800" }}>
                  {formatBytes(event.bytes)}
                </Text>
              ) : null}
              <Text selectable style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }}>
                {formatDate(event.at)}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
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
