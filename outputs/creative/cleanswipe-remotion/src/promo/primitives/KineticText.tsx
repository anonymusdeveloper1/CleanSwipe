import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, SPRING, jitter, rand } from "../theme";

/**
 * The intro's signature type treatment, taken off the LemFi reference.
 *
 * Two build modes, because the reference uses both and the contrast between
 * them is what gives the intro its shape:
 *
 *   "word"   — words appear one at a time, each on a beat, rising and settling.
 *              Used for the calm setup lines.
 *   "letter" — every glyph tumbles into place individually: it drops from
 *              above, rotated off-axis, and springs to level with overshoot.
 *              Used for the payoff word, where the extra character earns its
 *              keep. This is the move the client specifically called out.
 *
 * `accent` marks glyph indices (letter mode) or word indices (word mode) that
 * render in the accent colour — the reference tints two or three letters
 * inside the payoff word rather than the whole word, which is what stops it
 * looking like a plain colour change.
 */

type Props = {
  text: string;
  /** Frame (relative to the enclosing Sequence) at which the build starts. */
  startFrame?: number;
  /** Frames between successive words/letters. Defaults to a musical value. */
  stagger?: number;
  /**
   * "relay" is the measured Moolah build and the right default for the
   * colour-block body sections: each word appears FULLY FORMED — no fade,
   * slide, scale or blur — filled in `relayColor`, and flips to `color` on the
   * exact frame the next word lands. The only things that animate are fill
   * colour and the number of visible words. The block as a whole eases up from
   * ~16px below its rest position over ~400ms (the "Settle-Up").
   */
  mode?: "word" | "letter" | "relay";
  /** Indices rendered in `accentColor` instead of `color`. */
  accent?: number[];
  color?: string;
  accentColor?: string;
  /** relay mode: the colour a word is born in before it flips to `color`. */
  relayColor?: string;
  fontSize: number;
  fontFamily?: string;
  lineHeight?: number;
  align?: "center" | "left";
  /** Extra scale applied to the whole block, for camera-push moments. */
  scale?: number;
  maxWidth?: number | string;
};

export const KineticText: React.FC<Props> = ({
  text,
  startFrame = 0,
  stagger,
  mode = "word",
  accent = [],
  color = C.text,
  accentColor = C.green,
  relayColor,
  fontSize,
  fontFamily = FONT.display,
  lineHeight = 0.95,
  align = "center",
  scale = 1,
  maxWidth = "88%",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accentSet = React.useMemo(() => new Set(accent), [accent]);

  // Words stagger slower than letters — a word carries more meaning and needs
  // longer on screen to be read.
  const step =
    stagger ?? (mode === "relay" ? 2.5 : mode === "word" ? 6 : 2.5);

  // Settle-Up: measured at 10-20px of upward travel over 300-450ms, ease-out,
  // no overshoot. It is applied to the BLOCK, never to the individual words —
  // in the reference the words themselves do not move at all.
  const settleT = Math.max(0, Math.min(1, (frame - startFrame) / 13));
  const blockRise = mode === "relay" ? (1 - (1 - Math.pow(1 - settleT, 3))) * 18 : 0;

  // Words are the wrapping unit in BOTH modes. In letter mode the glyphs are
  // still animated individually, but they are grouped inside a nowrap span per
  // word — otherwise the flex container breaks lines mid-word and you get
  // "lighte / r." across two lines, which is what a naive per-glyph flex does.
  const words = text.split(" ");
  let cursor = 0;
  const grouped = words.map((w) => {
    const startIndex = cursor;
    const perWord = mode === "letter";
    const glyphs = perWord ? Array.from(w) : [w];
    cursor += glyphs.length;
    // Word and relay modes advance one unit per word, not per glyph.
    if (!perWord) cursor = startIndex + 1;
    return { word: w, glyphs, startIndex };
  });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "baseline",
        gap: `${fontSize * 0.1}px ${fontSize * 0.26}px`,
        maxWidth,
        margin: align === "center" ? "0 auto" : undefined,
        transform: `translateY(${blockRise}px) scale(${scale})`,
        fontFamily,
        fontSize,
        lineHeight,
        letterSpacing: mode === "letter" ? "-0.02em" : "-0.03em",
        textAlign: align,
      }}
    >
      {grouped.map((g) => (
        <span
          key={g.startIndex}
          style={{ display: "inline-block", whiteSpace: "nowrap" }}
        >
          {g.glyphs.map((glyph, gi) => {
            const u = { str: glyph, i: g.startIndex + gi };
            return renderGlyph(u);
          })}
        </span>
      ))}
    </div>
  );

  function renderGlyph(u: { str: string; i: number }) {
    {
        const t = frame - startFrame - u.i * step;

        if (mode === "relay") {
          if (t < 0) {
            return (
              <span
                key={u.i}
                style={{ opacity: 0, display: "inline-block", whiteSpace: "pre" }}
              >
                {u.str}
              </span>
            );
          }
          // A word stays in the relay colour until the NEXT word appears; the
          // final word holds it for one extra beat before flipping.
          const nextAt = step;
          const isCurrent = t < nextAt;
          return (
            <span
              key={u.i}
              style={{
                display: "inline-block",
                whiteSpace: "pre",
                color: isCurrent ? relayColor ?? accentColor : color,
              }}
            >
              {u.str}
            </span>
          );
        }

        const s = spring({ frame: t, fps, config: SPRING, durationInFrames: 24 });

        // A glyph that has not started yet must be fully invisible, not just
        // at opacity 0 — spring() clamps at 0 but the transform would still
        // paint a stale position for one frame on some easings.
        if (t < 0) {
          return (
            <span
              key={u.i}
              style={{ opacity: 0, display: "inline-block", whiteSpace: "pre" }}
            >
              {u.str === " " ? " " : u.str}
            </span>
          );
        }

        // Letter mode: each glyph falls from above with an individual rotation
        // and a small horizontal wobble, all derived from its index so the
        // render is deterministic across frames and across re-renders.
        const rise = mode === "letter" ? (1 - s) * fontSize * 0.85 : (1 - s) * fontSize * 0.42;
        const rot =
          mode === "letter" ? (1 - s) * jitter(u.i * 3.1 + 1) * 34 : (1 - s) * 4;
        const drift =
          mode === "letter" ? (1 - s) * jitter(u.i * 7.7 + 5) * fontSize * 0.12 : 0;
        const overshootScale = 0.86 + s * 0.14;

        return (
          <span
            key={u.i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              opacity: Math.min(1, s * 2.2),
              color: accentSet.has(u.i) ? accentColor : color,
              transform: `translate(${drift}px, ${rise}px) rotate(${rot}deg) scale(${overshootScale})`,
              transformOrigin: "50% 80%",
            }}
          >
            {u.str === " " ? " " : u.str}
          </span>
        );
    }
  }
};

