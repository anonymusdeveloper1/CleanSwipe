import React from "react";
import { useCurrentFrame } from "remotion";
import { rand } from "../../theme";
import { WipeVariantProps } from "./contract";

/**
 * VARIANT 3 - INK BLOT.
 *
 * The frame is taken by ink, not by an edge. A lattice of blots is seeded
 * across (and past) the frame; each blooms from nothing at its own moment,
 * each has its own lopsided outline, and the gooey filter welds them into one
 * body as their haloes touch. The last ground to go is a scatter of irregular
 * interstitial pockets that close from every side at once - the opposite of a
 * receding line.
 *
 * WHY THERE IS NO <rect> ANYWHERE IN HERE.
 * The rejected build drew a full-width slab and decorated its top edge, so the
 * eye read "a horizontal line with blobs stuck on it". Every pixel of colour
 * here comes from a blot path whose radius is modulated per-angle, so the
 * silhouette cannot contain a flat run - the cutouts ARE the transition.
 *
 * WHY THE BLOTS ARE THIS SMALL, AND WHY THE BOTTOM ROWS ARE SMALLER STILL.
 * Two things kill this effect, and both are radius. Blots much bigger than the
 * lattice needs cover their own cell at a third of their growth, so the frame
 * goes solid five frames before the bloom finishes and the middle of the
 * transition dies. And the sheet hangs below the frame by roughly one radius,
 * which is travel spent before the trailing edge is even visible - so the
 * bottom rows tighten and shrink (ROW_Y / ROW_SCALE) until the hem sits right
 * on the frame edge. Between them those two moves bought six live frames.
 *
 * IT LEAVES BY TRAVELLING, NOT BY UN-FILLING.
 * Past the midpoint the body slides up and off the top; nothing shrinks, the
 * blots are still creeping outward as they go. Each takes a different share of
 * the travel - upper rows more than lower, each column different again, each
 * blot different again, and each blot sits still for its own `hold` first - so
 * the sheet tears instead of sliding as one silhouette. The stragglers hang
 * below the rest as fingers, the drips are uncovered as floating islands, and
 * everything then chases the body off the top. The travel distance is solved
 * from the field, so whatever the seed the last ink leaves at v = CLEAR_AT.
 */

/** Columns sit on the frame edges so the sides never gap. Eight of them, not
 *  six: the hem rows are scaled down to keep the sheet off the bottom of the
 *  frame, and a shrunken blot only still covers its cell if the cell is
 *  narrower to begin with. */
const COLS = 8;
/**
 * Row centres in multiples of height. Even through the body, then tightening
 * into a hem so the lowest ink sits on the frame edge instead of a radius
 * below it.
 */
const ROW_Y = [
  -0.035, 0.06, 0.155, 0.25, 0.345, 0.44, 0.535, 0.63, 0.725, 0.82, 0.895,
  0.955, 1.0,
];
/** Radius scale per row - the hem is small so its overhang is small. */
const ROW_SCALE = [0.88, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.86, 0.76, 0.64];
/** Lattice jitter, in multiples of width. Budgeted against the radius below. */
const JIT = 0.02;
/** Base blot radius in multiples of width, then 0.90-1.16 of that. Sized only
 *  ~25px above what the lattice needs to cover, for the reason above. */
const R_BASE = 0.245;
/** Entry progress at which the frame is guaranteed solid. */
const COVER_AT = 0.93;
/** Spread of bloom start times across the lattice, bottom-first. */
const DELAY_MAX = 0.72;
/** Exit progress at which the last ink is out of frame. */
const CLEAR_AT = 0.93;
/** Samples around a blot outline. */
const RIM = 36;

const SPATTERS = 18;
const DRIPS = 18;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Ink spreads fast then creeps: area ~ linear in time, so radius decelerates. */
const spread = (x: number) => 1 - Math.pow(1 - x, 2.4);

type Blot = {
  cx: number;
  cy: number;
  r: number;
  /** Per-angle radius harmonics - this is what stops it being a circle. */
  a1: number;
  a2: number;
  a3: number;
  p1: number;
  p2: number;
  p3: number;
  /** Lobe rotation rate, so the outline crawls instead of sitting still. */
  spin: number;
  /** Entry: when it starts, and over how much of the entry it opens up. */
  delay: number;
  grow: number;
  /** Entry: how far below its home it starts, so the bloom also rises. */
  rise: number;
  /** Exit: this blot's share of the travel. Spread out, the sheet stretches. */
  lag: number;
  /** Exit: how long it sits still first. This is what tears the sheet open. */
  hold: number;
};

