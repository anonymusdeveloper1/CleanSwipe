import React from "react";
import { useCurrentFrame } from "remotion";
import { rand } from "../../theme";
import { WipeVariantProps } from "./contract";

/**
 * VARIANT 2 — PAINT DRIPS FROM THE TOP EDGE.
 *
 * The first transition in the client's matte pack: a body of paint hangs off
 * the TOP of frame and sends tapering runs down it, some long and thin, some
 * stubby, with detached droplets falling ahead of them. The mass pours down
 * until it covers, then keeps pouring — it leaves by continuing DOWN and off
 * the bottom, never by un-filling itself.
 *
 * WHY THERE IS NEVER A STRAIGHT EDGE.
 * The rejected build drew a solid <rect> and swept its edge, so the front was a
 * flat horizontal line with a few blobs stuck on it. Here the body has no
 * horizontal edge at all. Its whole travelling boundary is one Catmull-Rom
 * contour through control points whose offset SIGN ALTERNATES BY INDEX, so two
 * neighbours can never share a y and a flat run is arithmetically impossible —
 * and every one of those points then carries a paint run hanging off it. The
 * cutouts are the animation. The only straight lines in the geometry are the
 * two vertical sides and the closing edge, all three parked a full frame-height
 * off-screen.
 *
 * WHY THE RUNS LOOK LIKE PAINT AND NOT LIKE FINGERS.
 * A first pass tapered each run only ~40% from root to tip, and it read as a
 * castle battlement: parallel-sided columns with wide flat gaps between them.
 * A real run has three parts — a wide root where it pulls away from the body, a
 * NECK squeezed to about a third of that, and a heavy BULB at the tip where the
 * pigment collects. That silhouette is what the eye recognises as dripping, and
 * it is what the profile below draws. Which points get long runs is random per
 * point rather than every-other, so the runs cluster the way real ones do.
 *
 * BOTH PHASES TRAVEL THE SAME WAY.
 * Entry: the contour is the sheet's UNDERSIDE, runs hang below it, droplets
 * lead. Exit: the contour is the same sheet's TOP, the runs now trail upward
 * and the detached droplets LAG above it and are swallowed as it drops away.
 * Every element's y increases monotonically the whole way through, so the
 * transition is one continuous downward pour, not a fill and an unfill.
 *
 * THE GOO FILTER IS LOAD-BEARING. Blur, then slam the alpha back to a hard
 * edge: haloes fuse before outlines touch, so runs neck into the body with a
 * proper fillet and droplets are absorbed instead of popping out of existence.
 * Every neck and bulb below is kept above ~1.3x and ~1.15x the blur sigma
 * respectively — thinner than that and the alpha threshold erases the shape.
 */

/** Horizontal overscan, in width units, so the contour ends are off-screen. */
const OVER = 0.25;
/** Contour control points minus one. 135px apart at 1080 wide. */
const SEGMENTS = 12;
/** Detached droplets, leading the front on entry and lagging it on exit. */
const DROPS = 9;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const f = (v: number) => v.toFixed(1);

type Pt = { x: number; y: number };

/**
 * Catmull-Rom through every point, emitted as cubic beziers. Passing THROUGH
 * the points rather than near them is what keeps the lobes crisp — a plain
 * bezier chain averages the undulation away and the front starts reading flat.
 */
