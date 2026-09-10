/**
 * The edit, expressed once, in frames.
 *
 * Everything lands on the 120 BPM grid (15f = beat, 60f = bar) so the silent
 * master can take any 120 BPM track without re-timing. Section boundaries are
 * listed as absolute frames because the landscape cut reuses exactly the same
 * timing — only the staging inside each scene changes between the two
 * aspect ratios, never the rhythm.
 *
 * 960 frames @ 30fps = 32.0s = 16 bars.
 */

import { beats } from "./theme";

export type SectionId =
  | "intro"
  | "swipe"
  | "smartClean"
  | "compress"
  | "stats"
  | "endcard";

export type Section = {
  id: SectionId;
  from: number;
  durationInFrames: number;
  /** Full-bleed ground for the section. Drives the colour-block cuts. */
  bg: string;
};

import { C } from "./theme";

export const SECTIONS: Section[] = [
  // Dark stage. Kinetic type only — no product yet, so the promise lands
  // before the interface does.
  { id: "intro", from: 0, durationInFrames: beats(9), bg: C.stage },

  // Green: the brand colour leads the product half of the film.
  { id: "swipe", from: beats(9), durationInFrames: beats(13), bg: C.green },

  // Back to near-black. Smart Clean is the "it does it for you" beat and
  // reads as more technical, so it gets the dark ground.
  { id: "smartClean", from: beats(22), durationInFrames: beats(13), bg: C.orange },

  // Blue: the app's second accent. Compression is the "engineering" beat.
  { id: "compress", from: beats(35), durationInFrames: beats(11), bg: C.blue },

  // Purple: the payoff/proof beat before the endcard.
  { id: "stats", from: beats(46), durationInFrames: beats(9), bg: C.purple },

  // Deep green endcard, logo slam, store badge.
  { id: "endcard", from: beats(55), durationInFrames: beats(9), bg: C.stage },
];

export const TOTAL_FRAMES = beats(64); // 960

export const sectionById = (id: SectionId): Section => {
  const s = SECTIONS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown section: ${id}`);
  return s;
};

/**
 * Headlines per section. Kept here rather than inside the scene components so
 * the whole script can be read — and fact-checked against the shipped app —
 * in one place.
 *
 * COPY RULE: every line must be defensible against the actual product. The
 * app is live on Google Play, so an unsupportable claim is a real problem,
 * not a creative liberty. Numbers shown are the ones in the supplied
 * screenshots of a real device.
 */
export const COPY = {
  intro: {
    setup: "Your camera roll",
    payoff: "just got lighter.",
    /** Glyph indices in `payoff` tinted green — mirrors the reference's
     *  partial-word accent rather than colouring the whole word. */
    payoffAccent: [9, 10, 11, 12, 13, 14, 15],
    push: "lighter.",
  },
  swipe: {
    headline: "Swipe away\nclutter.",
    sub: "Keep what matters. Clear the rest.",
  },
  smartClean: {
    headline: "Let it find them.",
    sub: "Duplicates, screenshots, blurry shots.",
  },
  compress: {
    headline: "Half the size.",
    // NOT "same photo" / "no quality loss". store-listing-generated/LISTING.md
    // §6 explicitly permits "without visibly losing quality" and forbids
    // upgrading it to an absolute lossless claim. This is that exact wording.
    sub: "Without visibly losing quality.",
  },
  stats: {
    headline: "Get the space back.",
    // NOT "nothing leaves your phone" — the free tier links AdMob and
    // RevenueCat, which do transmit device and advertising identifiers, so the
    // absolute form is false. The ANALYSIS genuinely is fully local, and that
    // is what this narrower claim says.
    sub: "Cleaning runs on your device.",
  },
  endcard: {
    tagline: "Clean your gallery. Keep the memories.",
    // "Free on Google Play" would imply every feature is free; Smart Clean,
    // Convert, video compression and Compress All are Pro.
    cta: "Get it on Google Play",
  },
} as const;

/**
 * Smart Clean, the Convert studio, video compression, Compress All and
 * advanced stats are all Pro (src/features/subscription/feature-flags.ts).
 * The film shows Smart Clean, so it carries this badge — showing a paid
 * feature unbadged reads as a free-tier promise.
 */
export const PRO_BADGE = "Pro";

/**
 * Where the headline sits, per section. It used to be top-anchored in all
 * four, which made every scene the same shape. Varying it is what stops the
 * body reading as one long repeated slide.
 *   "none"   - no headline at all; the product carries the shot alone.
 *   "top"    - headline above the device.
 *   "bottom" - device above, headline beneath it.
 */
export type TextPos = "none" | "top" | "bottom";

export const TEXT_POS: Record<string, TextPos> = {
  swipe: "none",
  smartClean: "top",
  compress: "bottom",
  stats: "bottom",
};

/** Frames a background wipe takes to cross the frame at a section boundary. */
// 17 -> a 34-frame (1.13s) transition. It was 12 frames, which the client
// reported as "so fast you cannot even see it". The scenes keep playing
// underneath during the pour, so only the few fully-covered frames cost
// screen time.
export const WIPE = 17;
