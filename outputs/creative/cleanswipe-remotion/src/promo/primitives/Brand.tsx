import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, SPRING_HEAVY, EASE_OUT } from "../theme";

/**
 * The SwipeClean ring mark, transcribed from assets/logo-mark.svg in the app
 * repo (the "space-freed ring" adopted in the 2026-08-21 green rebrand).
 * Redrawn as a component so it can be recoloured and animated — the ring can
 * sweep open, which is the one piece of logo motion the mark actually invites.
 */
export const RingMark: React.FC<{
  size: number;
  color?: string;
  innerColor?: string;
  /** 0..1 — how much of the ring arc is drawn. 1 = the full logo. */
  sweep?: number;
  /** 0..1 — the photo glyph inside scales in after the ring completes. */
  glyph?: number;
}> = ({ size, color = C.greenDeep, innerColor = C.greenDark, sweep = 1, glyph = 1 }) => {
  // Arc length of the mark's open circle. The path is a 17.5r arc that stops
  // short of closing, so ~96 units covers it with room to spare.
  const LEN = 100;
  return (
    <svg width={size} height={size} viewBox="-6 -6 60 60" style={{ overflow: "visible" }}>
      <path
        d="M24 6.5 A 17.5 17.5 0 1 1 11.6 11.6"
        stroke={color}
        strokeWidth={5.4}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={LEN}
        strokeDashoffset={LEN * (1 - sweep)}
      />
      <g
        transform={`translate(24 25) scale(${glyph}) translate(-24 -25)`}
        opacity={glyph}
      >
        <circle cx="18" cy="19.4" r="2.4" fill={innerColor} />
        <path d="M14.5 30.4 L20 24 L23.4 28 L26.6 24.8 L33 30.4 Z" fill={innerColor} />
      </g>
    </svg>
  );
};

/**
 * The endcard lockup. The LemFi reference lands its logo as a hard slam with
 * a heavy extruded black shadow offset down-right — the shadow is what gives
 * an otherwise flat wordmark its weight, so it is reproduced here rather than
 * substituted for a soft drop shadow.
 */
export const LogoSlam: React.FC<{
  startFrame: number;
  fontSize: number;
  markSize: number;
  color?: string;
  shadowColor?: string;
  extrude?: number;
}> = ({
  startFrame,
  fontSize,
  markSize,
  color = C.white,
  shadowColor = "#00170f",
  extrude = 16,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - startFrame;

  const s = spring({ frame: t, fps, config: SPRING_HEAVY, durationInFrames: 26 });
  // The shadow trails the mark in: it starts long and retracts as the lockup
  // settles, which reads as the logo dropping onto the surface.
  const shadowLen = interpolate(s, [0, 1], [extrude * 5.5, extrude], {
    extrapolateRight: "clamp",
  });
  const layers = 14;

  const ringSweep = interpolate(t, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  const glyph = spring({
    frame: t - 12,
    fps,
    config: SPRING_HEAVY,
    durationInFrames: 18,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: markSize * 0.32,
        transform: `scale(${0.82 + s * 0.18})`,
        opacity: Math.min(1, t / 4),
      }}
    >
      <div style={{ filter: `drop-shadow(${shadowLen * 0.5}px ${shadowLen * 0.5}px 0 ${shadowColor})` }}>
        <RingMark size={markSize} color={color} innerColor={color} sweep={ringSweep} glyph={glyph} />
      </div>
      <div style={{ position: "relative" }}>
        {/* Extrusion: stacked offset copies behind the face. A CSS text-shadow
            stack is used instead of one blurred shadow so the edge stays hard,
            which is what makes it read as extruded rather than soft-lit. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            fontFamily: FONT.display,
            fontSize,
            color: shadowColor,
            letterSpacing: "-0.035em",
            whiteSpace: "nowrap",
            textShadow: new Array(layers)
              .fill(0)
              .map((_, i) => {
                const d = ((i + 1) / layers) * shadowLen;
                return `${d}px ${d}px 0 ${shadowColor}`;
              })
              .join(", "),
          }}
        >
          SwipeClean
        </div>
        <div
          style={{
            position: "relative",
            fontFamily: FONT.display,
            fontSize,
            color,
            letterSpacing: "-0.035em",
            whiteSpace: "nowrap",
          }}
        >
          SwipeClean
        </div>
      </div>
    </div>
  );
};

/**
 * Animated number. Counters appear in three of the four references and are
 * the cheapest way to make a static stat feel like a live measurement.
 */
export const Counter: React.FC<{
  from: number;
  to: number;
  startFrame: number;
  durationInFrames?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Thousands separators — matches the app's own "3,758" formatting. */
  group?: boolean;
  style?: React.CSSProperties;
}> = ({
  from,
  to,
  startFrame,
  durationInFrames = 30,
  decimals = 0,
  prefix = "",
  suffix = "",
  group = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, Math.min(1, (frame - startFrame) / durationInFrames));
  const v = from + (to - from) * EASE_OUT(t);
  const fixed = v.toFixed(decimals);
  const shown = group
    ? Number(fixed).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : fixed;

  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
};