/**
 * Deterministic outline. Sampled radii are threaded with midpoint quadratics,
 * which keeps the curve smooth without hand-placed control points - a raw
 * polygon facets visibly at these radii.
 */
const outline = (
  b: Blot,
  cx: number,
  cy: number,
  r: number,
  amp: number,
  phase: number,
): string => {
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < RIM; i++) {
    const a = (i / RIM) * Math.PI * 2;
    const m =
      1 +
      amp *
        (b.a1 * Math.sin(2 * a + b.p1 + phase * b.spin) +
          b.a2 * Math.sin(3 * a + b.p2 - phase * b.spin * 0.6) +
          b.a3 * Math.sin(5 * a + b.p3 + phase * b.spin * 1.4));
    const rr = r * m;
    px.push(cx + Math.cos(a) * rr);
    py.push(cy + Math.sin(a) * rr);
  }
  const mid = (i: number, j: number) =>
    `${((px[i] + px[j]) / 2).toFixed(1)} ${((py[i] + py[j]) / 2).toFixed(1)}`;
  let d = `M ${mid(RIM - 1, 0)}`;
  for (let i = 0; i < RIM; i++) {
    const n = (i + 1) % RIM;
    d += ` Q ${px[i].toFixed(1)} ${py[i].toFixed(1)} ${mid(i, n)}`;
  }
  return `${d} Z`;
};

/** Irregularity signature. Amplitudes sum below 0.225, so even the worst angle
 *  of the smallest blot still clears the lattice's covering radius - a blot can
 *  be as lopsided as it likes without ever opening a hole at the midpoint. */
const shapeOf = (s: number) => ({
  a1: 0.06 + rand(s + 11) * 0.05,
  a2: 0.035 + rand(s + 29) * 0.035,
  a3: 0.02 + rand(s + 47) * 0.025,
  p1: rand(s + 63) * Math.PI * 2,
  p2: rand(s + 81) * Math.PI * 2,
  p3: rand(s + 97) * Math.PI * 2,
  spin: (rand(s + 113) < 0.5 ? -1 : 1) * (0.6 + rand(s + 131)),
});

/** Bloom order: bottom first, so the take reads upward. */
const startAt = (norm: number) => DELAY_MAX * (1 - norm);
/** Exit share: upper ink is pulled off first, so the sheet stretches. */
const shareOf = (norm: number) => 1.05 - 0.2 * norm;
/** Exit ramp for one blot: nothing until its hold is up, then it goes. */
const goneBy = (v: number, hold: number) => clamp01((v - hold) / (1 - hold));

