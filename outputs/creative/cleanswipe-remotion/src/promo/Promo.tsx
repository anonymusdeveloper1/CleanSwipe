import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { LiquidWipe } from "./primitives/LiquidWipe";
import { loadFont as loadArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { SECTIONS, TOTAL_FRAMES, WIPE } from "./Storyboard";
import {
  CompressScene,
  EndcardScene,
  IntroScene,
  Layout,
  SceneProps,
  SmartCleanScene,
  StatsScene,
  SwipeScene,
} from "./scenes/Scenes";

// Fonts are loaded at module scope so every frame of every render — including
// the parallel render workers — has them before first paint. Without this the
// first frames render in a fallback face and the type visibly reflows.
//
// Weights and subsets are pinned deliberately: the unrestricted loadFont()
// fires ~126 network requests PER render worker, which on a 960-frame render
// across N workers is both slow and a needless dependency on the network
// staying up for the whole render.
loadArchivo("normal", { weights: ["400"], subsets: ["latin"] });
loadInter("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const SCENE_FOR: Record<string, React.FC<SceneProps>> = {
  intro: IntroScene,
  swipe: SwipeScene,
  smartClean: SmartCleanScene,
  compress: CompressScene,
  stats: StatsScene,
  endcard: EndcardScene,
};

/**
 * The film. One component drives both deliverables: the 1080x1920 master and
 * the 1920x1080 re-stage share this timeline exactly, so a change to the edit
 * cannot desynchronise the two cuts.
 */
export const Promo: React.FC<{ layout: Layout }> = ({ layout }) => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0f16" }}>
      {SECTIONS.map((s) => {
        const Scene = SCENE_FOR[s.id];
        return (
          <Sequence
            key={s.id}
            from={s.from}
            durationInFrames={s.durationInFrames}
            layout="none"
          >
            {/* Hard cut to the section's full-bleed ground. The Moolah
                reference never cross-fades between colour blocks — the cut IS
                the transition, and softening it kills the rhythm. */}
            <AbsoluteFill style={{ backgroundColor: s.bg }}>
              <Scene width={width} height={height} layout={layout} />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* Section transitions.
          The first attempt animated the INCOMING colour up from the bottom and
          stopped there, so mid-transition you saw the old scene on top and an
          empty colour field below — a hard horizontal seam that read as a
          glitch rather than a wipe, because the new scene's CONTENT was not
          there yet.
          This version sweeps a solid band THROUGH the frame instead: it covers
          completely at the section boundary and clears off the top after it.
          The cut still happens on the beat, fully hidden, and neither scene is
          ever half-drawn. */}
      {SECTIONS.slice(1).map((s, i) => (
        <Sequence
          key={`wipe-${s.id}`}
          from={s.from - WIPE}
          durationInFrames={WIPE * 2}
          layout="none"
        >
          <Wipe color={s.bg} seed={i + 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/**
 * Liquid section transition. Replaces the earlier hard colour band: the client
 * supplied a black-and-white liquid matte pack and asked for exactly that look
 * in the film's own colours.
 */
const Wipe: React.FC<{ color: string; seed: number }> = ({ color, seed }) => {
  const { width, height } = useVideoConfig();
  return (
    <LiquidWipe
      durationInFrames={WIPE * 2}
      color={color}
      width={width}
      height={height}
      seed={seed}
    />
  );
};

export const PromoVertical: React.FC = () => <Promo layout="vertical" />;
export const PromoLandscape: React.FC = () => <Promo layout="landscape" />;

export { TOTAL_FRAMES };
