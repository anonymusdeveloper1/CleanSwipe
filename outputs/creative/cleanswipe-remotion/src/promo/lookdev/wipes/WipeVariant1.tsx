import React from "react";
import { useCurrentFrame } from "remotion";
import { rand } from "../../theme";
import { WipeVariantProps } from "./contract";

/**
 * VARIANT 1 - RISING BLOB FIELD.
 *
 * WHY THERE IS NO RECTANGLE ANYWHERE IN HERE.
 * The rejected build swept the top edge of a full-width <rect> upward and put a
 * few blobs in front of it. A rect edge is a dead-straight horizontal line, so
 * it read exactly as the client described: "just a line, and on top of that
 * kind of animation". Every pixel of this version is a circle. The mass is a
 * field of overlapping columns of circles; the gooey filter fuses them, so the
 * union has a lumpy, fingered contour at every single frame. Cover is reached
 * because the circles become numerous and large enough to overlap completely -
 * never because a solid shape filled in behind them.
 *
 * HOW COVERAGE IS GUARANTEED WITHOUT A RECT.
 * See the proof at `headY` below. In short: each column is a chain of circles
 * that is provably a continuous vertical stripe wider than the gap to its
 * neighbour, and every per-column offset is signed so it can only push a head
 * UP and a tail DOWN. So the whole frame is covered whenever headY <= R_MIN and
 * tailY >= H - R_MIN, which at 28 frames holds from frame 12.6 to frame 15.2 -
 * over a frame either side of the midpoint the section cut sits on. Measured on
 * the render, frames 12 through 16 come back 100% covered.
 *
 * IT CLEARS BY TRAVELLING, NOT BY UN-FILLING.
 * headY sprints up first while tailY sits parked below the frame - so the mass
 * STRETCHES as it rises, growing from two rows of circles to twenty. Past the
 * midpoint the head is long gone off the top and it is the TAIL that crosses
 * the screen, trailing drip strands off the bottom of the mass. Nothing ever
 * moves down the screen and nothing shrinks back the way it came.
 *
 * PACING. The client said the old one was over before you could see it. Travel
 * is near-constant-speed (see `glide`) and the budget goes to the two moments
 * that actually read. Measured coverage per frame over 28 is 0, 4, 13, 25, 38,
 * 46, 52, 59, 68, 77, 86, 97, then 100 for five frames, then 96, 87, 77, 67,
 * 56, 46, 35, 25, 12, 0 - a steady sweep with no idle stretch at either end,
 * and both the first and the last frame completely empty.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);

/**
 * Mostly linear, with just the corners taken off. A real ease-out front-loads
 * the motion and is what made the first attempt feel instant.
 */
const glide = (v: number) => 0.72 * v + 0.28 * smooth(v);

/** Columns across the frame. 14 gives a ~96px pitch at 1080 wide. */
const COLS = 14;

type Blob = { x: number; y: number; r: number };