const buildField = (seed: number, width: number, height: number) => {
  const blots: Blot[] = [];
  const jit = width * JIT;
  const rows = ROW_Y.length;

  // Whole-column travel offsets. A column riding 150px behind its neighbour is
  // what breaks the hem into steps rather than one arc; at v = 0 it
  // contributes nothing, so midpoint cover is untouched.
  const colLag: number[] = [];
  for (let i = 0; i < COLS; i++) {
    colLag.push((rand(seed * 100 + 300 + i * 31) * 2 - 1) * 0.07);
  }

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < COLS; i++) {
      const s = seed * 100 + j * 13 + i * 7;
      const cx = (i / (COLS - 1)) * width + (rand(s + 1) * 2 - 1) * jit;
      const cy = ROW_Y[j] * height + (rand(s + 2) * 2 - 1) * jit;
      const norm = clamp01(j / (rows - 1));
      // The x phase stops a row from ever landing as one horizontal event.
      const delay = Math.min(
        COVER_AT - 0.16,
        clamp01(
          startAt(norm) +
            (rand(s + 3) * 2 - 1) * 0.1 +
            Math.sin(cx * 0.0042 + seed) * 0.04,
        ),
      );
      blots.push({
        cx,
        cy,
        r: width * R_BASE * (0.9 + rand(s + 4) * 0.26) * ROW_SCALE[j],
        delay,
        grow: COVER_AT - delay,
        rise: height * 0.045 * (0.4 + rand(s + 5)),
        lag: Math.max(
          0.82,
          shareOf(norm) + colLag[i] + (rand(s + 6) * 2 - 1) * 0.06,
        ),
        // Most of the sheet leaves together; a minority digs its heels in and
        // is left hanging below the rest as a finger or a clump, which is what
        // stops the trailing edge being one continuous silhouette. Biased
        // AWAY from the hem: a straggler pins its patch of the trailing edge,
        // and if the hem itself digs in then nothing uncovers at all and the
        // middle of the transition dies again. Zero at v = 0 either way, so
        // cover is intact at the midpoint however wild this gets.
        hold: Math.pow(rand(s + 8), 1.7) * (0.34 - 0.1 * norm),
        ...shapeOf(s),
      });
    }
  }

  // Spatter: small ink landing slightly ahead of the body at its own spot, so
  // specks appear in clear ground and are then swallowed by the front.
  for (let i = 0; i < SPATTERS; i++) {
    const s = seed * 100 + 500 + i * 17;
    const cx = width * (-0.05 + rand(s + 1) * 1.1);
    const cy = height * (-0.02 + rand(s + 2) * 1.04);
    const norm = clamp01(cy / height);
    blots.push({
      cx,
      cy,
      r: width * (0.03 + rand(s + 4) * 0.05),
      delay: clamp01(startAt(norm) - 0.16 + rand(s + 3) * 0.06),
      grow: 0.14,
      lag: shareOf(norm),
      hold: Math.pow(rand(s + 8), 1.7) * 0.3,
      rise: height * 0.02,
      ...shapeOf(s),
    });
  }

  // Drips: loose ink given far less of the travel than the body. On the way
  // out the sheet leaves them behind, so they are uncovered one by one as
  // floating islands and then chase it off the top. This is what stops the
  // trailing edge from reading as a single moving outline.
  for (let i = 0; i < DRIPS; i++) {
    const s = seed * 100 + 900 + i * 23;
    const cy = height * (0.55 + rand(s + 2) * 0.5);
    blots.push({
      cx: width * (-0.05 + rand(s + 1) * 1.1),
      cy,
      r: width * (0.05 + rand(s + 3) * 0.075),
      delay: clamp01(startAt(clamp01(cy / height)) + rand(s + 4) * 0.12),
      grow: 0.3,
      rise: height * 0.03,
      lag: 0.86 + rand(s + 5) * 0.16,
      hold: 0.26 + rand(s + 5) * 0.29,
      ...shapeOf(s),
    });
  }

  // Solve the travel from the field rather than guessing it: whichever blot has
  // the furthest to go on the smallest share sets the distance, so every seed
  // clears the frame at the same moment.
  let travel = 0;
  for (const b of blots) {
    // Floor guards the divide: a hold at or past CLEAR_AT would demand
    // infinite travel, so no hold above is allowed anywhere near it.
    const done = Math.max(0.05, b.lag * goneBy(CLEAR_AT, b.hold));
    travel = Math.max(travel, (b.cy + b.r * 1.3) / done);
  }

  return { blots, travel };
};

export const WipeVariant3: React.FC<WipeVariantProps> = ({
  durationInFrames,
  color,
  width,
  height,
  seed = 1,
}) => {
  const frame = useCurrentFrame();
  const t = clamp01(frame / durationInFrames);
  const u = Math.min(1, t * 2);
  const v = Math.max(0, (t - 0.5) * 2);

  const { blots, travel } = React.useMemo(
    () => buildField(seed, width, height),
    [seed, width, height],
  );

  const phase = t * Math.PI * 1.2;

  const id = `ink-${seed}`;
  const blur = width * 0.016;

  const paths: string[] = [];
  for (let i = 0; i < blots.length; i++) {
    const b = blots[i];
    const local = clamp01((u - b.delay) / b.grow);
    if (local <= 0) continue;
    // Still creeping outward on the way out, so no part of this ever reverses.
    const r = b.r * spread(local) * (1 + 0.05 * v);
    if (r < 2) continue;
    // Constant speed once a blot is released. Anything eased spends its first
    // frames barely moving, and those sit right on top of the cut.
    const cy = b.cy + b.rise * (1 - local) - travel * b.lag * goneBy(v, b.hold);
    // Young ink is far more ragged than settled ink; the amplitude relaxes as
    // the blot fills out, which is why the field never looks like tidy discs.
    const amp = 1 + 0.9 * (1 - local);
    const reach = r * 1.4;
    if (cy + reach < -40 || cy - reach > height + 40) continue;
    paths.push(outline(b, b.cx, cy, r, amp, phase));
  }

  if (paths.length === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        {/* Blur, then slam the alpha back to a hard edge. Neighbouring blots
            fuse before their outlines actually touch, which is what makes the
            merge read as liquid rather than as overlapping bubbles. */}
        <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
          />
        </filter>
      </defs>
      <g filter={`url(#${id})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill={color} />
        ))}
      </g>
    </svg>
  );
};
