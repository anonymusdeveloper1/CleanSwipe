import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {

  C,
  FONT,
  SPRING,
  SPRING_HEAVY,

  beats,
  jitter,
  momentum,
  onColor,
  punch,
  rand,
} from "../theme";
import { KineticText, Particles, SteppedWord } from "../primitives/KineticText";
import { Counter, LogoSlam } from "../primitives/Brand";
import { FloatingCard } from "../primitives/PhoneFrame";
import { Phone3D } from "../primitives/Phone3D";
import { COPY, PRO_BADGE } from "../Storyboard";

export type Layout = "vertical" | "landscape";

export type SceneProps = {
  width: number;
  height: number;
  layout: Layout;
};

/**
 * Shared staging. In vertical the headline sits above the device; in
 * landscape it moves to the left half and the device to the right, because a
 * 16:9 frame with a phone centred in it is mostly empty ground. The timing is
 * identical in both — only the arrangement changes.
 */
const Stage: React.FC<{
  layout: Layout;
  width: number;
  height: number;
  headline: React.ReactNode;
  device: React.ReactNode;
  /** Vertical only: how far down the headline block sits. */
  headlineTop?: number;
  /** Frame at which the headline drifts out, leaving the product alone. */
  exitAt?: number;
  /** Headline above the device ("top") or beneath it ("bottom"). */
  pos?: "top" | "bottom";
}> = ({ layout, width, height, headline, device, headlineTop, exitAt, pos = "top" }) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const frame = useCurrentFrame();
  const ex =
    exitAt === undefined ? 0 : Math.max(0, Math.min(1, (frame - exitAt) / 16));
  // Ease-IN: it accelerates away rather than gliding, which is what makes the
  // cut land on a moving frame instead of an empty one.
  const exEased = ex * ex * ex;
  const exitStyle: React.CSSProperties = {
    transform: `translateY(${-exEased * height * 0.55}px)`,
    opacity: 1 - Math.min(1, ex * 1.35),
  };

  if (layout === "landscape") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: width * 0.06,
          padding: `0 ${width * 0.07}px`,
        }}
      >
        <div
          style={{
            flex: "1 1 0",
            display: "flex",
            justifyContent: "flex-start",
            ...exitStyle,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {device}
        </div>
      </div>
    );
  }
  const bottomAnchored = pos === "bottom";
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          // Bottom-anchored sections put the copy under the device instead of
          // over it, which is the variation the body was missing.
          ...(bottomAnchored
            ? { bottom: height * 0.055 }
            : { top: headlineTop ?? height * 0.09 }),
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          padding: `0 ${width * 0.06}px`,
          ...exitStyle,
        }}
      >
        {headline}
      </div>
      <div
        style={{
          position: "absolute",
          // Device sits high when the copy is beneath it.
          top: bottomAnchored ? height * 0.02 : height * 0.42,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {device}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 1. INTRO — LemFi language: kinetic type on a dark stage
// ---------------------------------------------------------------------------

export const IntroScene: React.FC<SceneProps> = ({ width, height, layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const big = layout === "landscape" ? width * 0.062 : width * 0.115;

  // A drift of photo tiles rises behind the type, standing in for the globe
  // that scales up behind the reference's setup line. It reads as "your
  // gallery" without needing a literal screenshot this early in the film.
  const tileIn = spring({ frame, fps, config: SPRING_HEAVY, durationInFrames: 34 });

  // The payoff word pushes toward camera on the last two beats before the cut.
  const pushStart = beats(6.5);
  const pushing = frame >= pushStart;

  return (
    <>
      {/* Tile cluster */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {new Array(14).fill(0).map((_, i) => {
          const r1 = rand(i * 2.3 + 1);
          const r2 = rand(i * 4.7 + 9);
          const size = width * (0.13 + r1 * 0.1);
          const angle = jitter(i * 1.9) * 22;
          const cx = width * (0.08 + r1 * 0.84);
          const cy = height * (0.14 + r2 * 0.74);
          const delay = i * 1.6;
          const s = spring({
            frame: frame - delay,
            fps,
            config: SPRING_HEAVY,
            durationInFrames: 34,
          });
          const drift = interpolate(frame, [0, beats(9)], [0, -height * 0.05]);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: cx - size / 2,
                top: cy - size / 2 + drift,
                width: size,
                height: size * 1.28,
                borderRadius: size * 0.12,
                overflow: "hidden",
                transform: `rotate(${angle}deg) scale(${s})`,
                opacity: 0.95 * tileIn,
                boxShadow: "0 18px 34px rgba(0,0,0,0.55)",
              }}
            >
              <Img
                src={staticFile(
                  `promo/tile-${String((i % 16) + 1).padStart(2, "0")}.jpg`,
                )}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          );
        })}
        {/* Vignette so the type always wins against the tiles. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse at 50% 46%, rgba(11,15,22,0.90) 0%, rgba(11,15,22,0.66) 44%, rgba(11,15,22,0.30) 100%)`,
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: big * 0.16,
        }}
      >
        {!pushing && (
          <>
            <KineticText
              text={COPY.intro.setup}
              startFrame={0}
              mode="word"
              stagger={5}
              fontSize={big}
              color={C.text}
            />
            <KineticText
              text={COPY.intro.payoff}
              startFrame={beats(2.6)}
              mode="letter"
              stagger={1.9}
              accent={[...COPY.intro.payoffAccent]}
              accentColor={C.green}
              fontSize={big}
              color={C.text}
            />
          </>
        )}
        {pushing && (
          <SteppedWord
            text={COPY.intro.push}
            startFrame={pushStart}
            holdFrames={7}
            steps={layout === "landscape" ? [1, 1.3, 1.65, 2.05] : [1, 1.42, 1.9, 2.5]}
            from={C.green}
            to={C.white}
            fontSize={big}
          />
        )}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// 2. SWIPE — Moolah language: colour block, oversized headline, tilted phone
// ---------------------------------------------------------------------------

export const SwipeScene: React.FC<SceneProps> = ({ width, height, layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneW = layout === "landscape" ? height * 0.44 : width * 0.56;

  // NO HEADLINE IN THIS SECTION, by request. The device is the subject: it
  // rises from below frame, sits centred, and the swipe itself is the story.
  const rise = spring({ frame: frame - 2, fps, config: SPRING_HEAVY, durationInFrames: 32 });
  const mo = momentum(frame, beats(13), 0.05);

  // Three swipes on the beat. Each one throws the photo clear of the device.
  const SWIPES = [
    { at: beats(3), dir: -1 },
    { at: beats(5.5), dir: 1 },
    { at: beats(8), dir: -1 },
  ];

  let variant = 0;
  for (const sw of SWIPES) if (frame >= sw.at + 10) variant++;

  // The in-screen card motion now lives in the pre-rendered screen textures
  // (ScreenComps.tsx uses these exact timings), so the scene only needs to know
  // WHICH deck state to show.

  const device = (
    <div
      style={{
        transform: `translateY(${(1 - rise) * height * 0.55 + mo.y}px) scale(${mo.scale})`,
        opacity: rise,
      }}
    >
      {/* Deck state is baked into four pre-rendered screen textures rather
          than animated live, so the on-screen card still re-deals in step with
          the photos being thrown clear of the device. */}
      {/* REAL 3D MOTION.
          The device used to sit at a fixed ~13deg, which is too small an angle
          for the eye to read foreshortening - so however good the geometry was,
          it still looked like a flat card. It now turns through a wide arc and
          keeps moving, which is what makes the rail's specular travel and the
          body's thickness legible. The screen is a JPEG SEQUENCE, so the UI
          animates inside the glass instead of being a dead still. */}
      <Phone3D
        phoneWidth={phoneW}
        seq={{ dir: "seq/swipe", frames: 200, pad: 3 }}
        // STAGING MEASURED OFF THE MOOLAH REFERENCE, not invented. Across 95
        // measured frames it NEVER rolls (|rotZ| <= 0.7deg), never exceeds 25deg
        // of yaw, and never animates pitch while yawing - pitch is a fixed
        // pedestal per shot (0, -8 or +2) held frozen through the whole sweep,
        // and the yaw is ONE monotonic constant-rate sweep that passes through
        // frontal without dwelling. The previous build broke three of those rules
        // at once - it rolled the device, swung to 34deg, and tumbled pitch and
        // yaw together - which is what read as unnatural.
        rotY={interpolate(frame, [0, beats(13)], [22, -20], {
          extrapolateRight: "clamp",
        })}
        // Frozen pedestal - never animated alongside the yaw.
        rotX={-8}
        rotZ={0}
      />
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {device}
      </div>

      {/* THE POINT OF THIS SCENE: the photos do not stay inside the screen.
          Each swipe throws a full-size copy of the photo OUT of the device and
          across the frame, so the media becomes a physical object in the room
          rather than pixels behind glass. These are siblings of the phone, not
          children, because a screen clips its own contents. */}
      {SWIPES.map((sw, i) => {
        const t = frame - sw.at;
        if (t < 0) return null;
        const fly = spring({
          frame: t,
          fps,
          config: { damping: 17, mass: 0.9, stiffness: 85 },
          durationInFrames: 46,
        });
        const cardW = phoneW * 0.82;
        const x = sw.dir * fly * width * 0.46;
        const y = -fly * height * 0.06 + fly * fly * height * 0.1;
        const rot = sw.dir * fly * 21;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: cardW,
              height: cardW * 1.42,
              marginLeft: -cardW / 2,
              marginTop: -cardW * 0.71,
              transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${
                0.86 + fly * 0.24
              })`,
              opacity: Math.min(1, t / 3),
              borderRadius: cardW * 0.07,
              overflow: "hidden",
              boxShadow: `0 ${28 * fly + 8}px ${58 * fly + 12}px rgba(0,0,0,0.5)`,
              border: `${Math.max(2, cardW * 0.012)}px solid rgba(255,255,255,0.92)`,
              boxSizing: "border-box",
            }}
          >
            <Img
              src={staticFile(`promo/hero-${(i % 3) + 1}.jpg`)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* The verdict stamp travels with the photo, so left/right meaning
                stays legible even with no headline anywhere on screen. */}
            <div
              style={{
                position: "absolute",
                top: cardW * 0.07,
                [sw.dir > 0 ? "left" : "right"]: cardW * 0.07,
                padding: `${cardW * 0.028}px ${cardW * 0.07}px`,
                borderRadius: cardW * 0.045,
                fontFamily: FONT.display,
                fontSize: cardW * 0.115,
                color: "#fff",
                background: sw.dir > 0 ? C.green : C.red,
                transform: `rotate(${sw.dir > 0 ? -9 : 9}deg)`,
                opacity: Math.min(1, fly * 3),
              }}
            >
              {sw.dir > 0 ? "KEEP" : "CLEAR"}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. SMART CLEAN — Flow language: isolated UI components as hero objects,
//    which then assemble into the phone (the Moolah "starter packs" move)
// ---------------------------------------------------------------------------

// Four of Smart Clean's eight real detectors (smart-clean.service.ts
// SMART_CLEAN_DETECTORS). Names only — no per-category counts, because the
// only measured figures available are the aggregate and the duplicate count,
// and both of those are shown on the device screen where they belong.
const DETECTORS = [
  { label: "Duplicates", glyph: "⧉", tint: C.green },
  { label: "Screenshots", glyph: "▣", tint: C.blue },
  { label: "Blurry shots", glyph: "◌", tint: C.purple },
  { label: "Large videos", glyph: "▶", tint: C.orange },
];

export const SmartCleanScene: React.FC<SceneProps> = ({ width, height, layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneW = layout === "landscape" ? height * 0.355 : width * 0.48;

  // Beat 0–6: detector chips fly in one at a time, isolated in space.
  // Beat 6–12: they converge into the phone, which rises to receive them.
  const assembleStart = beats(5.5);
  const assemble = spring({
    frame: frame - assembleStart,
    fps,
    config: SPRING_HEAVY,
    durationInFrames: 34,
  });

  // The device is present from the first frame of the section; only the chips
  // are staged in. An earlier cut held the phone back until the assemble beat,
  // which left six seconds of near-empty frame.
  const phoneRise = spring({
    frame: frame - 2,
    fps,
    config: SPRING_HEAVY,
    durationInFrames: 30,
  });
  const mo = momentum(frame, beats(13), 0.07);
  const pin = punch(frame, beats(9.5), 26);

  const badgeIn = spring({
    frame: frame - beats(1.5),
    fps,
    config: SPRING,
    durationInFrames: 20,
  });
  const headline = (
    <div style={{ textAlign: layout === "landscape" ? "left" : "center" }}>
      <KineticText
        text={COPY.smartClean.headline.replace("\n", " ")}
        startFrame={2}
        mode="relay"
        // Slower than the other two: at 2.5 frames the flip was over before it
        // registered. Moolah measures 67-100ms, but that only reads when the
        // two colours fight each other, which they now do.
        stagger={3.5}
        // Born WHITE, flips to near-black on the orange ground. Previously the
        // headline was C.text (white) on a near-white background - tone on
        // tone - and the relay flipped white to white, so it did nothing.
        relayColor={C.white}
        fontSize={layout === "landscape" ? width * 0.095 : width * 0.187}
        color={onColor(C.orange)}
        align={layout === "landscape" ? "left" : "center"}
        maxWidth={layout === "landscape" ? "100%" : "96%"}
      />
      {/* No sub-copy here by design: it read "Duplicates, screenshots,
          blurry shots." while the floating chips beside it name those
          exact categories. Two elements saying the same thing is what
          made this frame feel crowded. Let the chips talk. */}
    </div>
  );

  const chipW = layout === "landscape" ? width * 0.15 : width * 0.38;

  const device = (
    <div style={{ position: "relative" }}>
      <div
        style={{
          transform: `translateY(${
            (1 - phoneRise) * height * 0.45 + mo.y
          }px) scale(${mo.scale + pin * 0.16})`,
          transformOrigin: layout === "landscape" ? "50% 50%" : "50% 0%",
          opacity: phoneRise,
        }}
      >
        {/* REAL 3D MOTION.
            The device used to sit at a fixed ~13deg, which is too small an angle
            for the eye to read foreshortening - so however good the geometry was,
            it still looked like a flat card. It now turns through a wide arc and
            keeps moving, which is what makes the rail's specular travel and the
            body's thickness legible. The screen is a JPEG SEQUENCE, so the UI
            animates inside the glass instead of being a dead still. */}
        <Phone3D
          phoneWidth={phoneW}
          seq={{ dir: "seq/smartclean", frames: 200, pad: 3 }}
          // STAGING MEASURED OFF THE MOOLAH REFERENCE, not invented. Across 95
          // measured frames it NEVER rolls (|rotZ| <= 0.7deg), never exceeds 25deg
          // of yaw, and never animates pitch while yawing - pitch is a fixed
          // pedestal per shot (0, -8 or +2) held frozen through the whole sweep,
          // and the yaw is ONE monotonic constant-rate sweep that passes through
          // frontal without dwelling. The previous build broke three of those rules
          // at once - it rolled the device, swung to 34deg, and tumbled pitch and
          // yaw together - which is what read as unnatural.
          rotY={interpolate(frame, [0, beats(13)], [-21, 19], {
            extrapolateRight: "clamp",
          })}
          // Frozen pedestal - never animated alongside the yaw.
          rotX={2}
          rotZ={0}
        />
      </div>

      {/* The detector chips. Each enters solo with heavy blur and 3D rotation
          (the Flow treatment), holds, then flies into the device. */}
      {DETECTORS.map((d, i) => {
        const inAt = beats(1 + i * 1.2);
        const s = spring({ frame: frame - inAt, fps, config: SPRING, durationInFrames: 26 });
        if (frame < inAt) return null;

        // Resting position: fanned around the device.
        const restX = (i % 2 === 0 ? -1 : 1) * width * (layout === "landscape" ? 0.18 : 0.285);
        const restY = (i - 1.5) * (layout === "landscape" ? height * 0.15 : height * 0.115);

        const x = restX * (1 - assemble) * (1 - 0) + restX * 0.06 * assemble;
        const y = restY * (1 - assemble) + restY * 0.1 * assemble;
        const scale = (0.7 + s * 0.3) * (1 - assemble * 0.55);
        const blur = (1 - s) * 14;

        return (
          <div
            key={d.label}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: chipW,
              marginLeft: -chipW / 2,
              transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${
                jitter(i * 3.7) * 7 * (1 - assemble)
              }deg)`,
              filter: `blur(${blur}px)`,
              opacity: Math.min(1, s * 2) * (1 - assemble * 0.9),
              background: C.surfaceSoft,
              borderRadius: chipW * 0.09,
              padding: chipW * 0.055,
              display: "flex",
              alignItems: "center",
              gap: chipW * 0.05,
              boxShadow: "0 26px 52px rgba(0,0,0,0.55)",
              border: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                width: chipW * 0.17,
                height: chipW * 0.17,
                borderRadius: chipW * 0.05,
                background: `${d.tint}26`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: d.tint,
                fontSize: chipW * 0.09,
              }}
            >
              {d.glyph}
            </div>
            <div style={{ flex: 1, fontFamily: FONT.ui }}>
              <div style={{ fontWeight: 800, fontSize: chipW * 0.085, color: C.text }}>
                {d.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <Stage
        layout={layout}
        width={width}
        height={height}
        headline={headline}
        device={device}
        headlineTop={height * 0.045}
        exitAt={beats(8)}
      />
      {/* Pro badge, moved off the headline and parked at the foot of the
          frame. Smart Clean is Pro-gated (feature-flags.ts PRO_FEATURES) and
          showing it unbadged would read as a free-tier promise. */}
      <div
        style={{
          position: "absolute",
          top: height * 0.028,
          right: width * 0.055,
          display: "flex",
          justifyContent: "flex-end",
          opacity: badgeIn,
          transform: `translateY(${(1 - badgeIn) * -14}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONT.ui,
            fontWeight: 900,
            fontSize: layout === "landscape" ? width * 0.014 : width * 0.026,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.bone,
            background: C.bg,
            borderRadius: 999,
            padding: `${width * 0.008}px ${width * 0.026}px`,
          }}
        >
          {PRO_BADGE} feature
        </span>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// 4. COMPRESS — the detach move: a result card lifts off the screen
// ---------------------------------------------------------------------------

export const CompressScene: React.FC<SceneProps> = ({ width, height, layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fg = onColor(C.blue);
  // Smaller here: this section is bottom-anchored, so the device shares the
  // frame with copy beneath it instead of owning the whole height.
  const phoneW = layout === "landscape" ? height * 0.31 : width * 0.415;

  const rise = spring({ frame: frame - 2, fps, config: SPRING_HEAVY, durationInFrames: 30 });
  const mo = momentum(frame, beats(11), 0.07);
  const pin = punch(frame, beats(6), 26);
  const liftAt = beats(3);
  const lift = spring({ frame: frame - liftAt, fps, config: SPRING, durationInFrames: 28 });

  const headline = (
    <div style={{ textAlign: layout === "landscape" ? "left" : "center" }}>
      <KineticText
        text={COPY.compress.headline}
        startFrame={2}
        mode="relay"
        stagger={2.5}
        relayColor={C.green}
        fontSize={layout === "landscape" ? width * 0.095 : width * 0.187}
        color={fg}
        align={layout === "landscape" ? "left" : "center"}
      />
      <div
        style={{
          fontFamily: FONT.ui,
          fontWeight: 700,
          fontSize: layout === "landscape" ? width * 0.019 : width * 0.038,
          color: onColor(C.blue),
          opacity: interpolate(frame, [beats(2), beats(2.8)], [0, 0.82], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          marginTop: width * 0.018,
        }}
      >
        {COPY.compress.sub}
      </div>
    </div>
  );

  const cardW = layout === "landscape" ? width * 0.13 : width * 0.335;

  const device = (
    <div
      style={{
        position: "relative",
        transform: `translateY(${
          (1 - rise) * height * 0.4 + mo.y
        }px) scale(${mo.scale + pin * 0.14})`,
        transformOrigin: layout === "landscape" ? "50% 50%" : "50% 0%",
        opacity: rise,
        perspective: 1800,
        transformStyle: "preserve-3d",
      }}
    >
      {/* REAL 3D MOTION.
          The device used to sit at a fixed ~13deg, which is too small an angle
          for the eye to read foreshortening - so however good the geometry was,
          it still looked like a flat card. It now turns through a wide arc and
          keeps moving, which is what makes the rail's specular travel and the
          body's thickness legible. The screen is a JPEG SEQUENCE, so the UI
          animates inside the glass instead of being a dead still. */}
      <Phone3D
        phoneWidth={phoneW}
        seq={{ dir: "seq/compress", frames: 200, pad: 3 }}
        // STAGING MEASURED OFF THE MOOLAH REFERENCE, not invented. Across 95
        // measured frames it NEVER rolls (|rotZ| <= 0.7deg), never exceeds 25deg
        // of yaw, and never animates pitch while yawing - pitch is a fixed
        // pedestal per shot (0, -8 or +2) held frozen through the whole sweep,
        // and the yaw is ONE monotonic constant-rate sweep that passes through
        // frontal without dwelling. The previous build broke three of those rules
        // at once - it rolled the device, swung to 34deg, and tumbled pitch and
        // yaw together - which is what read as unnatural.
        rotY={interpolate(frame, [0, beats(11)], [24, -16], {
          extrapolateRight: "clamp",
        })}
        // Frozen pedestal - never animated alongside the yaw.
        rotX={0}
        rotZ={0}
      />

      {/* The before/after chip detaches from the grid and floats forward —
          the Moolah move, used once so it stays an event. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "46%",
          width: cardW,
          marginLeft: -cardW * 0.72,
          opacity: Math.min(1, lift * 2),
          // The Z must live on THIS element. Inside a preserve-3d parent the
          // browser sorts children by 3D position rather than DOM order, and
          // the translateZ on the inner FloatingCard sat in a flattened
          // subtree — so the card counted as z=0 and the phone painted over
          // it. Lifting the container itself puts it genuinely in front.
          transformStyle: "preserve-3d",
          transform: `translateZ(${140 * lift}px)`,
        }}
      >
        <FloatingCard lift={lift} rotY={-12} rotZ={-4}>
          <div
            style={{
              background: C.surface,
              borderRadius: cardW * 0.1,
              padding: cardW * 0.08,
              border: `1px solid ${C.border}`,
              fontFamily: FONT.ui,
              textAlign: "center",
            }}
          >
            <div style={{ color: C.muted, fontSize: cardW * 0.075, fontWeight: 700 }}>
              11 MB
            </div>
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: cardW * 0.19,
                color: C.green,
                margin: `${cardW * 0.02}px 0`,
              }}
            >
              <Counter
                from={11}
                to={5.3}
                decimals={1}
                startFrame={liftAt + 4}
                durationInFrames={26}
              />{" "}
              MB
            </div>
            <div style={{ color: C.muted, fontSize: cardW * 0.062, fontWeight: 600 }}>
              smaller file
            </div>
          </div>
        </FloatingCard>
      </div>
    </div>
  );

  return (
    <Stage
      layout={layout}
      width={width}
      height={height}
      headline={headline}
      device={device}
      headlineTop={height * 0.045}
      exitAt={beats(5.5)}
      pos="bottom"
    />
  );
};

// ---------------------------------------------------------------------------
// 5. STATS — the proof beat
// ---------------------------------------------------------------------------

export const StatsScene: React.FC<SceneProps> = ({ width, height, layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fg = onColor(C.purple);
  // Smaller here: this section is bottom-anchored, so the device shares the
  // frame with copy beneath it instead of owning the whole height.
  const phoneW = layout === "landscape" ? height * 0.31 : width * 0.415;

  const rise = spring({ frame: frame - 2, fps, config: SPRING_HEAVY, durationInFrames: 30 });
  // A slow camera push, borrowed from Unipay — the only scene that moves the
  // camera rather than cutting, so the film settles before the endcard.
  const mo = momentum(frame, beats(9), 0.08);
  const pin = punch(frame, beats(5.5), 26);
  const push = mo.scale + pin * 0.18;

  const headline = (
    <div style={{ textAlign: layout === "landscape" ? "left" : "center" }}>
      <KineticText
        text={COPY.stats.headline}
        startFrame={2}
        mode="relay"
        stagger={2.5}
        relayColor={C.green}
        fontSize={layout === "landscape" ? width * 0.095 : width * 0.187}
        color={fg}
        align={layout === "landscape" ? "left" : "center"}
      />
      <div
        style={{
          fontFamily: FONT.ui,
          fontWeight: 700,
          fontSize: layout === "landscape" ? width * 0.019 : width * 0.038,
          color: fg,
          opacity: interpolate(frame, [beats(2), beats(3)], [0, 0.78], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          marginTop: width * 0.016,
        }}
      >
        {COPY.stats.sub}
      </div>
    </div>
  );

  const device = (
    <div
      style={{
        transform: `translateY(${
          (1 - rise) * height * 0.4 + mo.y
        }px) scale(${push})`,
        transformOrigin: layout === "landscape" ? "50% 50%" : "50% 0%",
        opacity: rise,
      }}
    >
      {/* REAL 3D MOTION.
          The device used to sit at a fixed ~13deg, which is too small an angle
          for the eye to read foreshortening - so however good the geometry was,
          it still looked like a flat card. It now turns through a wide arc and
          keeps moving, which is what makes the rail's specular travel and the
          body's thickness legible. The screen is a JPEG SEQUENCE, so the UI
          animates inside the glass instead of being a dead still. */}
      <Phone3D
        phoneWidth={phoneW}
        seq={{ dir: "seq/stats", frames: 200, pad: 3 }}
        // STAGING MEASURED OFF THE MOOLAH REFERENCE, not invented. Across 95
        // measured frames it NEVER rolls (|rotZ| <= 0.7deg), never exceeds 25deg
        // of yaw, and never animates pitch while yawing - pitch is a fixed
        // pedestal per shot (0, -8 or +2) held frozen through the whole sweep,
        // and the yaw is ONE monotonic constant-rate sweep that passes through
        // frontal without dwelling. The previous build broke three of those rules
        // at once - it rolled the device, swung to 34deg, and tumbled pitch and
        // yaw together - which is what read as unnatural.
        rotY={interpolate(frame, [0, beats(9)], [-18, 20], {
          extrapolateRight: "clamp",
        })}
        // Frozen pedestal - never animated alongside the yaw.
        rotX={0}
        rotZ={0}
      />
    </div>
  );

  return (
    <Stage
      layout={layout}
      width={width}
      height={height}
      headline={headline}
      device={device}
      headlineTop={height * 0.045}
      exitAt={beats(6)}
      pos="bottom"
    />
  );
};

// ---------------------------------------------------------------------------
// 6. ENDCARD — LemFi's extruded logo slam
// ---------------------------------------------------------------------------

export const EndcardScene: React.FC<SceneProps> = ({ width, height, layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // No device here, by request: the endcard is the mark, the name and the call
  // to action, on a ground that does not repeat any earlier colour block.
  const mo = momentum(frame, beats(9), 0.04);
  const tagIn = spring({ frame: frame - beats(1.8), fps, config: SPRING, durationInFrames: 24 });
  const ctaIn = spring({ frame: frame - beats(3), fps, config: SPRING, durationInFrames: 24 });

  return (
    <>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <Particles
          width={width}
          height={height}
          count={30}
          seed={7}
          startFrame={0}
          colors={[C.green, "#a7f3d0", C.white]}
        />
      </div>
      {/* A soft green bloom so the dark ground is lit rather than flat. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 44%, rgba(16,185,129,0.22), rgba(16,185,129,0.05) 45%, rgba(0,0,0,0) 70%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: height * 0.03,
          transform: `scale(${mo.scale})`,
        }}
      >
        <LogoSlam
          startFrame={2}
          fontSize={layout === "landscape" ? width * 0.058 : width * 0.108}
          markSize={layout === "landscape" ? width * 0.062 : width * 0.118}
          color={C.white}
          shadowColor={C.greenDark}
          extrude={layout === "landscape" ? 14 : 22}
        />
        <div
          style={{
            fontFamily: FONT.ui,
            fontWeight: 700,
            fontSize: layout === "landscape" ? width * 0.021 : width * 0.042,
            color: "rgba(255,255,255,0.88)",
            opacity: tagIn,
            transform: `translateY(${(1 - tagIn) * 24}px)`,
            textAlign: "center",
          }}
        >
          {COPY.endcard.tagline}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: C.green,
            borderRadius: 999,
            padding: `${width * 0.018}px ${width * 0.05}px`,
            opacity: ctaIn,
            transform: `translateY(${(1 - ctaIn) * 20}px) scale(${0.94 + ctaIn * 0.06})`,
            marginTop: height * 0.012,
          }}
        >
          <span
            style={{
              fontFamily: FONT.ui,
              fontWeight: 900,
              fontSize: layout === "landscape" ? width * 0.02 : width * 0.04,
              color: "#04231a",
            }}
          >
            {COPY.endcard.cta}
          </span>
        </div>
      </div>
    </>
  );
};