/**
 * A word that scales toward the camera and pushes past the frame edge — the
 * reference's emphasis move, used once on the payoff word so it stays special.
 */
export const PushWord: React.FC<{
  text: string;
  startFrame: number;
  durationInFrames: number;
  from?: number;
  to?: number;
  color?: string;
  fontSize: number;
}> = ({
  text,
  startFrame,
  durationInFrames,
  from = 1,
  to = 2.6,
  color = C.text,
  fontSize,
}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, Math.min(1, (frame - startFrame) / durationInFrames));
  // Ease-out so the push decelerates into the cut rather than slamming.
  const eased = 1 - Math.pow(1 - t, 2.4);
  const s = from + (to - from) * eased;

  return (
    <div
      style={{
        fontFamily: FONT.display,
        fontSize,
        color,
        transform: `scale(${s})`,
        letterSpacing: "-0.03em",
        lineHeight: 0.95,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

/** Confetti-ish particle field, deterministic. Used sparingly on the endcard. */
export const Particles: React.FC<{
  count?: number;
  seed?: number;
  colors?: string[];
  width: number;
  height: number;
  startFrame?: number;
}> = ({
  count = 40,
  seed = 1,
  colors = [C.green, C.white, C.purple, C.yellow],
  width,
  height,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;

  return (
    <>
      {new Array(count).fill(0).map((_, i) => {
        const r1 = rand(i * 1.7 + seed);
        const r2 = rand(i * 3.3 + seed + 11);
        const r3 = rand(i * 5.9 + seed + 23);
        const fall = t * (1.1 + r2 * 2.2);
        const x = r1 * width;
        const y = ((r3 * height + fall) % (height + 120)) - 60;
        const size = 6 + r2 * 12;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size * (0.4 + r1 * 0.8),
              background: colors[i % colors.length],
              borderRadius: r2 > 0.5 ? "50%" : 2,
              transform: `rotate(${t * (1 + r1 * 3) + r3 * 360}deg)`,
              opacity: 0.85,
            }}
          />
        );
      })}
    </>
  );
};


/**
 * The payoff word, stepped rather than smoothly pushed.
 *
 * Requested behaviour: it must NOT ease continuously. It jumps to a larger
 * size, HOLDS for a beat, jumps again, holds — fast and mechanical — while the
 * fill travels from green to white across the steps. Stepping reads as
 * deliberate emphasis where a smooth push reads as a slow zoom.
 */
export const SteppedWord: React.FC<{
  text: string;
  startFrame: number;
  /** Frames each size is HELD before the next jump. */
  holdFrames?: number;
  /** Scale at each step. */
  steps?: number[];
  from?: string;
  to?: string;
  fontSize: number;
}> = ({
  text,
  startFrame,
  holdFrames = 7,
  steps = [1, 1.42, 1.9, 2.5],
  from = C.green,
  to = C.white,
  fontSize,
}) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  if (t < 0) return null;

  const idx = Math.min(steps.length - 1, Math.floor(t / holdFrames));
  const scale = steps[idx];

  // Colour walks green -> white across the steps, landing on white for the
  // final, largest hold.
  const p = steps.length > 1 ? idx / (steps.length - 1) : 1;
  const mix = (a: string, b: string, u: number) => {
    const h = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const [ar, ag, ab] = h(a);
    const [br, bg, bb] = h(b);
    const r = Math.round(ar + (br - ar) * u);
    const g = Math.round(ag + (bg - ag) * u);
    const bl = Math.round(ab + (bb - ab) * u);
    return `rgb(${r}, ${g}, ${bl})`;
  };

  return (
    <div
      style={{
        fontFamily: FONT.display,
        fontSize,
        color: mix(from, to, p),
        transform: `scale(${scale})`,
        letterSpacing: "-0.03em",
        lineHeight: 0.95,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};
