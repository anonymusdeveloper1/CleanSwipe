import Svg, { Circle, G, Path, Rect } from "react-native-svg";

type Props = {
  size?: number;
  /** Main mark color. Defaults to the app accent where used. */
  color?: string;
  /** Color of the photo glyph inside the front card (the "paper"). */
  glyphColor?: string;
};

/**
 * SwipeClean brand mark: a stack of photo cards being swiped (a tilted back
 * card, a filled front card with a photo glyph, and three swipe-motion arcs).
 * Vector so it stays crisp at any size and follows the selected accent color.
 */
export function AppLogo({ size = 30, color = "#2F6BFF", glyphColor = "#ffffff" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* swipe-motion arcs on the left */}
      <G stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none">
        <Path d="M12 18 A 8 8 0 0 0 12 30" opacity={0.5} />
        <Path d="M8.5 15 A 11.5 11.5 0 0 0 8.5 33" opacity={0.3} />
        <Path d="M5 12.5 A 15 15 0 0 0 5 35.5" opacity={0.16} />
      </G>

      {/* back card (faded, tilted left) */}
      <G rotation={-15} originX={26} originY={24}>
        <Rect x={17} y={9} width={20} height={27} rx={4.5} fill={color} opacity={0.24} />
      </G>

      {/* front card (filled, slight right tilt) with photo glyph */}
      <G rotation={7} originX={28} originY={26}>
        <Rect x={19} y={12} width={21} height={28} rx={4.5} fill={color} />
        <Circle cx={26} cy={21} r={2.8} fill={glyphColor} />
        <Path d="M21 35 L27.5 26 L31.5 30.5 L34 27 L38 35 Z" fill={glyphColor} />
      </G>
    </Svg>
  );
}
