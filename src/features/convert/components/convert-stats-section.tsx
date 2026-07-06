import { Image as ImageIcon, Music, Repeat, Video } from "lucide-react-native";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AnimatedBar } from "@/components/animated-bar";
import { AnimatedStatValue } from "@/components/animated-stat-value";
import { useConvertStore } from "@/features/convert/convert.store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatBytes } from "@/utils/format";

// Soft tinted badge from a #RRGGBB token (no new color tokens needed).
function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.max(0, Math.min(alpha, 1)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

/**
 * Lifetime conversion stats for the Stats screen — total conversions, a
 * by-output-kind breakdown (images / videos / audio) with animated proportion
 * bars, and the total media processed. Reads the durable `lifetime` tally from
 * the convert store (survives clearing the Recent list). Everyone sees it; a user
 * who hasn't converted anything gets a friendly empty state.
 */
export function ConvertStatsSection() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const lifetime = useConvertStore((state) => state.lifetime);

  const kinds = [
    { key: "images", count: lifetime.image, color: "#378ADD", Icon: ImageIcon },
    { key: "videos", count: lifetime.video, color: theme.accent, Icon: Video },
    { key: "audio", count: lifetime.audio, color: "#8b5cf6", Icon: Music }
  ];
  const maxKind = Math.max(1, lifetime.image, lifetime.video, lifetime.audio);

  return (
    <View style={{ padding: 20, borderRadius: 22, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(theme.accent, 0.16) }}>
          <Repeat size={18} color={theme.accent} strokeWidth={2.4} />
        </View>
        <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "900", flex: 1 }}>
          {t("stats.convert.title")}
        </Text>
      </View>

      {lifetime.total === 0 ? (
        <Text selectable style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
          {t("stats.convert.empty")}
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <MiniStat label={t("stats.convert.total")} tone={theme.accent}>
              <AnimatedStatValue
                value={lifetime.total}
                style={{ color: theme.accent, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] }}
              />
            </MiniStat>
            <MiniStat label={t("stats.convert.processed")} tone={theme.text}>
              <AnimatedStatValue
                value={lifetime.inputBytes}
                format={(n) => formatBytes(n)}
                style={{ color: theme.text, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] }}
              />
            </MiniStat>
          </View>

          <View style={{ gap: 12 }}>
            {kinds.map((kind, index) => (
              <View key={kind.key} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <kind.Icon size={15} color={kind.color} strokeWidth={2.4} />
                  <Text selectable style={{ color: theme.muted, fontSize: 14, fontWeight: "700", flex: 1 }}>
                    {t(`stats.convert.${kind.key}`)}
                  </Text>
                  <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
                    {kind.count.toLocaleString()}
                  </Text>
                </View>
                <AnimatedBar fraction={kind.count / maxKind} color={kind.color} track={theme.surfaceStrong} delay={120 + index * 90} />
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function MiniStat({ label, tone, children }: { label: string; tone: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={{ flex: 1, gap: 4, padding: 14, borderRadius: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
      {children}
      <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}
