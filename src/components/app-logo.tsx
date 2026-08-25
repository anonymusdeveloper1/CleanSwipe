import Svg, { Circle, Path } from "react-native-svg";

type Props = {
  size?: number;
  /** Main mark color. Defaults to the app accent where used. */
  color?: string;
  /** Photo-glyph color. Defaults to a darker shade of `color`. */
  glyphColor?: string;
};

/**
 * Darken a `#rgb`/`#rrggbb` color toward black.
 *
 * The mark is two-tone (ring + glyph). Every call site passes the SELECTED
 * accent, so hard-coding the glyph to one green would break the logo for the
 * other four accents. Deriving it keeps the two tones related whichever accent
 * is active.
 */
function shade(hex: string, factor: number) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  let h = match[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const channel = (i: number) => Math.round(parseInt(h.slice(i, i + 2), 16) * factor);
  const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  return `#${toHex(channel(0))}${toHex(channel(2))}${toHex(channel(4))}`;
}

/**
 * SwipeClean brand mark: an open storage ring (a meter with space freed at the
 * top-left) around a photo glyph — "reclaimed space", which is the product's
 * actual promise, rather than the swipe gesture that delivers it.
 *
 * Replaces the previous tilted card-stack mark. That design leaned on three
 * motion arcs at 0.5/0.3/0.16 opacity scaled to 0.44 inside the adaptive icon,
 * which made them effectively invisible at launcher size; the ring reads at
 * 40px. Kept vector so it stays crisp and follows the selected accent color.
 *
 * The SAME geometry drives the Android adaptive icon
 * (`android/app/src/main/res/drawable/ic_launcher_foreground.xml`) and the
 * rendered store PNGs — change the paths here and re-render those to match.
 * Those two are intentionally FIXED green: a launcher/store icon must not
 * change when the user picks a different in-app accent.
 */
export function AppLogo({ size = 30, color = "#059669", glyphColor }: Props) {
  const glyph = glyphColor ?? shade(color, 0.72);
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        d="M24 6.5 A 17.5 17.5 0 1 1 11.6 11.6"
        stroke={color}
        strokeWidth={5.4}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={18} cy={19.4} r={2.4} fill={glyph} />
      <Path d="M14.5 30.4 L20 24 L23.4 28 L26.6 24.8 L33 30.4 Z" fill={glyph} />
    </Svg>
  );
}
