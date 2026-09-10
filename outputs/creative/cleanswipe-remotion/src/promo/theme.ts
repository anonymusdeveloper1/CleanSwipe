/**
 * SwipeClean promo — design tokens, beat grid and motion vocabulary.
 *
 * Everything in the film is cut to a fixed 120 BPM grid so the delivered
 * master is SILENT but drop-in ready: any 120 BPM track lands on the cuts
 * without re-timing. One beat = 0.5s = 15 frames at 30fps; one bar = 60 frames.
 *
 * Colours are the app's REAL palette, resolved from src/theme/colors.ts in the
 * SwipeClean repo — the accent set doubles as the full-bleed colour-block
 * system for the body sections, which is why the film reads as the product
 * rather than as generic motion design.
 */

export const FPS = 30;
export const BPM = 120;

/** 15 frames. The atomic unit of the edit — nothing cuts off-grid. */
export const BEAT = (FPS * 60) / BPM;
/** 60 frames. Section changes land on bars. */
export const BAR = BEAT * 4;

/** Frames for n beats. */
export const beats = (n: number) => Math.round(n * BEAT);
/** Frames for n bars. */
export const bars = (n: number) => Math.round(n * BAR);

// ---------------------------------------------------------------------------
// Palette — the app's own colours (SwipeClean src/theme/colors.ts)
// ---------------------------------------------------------------------------

export const C = {
  /** Brand accent. Default in settings, leads the picker. */
  green: "#10b981",
  /** Deeper green used in the logo mark and endcard ground. */
  greenDeep: "#059669",
  greenDark: "#047857",

  /** App accent options — reused as the colour-block system. */
  blue: "#075ec8",
  purple: "#8b5cf6",
  orange: "#f59e0b",
  pink: "#ec4899",

  /** Dark theme surfaces — the app is dark by default. */
  bg: "#111827",
  surface: "#1f2937",
  surfaceSoft: "#253047",
  surfaceStrong: "#303d58",
  border: "#334155",

  text: "#f9fafb",
  muted: "#cbd5e1",
  faint: "#64748b",

  red: "#f87171",
  yellow: "#fbbf24",

  /** Intro stage — a touch deeper than the app bg so the logo cut lifts. */
  stage: "#0b0f16",
  /** Bone. Ground for Smart Clean: a DARK device on the app's own dark bg
   *  was invisible, and this also breaks up four saturated colour blocks. */
  bone: "#efeade",
  white: "#ffffff",
} as const;

/**
 * Readable foreground for each block colour. Green and orange are light
 * enough that near-black type outperforms white on them.
 */
export const onColor = (bg: string): string =>
  bg === C.green || bg === C.orange || bg === C.yellow || bg === C.white || bg === C.bone
    ? C.bg
    : C.white;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const FONT = {
  /** Oversized headlines. Archivo Black is the closest match to the heavy
   *  grotesk the Moolah reference sets its full-bleed headlines in. */
  display: '"Archivo Black", "Arial Black", sans-serif',
  /** UI recreation + supporting copy. */
  ui: 'Inter, "Segoe UI", system-ui, sans-serif',
} as const;

/** Headline size as a share of frame width — refs run 11–14% cap height. */
export const displaySize = (frameWidth: number, scale = 1) =>
  frameWidth * 0.125 * scale;

// ---------------------------------------------------------------------------
// Motion vocabulary
// ---------------------------------------------------------------------------

/**
 * The house spring. Noticeable overshoot without wobble — matches the
 * ~8% overshoot-and-settle measured on the reference type entrances.
 */
export const SPRING = { damping: 14, mass: 0.6, stiffness: 120 } as const;

/** Tighter, for UI elements that should feel mechanical rather than playful. */
export const SPRING_TIGHT = { damping: 20, mass: 0.5, stiffness: 160 } as const;

/** Loose and heavy, for large objects (phone, logo slam). */
export const SPRING_HEAVY = { damping: 16, mass: 1.1, stiffness: 90 } as const;

/** Standard ease-out cubic for camera moves, which should not overshoot. */
export const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);
export const EASE_IN_OUT = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Deterministic pseudo-random in [0,1) from an integer seed.
 * Math.random() is banned inside Remotion components — every frame must
 * render identically or the video flickers and re-renders diverge.
 */
export const rand = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Symmetric ±1 jitter from a seed. */
export const jitter = (seed: number): number => rand(seed) * 2 - 1;

/**
 * Momentum drift — the single most important thing separating this from the
 * references.
 *
 * Measured beat intervals: Moolah 433ms, LemFi 417ms, Flow 850ms, Unipay
 * 700ms. Unipay achieves its pace with NO cuts at all, and the analysis of it
 * is blunt about how: "The camera is NEVER still between punches. After each
 * punch it continues in the SAME direction at a slow constant velocity, like
 * residual inertia, until the next punch."
 *
 * A first cut of this film held each section for six seconds with a single
 * event in it, so roughly ten of its thirty-two seconds were frames identical
 * to their neighbours. This returns a slow, always-moving transform that makes
 * a held shot read as a held CAMERA rather than a frozen one.
 *
 * @param frame     frame within the scene
 * @param duration  scene length in frames
 * @param amount    total scale gained across the scene (0.06 = +6%)
 */
export const momentum = (
  frame: number,
  duration: number,
  amount = 0.06,
): { scale: number; y: number } => {
  const t = Math.max(0, Math.min(1, frame / Math.max(1, duration)));
  return { scale: 1 + amount * t, y: -amount * 160 * t };
};

/**
 * A "punch" — Unipay's workhorse move. easeInOutCubic, ~950ms, no overshoot;
 * the measured curve fit cubic-bezier(0.65, 0, 0.35, 1) to within a percent.
 * Returns 0..1 progress through the punch.
 */
export const punch = (frame: number, start: number, duration = 28): number => {
  const t = Math.max(0, Math.min(1, (frame - start) / duration));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
