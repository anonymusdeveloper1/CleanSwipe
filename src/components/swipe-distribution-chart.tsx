import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ChartPie } from "lucide-react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { AppStats } from "@/models/photo";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  stats: AppStats;
};

const PIE_SIZE = 150;

// Point on a circle for the given angle (degrees, 0 = 12 o'clock, clockwise).
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// SVG path for a pie wedge from startDeg to endDeg.
function wedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function SwipeDistributionChart({ stats }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const total = Math.max(1, stats.totalKept + stats.totalMarkedForDeletion + stats.totalRestored);
  const rows = [
    { labelKey: "distribution.kept", value: stats.totalKept, color: "#5eead4" },
    { labelKey: "distribution.deleted", value: stats.totalMarkedForDeletion, color: "#ef4444" },
    { labelKey: "distribution.restored", value: stats.totalRestored, color: theme.accent }
  ];

  const r = PIE_SIZE / 2;
  const segments = rows.filter((row) => row.value > 0);
  const segmentTotal = segments.reduce((sum, row) => sum + row.value, 0);
  const hasData = segmentTotal > 0;

  // Flat solid wedges (no separators). A single category can't be drawn as an arc
  // (start === end), so it renders as a full circle instead.
  let cumulative = 0;
  const wedges = segments.map((seg) => {
    const startDeg = (cumulative / segmentTotal) * 360;
    cumulative += seg.value;
    const endDeg = (cumulative / segmentTotal) * 360;
    return { key: seg.labelKey, color: seg.color, d: wedgePath(r, r, r, startDeg, endDeg) };
  });

  return (
    <View style={{ padding: 22, borderRadius: 22, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border, gap: 18 }}>
      <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
        {t("distribution.title")}
      </Text>

      {!hasData ? (
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 18 }}>
          <ChartPie size={40} color={theme.accent} />
          <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: "800" }}>
            {t("distribution.emptyTitle")}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
            {t("distribution.emptyMessage")}
          </Text>
        </View>
      ) : (
        <>
          <View style={{ alignItems: "center" }}>
            <Svg width={PIE_SIZE} height={PIE_SIZE}>
              {segments.length === 1 ? (
                <Circle cx={r} cy={r} r={r} fill={segments[0].color} />
              ) : (
                wedges.map((wedge) => <Path key={wedge.key} d={wedge.d} fill={wedge.color} />)
              )}
            </Svg>
          </View>

          <View style={{ gap: 8 }}>
            {rows.map((row) => (
              <View key={row.labelKey} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: row.color }} />
                <Text selectable style={{ color: theme.muted, fontSize: 16, flex: 1 }}>
                  {Math.round((row.value / total) * 100)}% {t(row.labelKey)}
                </Text>
                <Text selectable style={{ color: theme.muted, fontSize: 16, fontVariant: ["tabular-nums"] }}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
