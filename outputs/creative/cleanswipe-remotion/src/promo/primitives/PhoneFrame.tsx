import React from "react";
import { C } from "../theme";

/**
 * The device mockup.
 *
 * WHY THIS IS EXTRUDED RATHER THAN A ROTATED CARD:
 * A `<div>` with a `rotateY` has no thickness — rotating it only skews a flat
 * rectangle, so there is no side to see and it reads as a picture of a phone
 * rather than a phone. The body is therefore extruded in CSS: `SLICES` copies
 * of the silhouette stacked at decreasing translateZ inside a `preserve-3d`
 * container. Perspective offsets each slice on its own, and the accumulated
 * edge IS the side rail. Done this way (rather than with one flat side face
 * rotated 90 degrees) the rail inherits `border-radius`, so it follows the
 * rounded corners instead of showing square ones at top and bottom.
 *
 * A photoreal GLTF model is NOT needed and should not be added. Comparing a
 * render against the Moolah reference at 7.72s side by side, the gap was never
 * "3D-ness" — it was four flat-out material errors, all fixed here:
 *   1. The bezel was ~2x too thick. Modern phones are nearly all screen.
 *   2. Dark bezel + dark app UI on a saturated ground merged into one blob.
 *      The rail is now bright enough to draw the silhouette against colour,
 *      and the screen spills a faint bloom so it reads as emissive.
 *   3. There was no camera cutout, so nothing said "phone" at a glance.
 *   4. Perspective was far too weak to foreshorten the top edge.
 *
 * The cutout is a CENTRED PUNCH-HOLE, not an iPhone dynamic island: SwipeClean
 * ships on Google Play only, and the screenshots come from a Galaxy S24, so an
 * iPhone body would be quietly wrong in the film.
 */