export const WipeVariant1: React.FC<WipeVariantProps> = ({
  durationInFrames,
  color,
  width: W,
  height: H,
  seed = 1,
}) => {
  const frame = useCurrentFrame();
  const t = clamp01(frame / durationInFrames);

  // --- travel ------------------------------------------------------------
  // THE COVER PROOF, since everything below is tuned around it. Each column is
  // a chain of circles of radius >= R_MIN with centres <= DY apart, one landing
  // exactly on colHead and one exactly on colTail, so it covers a connected
  // stripe over y in [colHead - R_MIN, colTail + R_MIN] whose half-width is at
  // least sqrt(R_MIN^2 - (DY/2)^2). At 1080 wide that is R_MIN = 102.8,
  // DY = 135, so the stripe is 155 wide against a worst-case column gap of
  // 123.4 - the stripes always overlap and the field is solid left to right.
  // Every per-column offset is signed so colHead <= headY and colTail >= tailY.
  // So the frame is fully covered whenever headY <= R_MIN and tailY >= H -
  // R_MIN, which holds from t = 0.449 to t = 0.543 - frames 12.6 to 15.2 of 28,
  // a clear frame either side of the midpoint the section cut sits on. At the
  // midpoint itself headY is 124px past the top and tailY 182px past the
  // bottom, counting the radius the proof is allowed to claim.
  //
  // Head: enters around frame 2 and crosses at a near constant ~180px/frame.
  // The start sits just under tailY, not above it: when the head started lower
  // than the parked tail the band was briefly inverted at frame 0 and the fat
  // trailing knob poked back up into the bottom of the frame.
  const headY = H * 1.09 - H * 1.3854 * glide(clamp01(t / 0.62));
  // Tail: starts moving at t = 0.47 but from 170px BELOW the frame, so the slow
  // first part of the glide is spent out of sight and the trailing edge is
  // already at full speed when it appears at frame ~15.5.
  const tailY = H * 1.099 - H * 1.3333 * glide(clamp01((t - 0.47) / 0.53));

  // Fingers grow in rather than existing at frame 0, so nothing pops on.
  const leadRamp = smooth(clamp01(t / 0.12));
  // Drips are fully formed BEFORE the trailing edge becomes visible. Growing
  // them on screen pushed the contour down almost as fast as the mass carried
  // it up, and the exit stalled at the moment it should have been reading.
  const exitRamp = smooth(clamp01((t - 0.36) / 0.14));
  // The drips are pulled thin only over the last ~4 frames, once the mass is
  // leaving the top of the frame. Tapering earlier flattened the whole trailing
  // contour into a gentle wave while it was still on screen - the one thing
  // this must never do.
  const taper = 1 - 0.9 * smooth(clamp01((t - 0.84) / 0.16));

  const DX = (W * 1.16) / (COLS - 1);
  const X0 = -W * 0.08;
  const RB = W * 0.115;
  const DY = W * 0.125;
  const MARG = RB * 2.4;

  const blobs: Blob[] = [];
  const put = (x: number, y: number, r: number) => {
    // Off-screen circles are dropped: they cannot affect the visible result
    // beyond the blur radius, and it keeps the circle count sane.
    if (r > 1 && y > -MARG && y < H + MARG) blobs.push({ x, y, r });
  };

  // Which way the whole mass leans. A lean means the contour is diagonal as
  // well as lumpy - a second guarantee against anything reading as level.
  const flip = rand(seed * 5.53 + 2.1) > 0.5;

  // Relief in the contours has to be LOW FREQUENCY. A single column left
  // behind by its neighbours does not read as a valley: the neighbouring
  // stripes bulge across it and the goo blur bridges the rest, so the notch
  // fills in and the front reads as level again. These two slow waves - just
  // under one cycle and about one and a half cycles across the frame - move
  // several columns together, which is what produces bays deep enough to see.
  const headPhase = t * 3.4 + seed * 1.7;
  const tailPhase = t * 2.9 - seed * 2.3;

  // How far each column runs ahead of / behind the pack. The scallop between
  // two touching circles is only ~10px deep, so ALL of the relief in both
  // contours comes from these numbers: the lobes carve the bays, the per-column
  // random roughens them, and the lean tilts the whole front.
  const headWave: number[] = [];
  const tailWave: number[] = [];
  for (let i = 0; i < COLS; i++) {
    const norm = i / (COLS - 1);
    headWave.push(
      0.31 * Math.sin(norm * 4.4 + headPhase) +
        0.19 * Math.sin(norm * 9.1 - headPhase * 0.7),
    );
    tailWave.push(
      0.31 * Math.sin(norm * 3.7 - tailPhase) +
        0.19 * Math.sin(norm * 8.3 + tailPhase * 0.8),
    );
  }
  // Each wave is RESCALED to a fixed depth before it is used. Two sines
  // sampled at 14 fixed columns land on wildly different peak-to-peak ranges
  // depending on where their phases happen to be - measured anywhere from 0.38
  // to 0.9 across one render - so a fixed coefficient gave a front that was
  // deeply fingered at one moment and nearly level a few frames later. Rescaling
  // fixes the relief and lets only the shape move. The divisor is floored so a
  // rare flat sample scales up gently instead of exploding.
  const spanOf = (a: number[]) =>
    Math.max(Math.max(...a) - Math.min(...a), 0.35);
  const headSpan = spanOf(headWave);
  const tailSpan = spanOf(tailWave);
  const headMin = Math.min(...headWave);
  const tailMin = Math.min(...tailWave);

  const leadRaw: number[] = [];
  const lagRaw: number[] = [];
  for (let i = 0; i < COLS; i++) {
    const s = i * 7.31 + seed * 13.77;
    const norm = i / (COLS - 1);
    const lean = flip ? 1 - norm : norm;
    leadRaw.push(
      (H * 0.3 * (headWave[i] - headMin)) / headSpan +
        H * 0.05 * rand(s + 3.1) +
        H * 0.045 * lean,
    );
    lagRaw.push(
      (H * 0.24 * (tailWave[i] - tailMin)) / tailSpan +
        H * 0.045 * rand(s + 5.7) +
        H * 0.035 * (1 - lean),
    );
  }
  // Both fields are re-zeroed on their own minimum. That is what keeps the
  // proof and the picture in step: every offset stays >= 0, so headY/tailY are
  // still hard bounds, but the deepest bay now sits exactly on the bound
  // instead of hundreds of pixels inside it. Without this the mass covered the
  // frame several frames before headY said it had to, and those frames were
  // dead flat colour.
  const leadFloor = Math.min(...leadRaw);
  const lagFloor = Math.min(...lagRaw);

  // The same lead field evaluated at an arbitrary x, so the scouting droplets
  // can be placed relative to the contour BENEATH them instead of relative to
  // headY. Anchored to headY they were being swallowed: the fingers reach up to
  // ~750px past headY, further than any droplet ever got, so almost none of
  // them were visible outside the mass.
  const leadAt = (u: number) => {
    const wave =
      0.31 * Math.sin(u * 4.4 + headPhase) +
      0.19 * Math.sin(u * 9.1 - headPhase * 0.7);
    return (
      (H * 0.3 * (wave - headMin)) / headSpan +
      H * 0.045 * (flip ? 1 - u : u) +
      H * 0.025 -
      leadFloor
    );
  };
  const lagAt = (u: number) => {
    const wave =
      0.31 * Math.sin(u * 3.7 - tailPhase) +
      0.19 * Math.sin(u * 8.3 + tailPhase * 0.8);
    return (
      ((H * 0.24 * (wave - tailMin)) / tailSpan +
        H * 0.035 * (flip ? u : 1 - u) +
        H * 0.0225 -
        lagFloor) *
      exitRamp *
      taper
    );
  };

  for (let i = 0; i < COLS; i++) {
    const s = i * 7.31 + seed * 13.77;

    const rBase = RB * (0.9 + 0.35 * rand(s));
    const cx = X0 + i * DX + (rand(s + 11.3) - 0.5) * DX * 0.28;

    const colHead = headY - (leadRaw[i] - leadFloor) * leadRamp;
    // Guard, not arithmetic: headY < tailY for the whole timeline as tuned, and
    // this keeps a re-tune from ever drawing a column upside down.
    const colTail = Math.max(
      tailY + (lagRaw[i] - lagFloor) * exitRamp * taper,
      colHead,
    );

    // Body of the column: one continuous stripe of circles head -> tail. The
    // last one lands EXACTLY on colTail rather than one step past it - the
    // overshoot was hanging an extra row plus a radius, ~290px, of full-width
    // colour below the trailing edge and made the exit read as sluggish.
    for (let k = 0; k < 44; k++) {
      const y = colHead + k * DY;
      if (y >= colTail) break;
      put(cx, y, rBase * (0.92 + 0.16 * rand(s + k * 2.13 + 60)));
    }
    put(cx, colTail, rBase * (0.92 + 0.16 * rand(s + 7.7)));

    // Tapering tip above the head - this is what turns a scalloped arc into a
    // finger of paint. Each circle is 0.72 of the last, so the goo necks it
    // into a spike rather than a stack of beads.
    const tips = 2 + Math.floor(rand(s + 21.7) * 2.99);
    for (let k = 1; k <= tips; k++) {
      put(
        cx + (rand(s + 30 + k * 3.7) - 0.5) * DX * 0.45,
        colHead - k * DY * 0.58 * leadRamp,
        rBase * Math.pow(0.72, k),
      );
    }

    // A fat off-centre bulge on some heads. The body radii are held in a narrow
    // band because the cover proof depends on the SMALLEST of them, so the
    // contour on its own came out as even rolling hills. Extra circles can only
    // ever add coverage, so the blobby character is bought here instead.
    if (rand(s + 17.3) > 0.35) {
      put(
        cx + (rand(s + 19.1) - 0.5) * DX * 0.9,
        colHead + rBase * 0.22,
        rBase *
          (1.15 + 0.3 * rand(s + 23.9)) *
          // Grown in with the fingers. At full size on frame 0 the knob alone
          // reached 25px over the bottom edge before anything should be visible.
          (0.62 + 0.38 * leadRamp),
      );
    }

    // The same on the trailing edge, which without it was a smooth ramp while
    // the leading edge was full of character. The knob has to hang BELOW the
    // body circle already sitting on colTail or it changes nothing: at
    // colTail - 0.24 rBase it protruded 12px past the body and the contour
    // stayed a ramp. Both the drop and the size fade with the taper, because
    // everything hanging under the tail has to be off the top of the frame by
    // the last frame.
    if (rand(s + 27.7) > 0.35) {
      put(
        cx + (rand(s + 29.3) - 0.5) * DX * 0.9,
        colTail + rBase * 0.45 * taper,
        rBase *
          (1.05 + 0.25 * rand(s + 31.1)) *
          (0.45 + 0.55 * exitRamp) *
          (0.35 + 0.65 * taper),
      );
    }

    // Drip strand below the tail: the mirror of the head's finger, a chain each
    // circle 0.72 of the last, which the goo necks into a string of paint being
    // pulled up off the bottom of the mass. Only about half the columns drip -
    // when every column had one they fused sideways into a second full-width
    // sheet under the mass and held the reveal back by ~250px.
    if (rand(s + 47.9) > 0.45) {
      const sn = 2 + Math.floor(rand(s + 53.3) * 2.99);
      for (let k = 1; k <= sn; k++) {
        put(
          cx + (rand(s + 60 + k * 4.1) - 0.5) * DX * 0.5,
          colTail + k * DY * 0.5 * exitRamp * taper,
          rBase * Math.pow(0.72, k) * (0.45 + 0.55 * exitRamp),
        );
      }
    }
  }

  // Detached droplets scouting ahead of the front. They pop in at staggered
  // times, rise with the mass and are swallowed as their lead closes to zero -
  // the single most effective thing against the contour reading as an edge.
  for (let d = 0; d < 15; d++) {
    const sd = d * 4.73 + seed * 3.37 + 100;
    const born = 0.02 + rand(sd) * 0.3;
    const life = clamp01((t - born) / 0.34);
    if (life <= 0 || life >= 1) continue;
    const u = 0.03 + rand(sd + 1.7) * 0.94;
    const ahead = H * (0.07 + rand(sd + 3.1) * 0.17) * (1 - smooth(life));
    put(
      W * u,
      headY - leadAt(u) * leadRamp - ahead,
      RB * (0.34 + rand(sd + 5.9) * 0.52) * smooth(clamp01(life * 2.4)),
    );
  }

  // Droplets left BEHIND by the trailing edge - the mirror of the scouts, and
  // the reference pack's other signature: blobs that detach from the retreating
  // paint, hang for a moment and are drawn thin. They are born and gone inside
  // the exit, so nothing is left hanging on the last frame.
  for (let d = 0; d < 9; d++) {
    const sd = d * 6.11 + seed * 4.13 + 400;
    const born = 0.55 + rand(sd) * 0.17;
    const life = clamp01((t - born) / 0.22);
    if (life <= 0 || life >= 1) continue;
    const u = 0.04 + rand(sd + 2.3) * 0.92;
    const behind = H * (0.03 + rand(sd + 4.7) * 0.09) * smooth(life);
    put(
      W * u,
      tailY + lagAt(u) + behind,
      RB * (0.3 + rand(sd + 6.1) * 0.34) * smooth(clamp01((1 - life) * 2.2)),
    );
  }

  const id = `wv1-goo-${seed}`;
  // The goo: blur everything into a common haze, then slam alpha back to a
  // hard edge at ~0.42. Neighbouring circles fuse before their outlines touch,
  // which is what produces liquid necking rather than a bag of bubbles.
  const blur = W * 0.02;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <filter
          id={id}
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"
          />
        </filter>
      </defs>
      <g filter={`url(#${id})`} fill={color}>
        {blobs.map((b, k) => (
          <circle key={k} cx={b.x} cy={b.y} r={b.r} />
        ))}
      </g>
    </svg>
  );
};