const curveThrough = (pts: Pt[]): string => {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p0 = i > 0 ? pts[i - 1] : p1;
    const p3 = i + 2 < pts.length ? pts[i + 2] : p2;
    d +=
      ` C ${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)}` +
      ` ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)}` +
      ` ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
};

/**
 * One run of paint: wide root -> squeezed neck -> heavy round bulb. Capped at
 * the root by an arc that bulges back INTO the body, so no segment of the
 * outline is horizontal even where the run stands proud of the contour.
 * `dir` is +1 to hang down, -1 to trail up.
 */
const paintRun = (
  cx: number,
  rootY: number,
  len: number,
  w0: number,
  neck: number,
  bulb: number,
  dir: number,
): string => {
  const wm = w0 * neck;
  const rb = w0 * bulb;
  const bc = len - rb;
  const y = (d: number) => f(rootY + dir * d);
  return (
    `M ${f(cx - w0)} ${y(0)}` +
    ` C ${f(cx - w0 * 1.04)} ${y(len * 0.2)} ${f(cx - w0 * 0.44 - wm * 0.56)} ${y(len * 0.4)} ${f(cx - wm)} ${y(len * 0.66)}` +
    ` C ${f(cx - wm)} ${y(len * 0.81)} ${f(cx - rb)} ${y(bc - rb * 0.6)} ${f(cx - rb)} ${y(bc)}` +
    ` C ${f(cx - rb)} ${y(bc + rb * 1.34)} ${f(cx + rb)} ${y(bc + rb * 1.34)} ${f(cx + rb)} ${y(bc)}` +
    ` C ${f(cx + rb)} ${y(bc - rb * 0.6)} ${f(cx + wm)} ${y(len * 0.81)} ${f(cx + wm)} ${y(len * 0.66)}` +
    ` C ${f(cx + w0 * 0.44 + wm * 0.56)} ${y(len * 0.4)} ${f(cx + w0 * 1.04)} ${y(len * 0.2)} ${f(cx + w0)} ${y(0)}` +
    ` C ${f(cx + w0 * 0.6)} ${y(-w0 * 0.8)} ${f(cx - w0 * 0.6)} ${y(-w0 * 0.8)} ${f(cx - w0)} ${y(0)}` +
    " Z"
  );
};

export const WipeVariant2: React.FC<WipeVariantProps> = ({
  durationInFrames,
  color,
  width,
  height,
  seed = 2,
}) => {
  const frame = useCurrentFrame();
  const p = durationInFrames > 0 ? frame / durationInFrames : 1;
  if (p >= 1 || p < 0) return null;

  // Cover is reached at 46% and held to 54%, so the section cut on the exact
  // midpoint sits inside a block of fully covered frames rather than on a
  // single knife-edge one.
  const falling = p < 0.5;
  const e = clamp01(p / 0.46);
  const xo = clamp01((p - 0.54) / 0.46);
  const dir = falling ? 1 : -1;

  // The travelling contour. Entry: the sheet's underside, accelerating like a
  // pour. Exit: the same sheet's top edge, sliding on off the bottom.
  const amp = height * 0.032;
  const baseY = falling
    ? -0.14 * height + Math.pow(e, 1.2) * 1.4 * height
    : -0.14 * height + xo * 1.3 * height;

  const x0 = -OVER * width;
  const span = (1 + 2 * OVER) * width;
  const step = span / SEGMENTS;
  const cls = falling ? 0 : 31.4;

  const pts: Pt[] = [];
  const long: boolean[] = [];
  for (let k = 0; k <= SEGMENTS; k++) {
    const edge = k === 0 || k === SEGMENTS;
    const jx = edge ? 0 : (rand(seed * 4.7 + k * 3.13) - 0.5) * step * 0.56;
    const mag = 0.35 + 1.0 * rand(seed * 9.1 + k * 6.7);
    // Sign alternates with the index: the contour is forced to undulate.
    // Whether a point grows a LONG run is independent of that, so the runs
    // cluster irregularly instead of marching every-other-one.
    pts.push({
      x: x0 + step * k + jx,
      y: baseY + (k % 2 === 0 ? 1 : -1) * dir * mag * amp,
    });
    long.push(rand(seed * 13.7 + k * 4.9 + cls) > 0.5);
  }

  // The body: contour on the leading side, closed off a full frame height away
  // on the trailing side where nothing can ever see the straight part.
  const far = falling ? -3 * height : 4 * height;
  const body =
    `M ${f(pts[0].x)} ${f(far)} L ${f(pts[0].x)} ${f(pts[0].y)}` +
    curveThrough(pts) +
    ` L ${f(pts[SEGMENTS].x)} ${f(far)} Z`;

  // Run growth. Entry: they stretch as they fall. Exit: they stretch, then are
  // reeled in over the last frames once the mass is already off the bottom.
  const reach = falling ? 1 : 0.62;
  const grow = falling
    ? 0.5 + 0.5 * Math.min(1, e / 0.65)
    : (0.55 + 0.45 * Math.min(1, xo / 0.4)) * (1 - smoothstep(0.82, 1, xo));

  const runs = pts.map((pt, k) => {
    const big = long[k];
    const rW = rand(seed * 2.9 + k * 11.3 + cls);
    const rL = rand(seed * 6.1 + k * 8.9 + cls);
    const w0 = width * (big ? 0.032 + 0.018 * rW : 0.024 + 0.01 * rW);
    // Trailing streaks on the way out are shorter and fatter than the runs on
    // the way in: thin spikes read as something growing upward, chunky lobes
    // read as a heavy surface being dragged down past the frame.
    const neck = big ? (falling ? 0.34 : 0.44) : (falling ? 0.55 : 0.62);
    const bulb = big ? (falling ? 0.54 : 0.6) : 0.72;
    const full = height * (big ? 0.11 + 0.32 * rL : 0.05 + 0.08 * rL) * reach;
    const len = Math.max(w0 * bulb * 3.2, full * grow);
    return paintRun(pt.x, pt.y, len, w0, neck, bulb, dir);
  });

  const blur = width * 0.015;
  const gid = `dripgoo-${seed}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <filter
          id={gid}
          filterUnits="userSpaceOnUse"
          x={-0.35 * width}
          y={-0.6 * height}
          width={1.7 * width}
          height={2.4 * height}
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="b" />
          {/* Alpha ramp: the blurred falloff snaps back to a hard edge, and
              neighbouring haloes fuse into one surface before they touch. */}
          <feColorMatrix
            in="b"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
          />
        </filter>
      </defs>

      <g filter={`url(#${gid})`} fill={color}>
        <path d={body} />
        {runs.map((d, k) => (
          <path key={k} d={d} />
        ))}
        {new Array(DROPS).fill(0).map((_, j) => {
          const rx = rand(seed * 3.3 + j * 9.7 + cls);
          const rr = rand(seed * 7.9 + j * 5.1 + cls);
          const rl = rand(seed * 5.3 + j * 13.1 + cls);
          const rad = width * (0.024 + 0.026 * rr);
          const cx = width * (0.04 + 0.92 * rx);
          // Entry: droplets run AHEAD of the front, the gap opening as the pour
          // accelerates. Exit: they LAG behind it and are swallowed as the
          // sheet's top edge catches up — so they leave by merging into the
          // body, never by fading out or shrinking away.
          const u = clamp01((xo - 0.04 - 0.36 * rl) / 0.42);
          const cy = falling
            ? baseY + height * (0.1 + 0.32 * rl) * (0.25 + 1.05 * e)
            : baseY - height * (0.12 + 0.26 * rr) * (1 - u) + rad * 1.4 * u;
          return (
            <ellipse
              key={`d${j}`}
              cx={f(cx)}
              cy={f(cy)}
              rx={f(rad)}
              ry={f(rad * 1.24)}
            />
          );
        })}
      </g>
    </svg>
  );
};