type Props = {
  width: number;
  /** Screen aspect. 19.5:9 is the S24 the screenshots came from. */
  aspect?: number;
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  /** Device thickness as a fraction of width. Real phones sit near 0.09. */
  depth?: number;
  /** Perspective distance in px. Lower = more dramatic foreshortening. */
  perspective?: number;
  shadow?: boolean;
  /** Emissive spill from the screen onto the ground behind it. */
  bloom?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

/** Enough slices that the rail reads as solid metal, few enough to stay cheap. */
const SLICES = 18;

export const PhoneFrame: React.FC<Props> = ({
  width,
  aspect = 19.5 / 9,
  rotY = 0,
  rotX = 0,
  rotZ = 0,
  depth = 0.1,
  // Was 2200, which is nearly orthographic at this size — the top edge did not
  // foreshorten and the device read flat.
  perspective = 1250,
  shadow = true,
  bloom = true,
  children,
  style,
}) => {
  const height = width * aspect;
  // Was 0.021. Real flagship bezels are ~1.5% of body width; the thick dark
  // border was the single biggest reason this looked like a cheap mockup.
  const bezel = Math.max(3, width * 0.0115);
  const radius = width * 0.125;
  const thickness = width * depth;

  // Which side of the device the camera can see. Under CSS rotateY(t) a point
  // maps x' = x*cos(t) + z*sin(t); the body sits at NEGATIVE z, so for t > 0
  // it shifts left. Verified by rendering, not assumed.
  const seesRight = rotY < 0;

  return (
    <div
      style={{
        perspective,
        transformStyle: "preserve-3d",
        ...style,
      }}
    >
      <div
        style={{
          width,
          height,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateY(${rotY}deg) rotateX(${rotX}deg) rotateZ(${rotZ}deg)`,
        }}
      >
        {/* Screen bloom. A lit display spills light onto whatever is behind
            it; without this the device sits on the colour block like a sticker
            rather than in front of it. */}
        {bloom ? (
          <div
            style={{
              position: "absolute",
              inset: `-${width * 0.1}px`,
              borderRadius: radius * 1.6,
              transform: `translateZ(${-thickness - 3}px)`,
              background: `radial-gradient(ellipse at 50% 45%, rgba(120,190,255,0.22), rgba(120,190,255,0.06) 55%, rgba(0,0,0,0) 72%)`,
              filter: `blur(${width * 0.05}px)`,
            }}
          />
        ) : null}

        {/* Cast shadow, on its own plate BEHIND the extrusion. Put on the front
            face it paints in that face's plane and hides the rail entirely. */}
        {shadow ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: radius,
              transform: `translateZ(${-thickness - 1}px)`,
              boxShadow: `0 ${width * 0.16}px ${width * 0.28}px rgba(0,0,0,0.55),
                          0 ${width * 0.04}px ${width * 0.08}px rgba(0,0,0,0.45)`,
              background: "#05070b",
            }}
          />
        ) : null}

        {/* ---- Extruded body, drawn back-to-front. ---- */}
        {Array.from({ length: SLICES }).map((_, i) => {
          const k = (i + 1) / SLICES; // 0 = deepest, 1 = just behind the face
          const z = -thickness * (1 - k);
          // Brushed metal: brightest just behind the front chamfer, falling
          // away into the body. A flat fill reads as cardboard.
          const lum = 0.50 + 0.78 * Math.pow(k, 1.45);
          const ch = (base: number, m: number) =>
            Math.max(0, Math.min(255, Math.round(base * lum * m)));
          const shade = (m: number) =>
            `rgb(${ch(168, m)}, ${ch(174, m)}, ${ch(196, m)})`;
          // The near rail catches a specular hotspot; the far rail stays dim.
          const grad = seesRight
            ? `linear-gradient(90deg, ${shade(0.42)} 0%, ${shade(0.5)} 55%, ${shade(
                0.95,
              )} 88%, ${shade(1.35)} 100%)`
            : `linear-gradient(90deg, ${shade(1.35)} 0%, ${shade(0.95)} 12%, ${shade(
                0.5,
              )} 45%, ${shade(0.42)} 100%)`;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: radius,
                transform: `translateZ(${z}px)`,
                background: grad,
              }}
            />
          );
        })}

        {/* ---- Front face: a thin black bezel framing the screen. ---- */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            borderRadius: radius,
            background: "#05070c",
            padding: bezel,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: radius - bezel,
              overflow: "hidden",
              background: C.bg,
              position: "relative",
            }}
          >
            {children}

            {/* Punch-hole camera (Galaxy S24), centred at the top of the
                display. This is the cue that reads "phone" instantly. */}
            <div
              style={{
                position: "absolute",
                top: width * 0.028,
                left: "50%",
                marginLeft: -width * 0.019,
                width: width * 0.038,
                height: width * 0.038,
                borderRadius: "50%",
                background: "#010306",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)",
              }}
            />

            {/* Glass: a broad diagonal reflection plus edge darkening, so the
                display sits UNDER glass rather than being a flat fill. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: `linear-gradient(116deg,
                  rgba(255,255,255,0.13) 0%,
                  rgba(255,255,255,0.05) 18%,
                  rgba(255,255,255,0) 38%,
                  rgba(255,255,255,0) 72%,
                  rgba(255,255,255,0.05) 100%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                borderRadius: radius - bezel,
                boxShadow: `inset 0 0 ${width * 0.03}px rgba(0,0,0,0.30)`,
              }}
            />
          </div>

          {/* Chamfer catch-light: the brightest line on the whole object, down
              the front edge of the rail the camera can see. */}
          <div
            style={{
              position: "absolute",
              top: radius * 0.42,
              bottom: radius * 0.42,
              [seesRight ? "right" : "left"]: -Math.max(1, width * 0.0035),
              width: Math.max(1.5, width * 0.007),
              borderRadius: 3,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.85) 18%, rgba(255,255,255,0.45) 55%, rgba(255,255,255,0.10))",
            }}
          />

          {/* Side buttons on the far edge — small, but their absence is part of
              what makes a mockup read as a rectangle rather than a device. */}
          {[0.27, 0.38, 0.45].map((t, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: height * t,
                height: height * (i === 0 ? 0.035 : 0.055),
                width: Math.max(1.5, width * 0.006),
                [seesRight ? "left" : "right"]: -Math.max(1, width * 0.004),
                borderRadius: 2,
                background: "rgba(120,126,148,0.85)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * A UI element lifted OFF the phone screen and floated in front of it.
 *
 * Measured on the reference: the detached element scales only 1.10–1.15x. The
 * float is sold by its own shadow and its own 3D orientation, NOT by scale.
 *
 * NOTE: whatever wraps this must carry its own `translateZ`. Inside a
 * `preserve-3d` parent the browser sorts children by 3D position rather than
 * DOM order, so a Z applied only in here sits in a flattened subtree, counts
 * as 0, and the phone paints straight over it.
 */
export const FloatingCard: React.FC<{
  children: React.ReactNode;
  /** 0 = seated on the screen, 1 = fully lifted toward camera. */
  lift: number;
  rotY?: number;
  rotZ?: number;
  style?: React.CSSProperties;
}> = ({ children, lift, rotY = -8, rotZ = -3, style }) => {
  return (
    <div
      style={{
        transform: `scale(${1 + lift * 0.13}) rotateY(${rotY * lift}deg) rotateZ(${
          rotZ * lift
        }deg)`,
        filter: `drop-shadow(0 ${18 * lift + 4}px ${34 * lift + 8}px rgba(0,0,0,${
          0.28 + lift * 0.34
        }))`,
        transformStyle: "preserve-3d",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
