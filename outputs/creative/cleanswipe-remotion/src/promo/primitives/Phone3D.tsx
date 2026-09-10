import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import {
  Environment,
  Lightformer,
  RoundedBox,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import { staticFile, useCurrentFrame } from "remotion";


/**
 * VARIANT 1 - rounded-rectangle SHAPE GEOMETRY.
 *
 * WHY THE PREVIOUS DEVICE READ AS FAKE.
 * The body was a <RoundedBox>, but the front face, the display and the glass
 * were all flat <planeGeometry> - square rectangles laid over a rounded body.
 * Every one of those layers therefore ended in a hard 90-degree corner that
 * poked past the body's fillet, and because the black face is the highest
 * contrast element in the frame, it is that SQUARE silhouette the eye reads,
 * not the rounded metal behind it. Fixing the material would never have helped:
 * the shape itself was wrong.
 *
 * Here every front layer is generated from one THREE.Shape rounded-rect
 * builder, and each layer's corner radius is the body radius MINUS its own
 * inset, so the face, the display and the glass stay concentric with the body
 * the way real offset curves do. Nothing terminates in a square corner
 * anywhere on the device.
 */

/* ------------------------------------------------------------------ *
 * Rounded-rect geometry
 * ------------------------------------------------------------------ */

/**
 * ShapeGeometry writes the raw shape-space XY into the uv attribute, which for
 * a shape centred on the origin means uvs running roughly -1..1 - the texture
 * would tile and mirror and come out as garbage. The uvs are therefore remapped
 * from the geometry's bounding box, which for a rounded rect is exactly the
 * w x h rect it was cut from, so the screen texture lands undistorted and the
 * rounded corners simply crop the UI the way a real display does.
 */
const roundedRectGeometry = (
  w: number,
  h: number,
  r: number,
  curveSegments = 24,
) => {
  const radius = Math.min(r, Math.min(w, h) / 2);
  const x = w / 2 - radius;
  const y = h / 2 - radius;

  const shape = new THREE.Shape();
  shape.absarc(x, y, radius, 0, Math.PI / 2, false);
  shape.absarc(-x, y, radius, Math.PI / 2, Math.PI, false);
  shape.absarc(-x, -y, radius, Math.PI, Math.PI * 1.5, false);
  shape.absarc(x, -y, radius, Math.PI * 1.5, Math.PI * 2, false);
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape, curveSegments);
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox as THREE.Box3;
  const spanX = bb.max.x - bb.min.x;
  const spanY = bb.max.y - bb.min.y;

  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(
      i,
      (pos.getX(i) - bb.min.x) / spanX,
      (pos.getY(i) - bb.min.y) / spanY,
    );
  }
  uv.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
};

/* ------------------------------------------------------------------ *
 * Proportions - derived FROM the display, never the other way round
 * ------------------------------------------------------------------ */

const PHONE_W = 2.0;
/** Body edge to active display. One number, used on all four sides. */
const BEZEL = 0.062;
const SCREEN_W = PHONE_W - BEZEL * 2;
const SCREEN_H = SCREEN_W * (2340 / 1080); // texture is 1080x2340
const PHONE_H = SCREEN_H + BEZEL * 2;
/** 7.6mm on a 70.6mm-wide S24 body. */
const PHONE_D = PHONE_W * 0.108;

/**
 * In-plane corner radius, ~0.18 of the body width, which is where a Galaxy
 * S24's corners actually sit.
 *
 * drei's RoundedBox clamps its radius to min(w, h, d) / 2, and the depth is
 * only 0.216 - so asking a body-shaped box for a 0.36 radius silently gets you
 * 0.108 and the "sharp corner" complaint back again. The box is therefore
 * authored DEEP (1.2, well past the clamp) and squashed on Z by the mesh's own
 * scale. X and Y are untouched, so the corner radius survives at full size,
 * while the depth fillet flattens into the shallow elliptical chamfer that a
 * real aluminium rail has. One mesh, correct silhouette, correct rail profile.
 */
const CORNER_R = PHONE_W * 0.18;
const BODY_PRE_D = 1.2;
const BODY_SQUASH = PHONE_D / BODY_PRE_D;

/** Hairline of bare metal left visible around the glass, as on the device. */
const RAIL_LIP = 0.013;
const FACE_W = PHONE_W - RAIL_LIP * 2;
const FACE_H = PHONE_H - RAIL_LIP * 2;

const FRONT_Z = PHONE_D / 2;

/* ------------------------------------------------------------------ *
 * The device
 * ------------------------------------------------------------------ */

/**
 * MOTION GRAPHICS INSIDE THE GLASS.
 *
 * A still texture made the display a dead rectangle. Video textures are not an
 * option here: both @remotion/three video hooks are deprecated in 4.0.484 and
 * neither resolves during a render - verified by putting a magenta fallback on
 * a bare full-frame plane with the phone removed entirely, and it stayed
 * magenta. So the UI is rendered to a JPEG SEQUENCE by the ScreenComps
 * compositions and the correct frame is loaded per frame here. drei's
 * useTexture suspends, and @remotion/three's canvas holds the frame open until
 * the load resolves, so every frame gets its own UI state.
 */
const Device: React.FC<{ src: string }> = ({ src }) => {
  const texture = useTexture(src);
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
  }

  // Concentric offset curves: an inset of t reduces the corner radius by t.
  const faceGeo = useMemo(
    () => roundedRectGeometry(FACE_W, FACE_H, CORNER_R - RAIL_LIP, 28),
    [],
  );
  const screenGeo = useMemo(
    () => roundedRectGeometry(SCREEN_W, SCREEN_H, CORNER_R - BEZEL, 28),
    [],
  );
  const glassGeo = useMemo(
    () => roundedRectGeometry(FACE_W, FACE_H, CORNER_R - RAIL_LIP, 28),
    [],
  );

  return (
    <group>
      {/* ---- Aluminium body ------------------------------------------- */}
      <RoundedBox
        args={[PHONE_W, PHONE_H, BODY_PRE_D]}
        radius={CORNER_R}
        smoothness={10}
        scale={[1, 1, BODY_SQUASH]}
      >
        {/* metalness 1 with a low-ish roughness is the whole point: it has no
            colour of its own, it can only show the Lightformer studio, so the
            highlight is forced to TRAVEL down the rail as the body turns. */}
        <meshStandardMaterial
          color="#ccd1db"
          metalness={1}
          roughness={0.2}
          envMapIntensity={2.1}
        />
      </RoundedBox>

      {/* ---- Side buttons (S24 puts both on the right rail) -------------
          They are only about 3px of protrusion at this scale, but a silhouette
          that is a perfectly smooth uninterrupted arc for its whole length is
          one of the things that quietly reads as CG. Their depth of 0.072 keeps
          them inside the rail's flat band (|z| <= 0.04 after the squash), so
          they sit on metal rather than floating off the fillet. */}
      <RoundedBox
        args={[0.024, 0.4, 0.072]}
        radius={0.011}
        smoothness={4}
        position={[PHONE_W / 2 + 0.001, 0.95, 0]}
      >
        <meshStandardMaterial
          color="#bcc2cd"
          metalness={1}
          roughness={0.28}
          envMapIntensity={2}
        />
      </RoundedBox>
      <RoundedBox
        args={[0.024, 0.22, 0.072]}
        radius={0.011}
        smoothness={4}
        position={[PHONE_W / 2 + 0.001, 0.42, 0]}
      >
        <meshStandardMaterial
          color="#bcc2cd"
          metalness={1}
          roughness={0.28}
          envMapIntensity={2}
        />
      </RoundedBox>

      {/* ---- Black front face, following the body's corner radius ------ */}
      <mesh geometry={faceGeo} position={[0, 0, FRONT_Z + 0.0008]}>
        <meshStandardMaterial
          color="#05070c"
          roughness={0.42}
          metalness={0.15}
          envMapIntensity={0.55}
        />
      </mesh>

      {/* ---- Display ---------------------------------------------------
          Unlit, so the UI keeps its real colours rather than being shaded by
          the studio, and toneMapped off so ACES does not wash it out. */}
      <mesh geometry={screenGeo} position={[0, 0, FRONT_Z + 0.0018]}>
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#0f172a" toneMapped={false} />
        )}
      </mesh>

      {/* ---- Cover glass -----------------------------------------------
          A pure-black dielectric on ADDITIVE blend: the diffuse term is zero,
          so the only thing this layer can contribute is its specular env
          reflection, added on top of the UI exactly the way real glass adds one.

          OPACITY IS THE MASTER GAIN - AND IT HAD TO BE FOUND BY BISECTION.
          Sampling one row of UI background across the display gave a flat 17
          with this layer hidden and 19 rising to 99 with it shown, so the veil
          was unambiguously the glass. The obvious dial did not control it:
          cutting envMapIntensity 5x (0.3 -> 0.06) moved the peak only 99 -> 90,
          and zeroing the ambient light changed it by nothing at all. Whatever
          three is doing inside the physical model here, the reflected term is
          largely deaf to both. `opacity` is not, because additive blending
          multiplies the whole fragment by src alpha before adding it - one
          honest gain on the entire layer, no matter which term produced it. At
          0.17 the sweep lands about a dozen levels above black, which is what a
          real sheet of glass in a lit room does; at the values that came before
          it, the bezel and the display flattened into one identical grey and
          the display stopped reading as a display at all.

          With the gain doing the limiting, envMapIntensity is free to stay high
          (1.3) so the SHAPE of the sheen still comes from the studio and still
          slides as the device turns. roughness 0.16 pulls a blurrier mip out of
          the PMREM so the band has soft edges instead of the softbox's own hard
          rectangle, and Fresnel opens it up towards the silhouette where a real
          sheet flares. */}
      <mesh geometry={glassGeo} position={[0, 0, FRONT_Z + 0.003]}>
        <meshPhysicalMaterial
          color="#000000"
          roughness={0.16}
          metalness={0}
          reflectivity={0.5}
          clearcoat={0.45}
          clearcoatRoughness={0.12}
          envMapIntensity={1.3}
          opacity={0.17}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* ---- Centred punch-hole camera (Galaxy S24, not an iPhone island;
              the app ships on Google Play only, so a notch would be a lie) -- */}
      <group position={[0, SCREEN_H / 2 - 0.11, FRONT_Z + 0.0042]}>
        <mesh>
          <circleGeometry args={[0.036, 48]} />
          <meshBasicMaterial color="#010206" toneMapped={false} />
        </mesh>
        {/* Metal lens rim - small enough to be a detail, shiny enough that it
            picks up its own travelling glint and sells the hole as a hole. */}
        <mesh position={[0, 0, 0.0006]}>
          <ringGeometry args={[0.0295, 0.0365, 48]} />
          <meshStandardMaterial
            color="#3b4356"
            metalness={1}
            roughness={0.12}
            envMapIntensity={2}
          />
        </mesh>
      </group>
    </group>
  );
};

/* ------------------------------------------------------------------ *
 * Canvas
 * ------------------------------------------------------------------ */

/**
 * At distance 9.2 with fov 32 the visible height at z=0 is
 *   2 * 9.2 * tan(16deg) = 5.2746 world units,
 * so the 2.0-wide body covers 2.0 / 5.2746 = 0.3792 of the canvas HEIGHT.
 * Inverting that lets callers keep asking for a phone of N pixels wide.
 */
const CANVAS_H_PER_PHONE_W = 1 / (PHONE_W / (2 * 9.2 * Math.tan((16 * Math.PI) / 180)));

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * The film's device. Selected from a four-way look-dev (see src/promo/lookdev/)
 * after two CSS attempts and one flawed three.js attempt were rejected.
 *
 * THE ROOT CAUSE THE LOOK-DEV FOUND, which no amount of tweaking would have
 * fixed: drei's <RoundedBox radius={r}> CLAMPS r to half the smallest
 * dimension. On a phone-thin box that is half the 0.19 depth, so the corner
 * radius silently became 0.095 - under 5% of body width - however large a
 * radius was requested. The body could never be rounded correctly that way.
 * Two independent look-dev agents converged on this. Every front layer is now
 * cut from the same rounded profile, so no flat rectangle is ever laid over a
 * rounded body.
 */
type ScreenSeq = {
  /** Directory under public/, e.g. "seq/swipe". */
  dir: string;
  /** How many frames exist in that directory. */
  frames: number;
  /** Zero-padding width Remotion used for the filenames. */
  pad: number;
  /** Frame within the SCENE at which this sequence starts playing. */
  startAt?: number;
};

type Phone3DProps = {
  /** Desired on-screen width of the device in px. */
  phoneWidth: number;
  /** Single still under public/, e.g. "screens/swipe-0.png". */
  screen?: string;
  /** Animated UI: a frame-indexed JPEG sequence. Takes precedence over `screen`. */
  seq?: ScreenSeq;
  /** Degrees, converted to radians internally. */
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  /** Camera distance in world units. Lower = stronger perspective. */
  distance?: number;
  /** Extra scale applied to the whole rig, for push-ins. */
  zoom?: number;
};

export const Phone3D: React.FC<Phone3DProps> = ({
  phoneWidth,
  screen,
  seq,
  rotY = 0,
  rotX = 0,
  rotZ = 0,
}) => {
  const frame = useCurrentFrame();
  const height = Math.round(phoneWidth * CANVAS_H_PER_PHONE_W);
  const width = Math.round(height * 0.62);

  // Resolve which UI frame to show. Clamped at both ends so a scene longer than
  // its sequence holds the last frame rather than failing to load a file.
  const src = seq
    ? staticFile(
        `${seq.dir}/element-${String(
          Math.max(0, Math.min(seq.frames - 1, frame - (seq.startAt ?? 0))),
        ).padStart(seq.pad, "0")}.jpeg`,
      )
    : staticFile(screen ?? "screens/swipe-0.png");

  return (
    <ThreeCanvas
      width={width}
      height={height}
      // Supersample. The whole variant lives or dies on its corner arcs and on
      // 8px UI text seen at an angle; at dpr 1 both alias into mush.
      dpr={2}
      camera={{ position: [0, 0, 9.2], fov: 36 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      {/* NO DIRECTIONAL LIGHTS - measured, not assumed. Sampling one row of the
          UI background across the display gave 17,24,39 flat with the glass
          hidden and 19..99 with it shown, so the veil was the glass; deleting
          both directionalLights moved that row by a single level, which is what
          established they were doing nothing worth keeping. Pure IBL is also
          the more honest studio - a real product shot is lit by panels, and
          here the panels ARE the <Environment>. Ambient survives only because a
          black-diffuse material takes nothing from it. */}
      <ambientLight intensity={0.25} />

      {/* Procedural studio. A metal surface has no colour of its own - it can
          only show what is around it - so this rig IS the material.

          THE RIG IS AIMED BY DIRECTION, NOT BY POSITION. <Environment> bakes
          these panels into a cubemap seen from the origin, so a reflective
          surface samples them purely by DIRECTION - where a panel sits along
          that direction is irrelevant. That is worth stating because it is what
          two earlier passes got wrong.

          Work out where the rails actually look. For a side rail at yaw t the
          reflection vector is (-sin 2t, 0, -cos 2t): 15 degrees off straight
          BACKWARDS at 7.7 degrees of yaw, opening to 32 degrees at 16. Panels
          parked out on the flanks at x = +-5, z = -3 sit 43 degrees away from
          that cone and the rails rendered black however hot the panels were
          turned up - which is exactly what happened on the near-face-on frames.
          The hot panels below are therefore placed ON the cone, at roughly
          +-24 degrees either side of straight back, narrow enough that the yaw
          sweep carries the highlight through them.

          The wide dim backdrop underneath them is the other half of the fix: it
          gives the rails and the top edge a base tone at every angle, so metal
          never goes dead, while the narrow hot panels supply the flare that
          travels on top of it. */}
      <Environment resolution={512}>
        {/* THE GLASS PAIR. A flat front face reflects the front hemisphere
            about its own normal, so at 12 degrees of yaw the display is looking
            at roughly (0.42, -0.10, 0.90) - front-RIGHT. The first rig had the
            dark negative card sitting exactly there and the glass came out with
            no reflection whatsoever, which is what made the display read as a
            pasted screenshot. These two soft panels flank that sweep instead,
            with darkness between them, so the sheen slides across the UI and
            off again as the device turns rather than sitting still. */}
        <Lightformer
          form="rect"
          intensity={1.9}
          position={[4, 3, 5]}
          scale={[3.5, 9, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={1.3}
          position={[-4.5, 3.5, 4.5]}
          scale={[3.5, 9, 1]}
          color="#eef4ff"
        />
        {/* base backdrop: a big dim scrim filling the back hemisphere, which
            the rails and the top edge sample at every yaw. Without it the metal
            drops to black the moment the yaw carries it off a hot panel. */}
        <Lightformer
          form="rect"
          intensity={1.2}
          position={[0, 0, -7]}
          scale={[18, 18, 1]}
          color="#9db2cc"
        />
        {/* FLANK SCRIMS, dead abeam. The rail is not one flat facet - it is a
            fillet, and its normals sweep from side-on to front-on across the
            few pixels of it that are visible. The middle of that sweep, the 45
            degree part, reflects straight SIDEWAYS: mirror (-0.71, 0, 0.71)
            about the view axis and you get (-1, 0, 0). Nothing in the rig stood
            there, which is why the rail still read as a dim grey line on the
            near-face-on frames even after the back panels were aimed correctly.
            These are the panels the rail's core actually shows. */}
        <Lightformer
          form="rect"
          intensity={8}
          position={[-6.5, 0.5, 0.5]}
          scale={[1.5, 10, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={8}
          position={[6.5, 0.5, 0.5]}
          scale={[1.5, 10, 1]}
          color="#ffffff"
        />
        {/* the travelling flares - sitting ON the rails' reflection cone, at
            about 24 degrees either side of straight back, and narrow (~11
            degrees) so the yaw sweep carries the rail through them. */}
        <Lightformer
          form="rect"
          intensity={13}
          position={[-2.4, 1.4, -5.4]}
          scale={[1.5, 8, 1]}
          color="#f4f8ff"
        />
        <Lightformer
          form="rect"
          intensity={13}
          position={[2.4, 1.4, -5.4]}
          scale={[1.5, 8, 1]}
          color="#f4f8ff"
        />
        {/* cool overhead sweep. The top rail at 3 degrees of pitch reflects
            (0, 0.10, -0.99) - almost straight back and barely up - so this is
            pulled well behind the device to land on it. */}
        <Lightformer
          form="rect"
          intensity={4}
          position={[0, 6, -2]}
          scale={[10, 3, 1]}
          color="#dceaff"
        />
        {/* GREEN BOUNCE from below. The device is shot against the brand green,
            and in a real studio that plate throws colour back up onto the
            underside of the rails. Leaving it out is a small thing that makes a
            render look composited rather than photographed: perfectly neutral
            metal against a saturated field never happens. Kept low so it tints
            the bottom edge rather than colouring the device. */}
        <Lightformer
          form="rect"
          intensity={0.5}
          position={[0, -7, 0]}
          scale={[14, 14, 1]}
          color="#1f9c67"
        />
        {/* warm low kicker, keeps the bottom rail from going dead */}
        <Lightformer
          form="rect"
          intensity={3}
          position={[1, -6, 1]}
          scale={[8, 2, 1]}
          color="#ffd9ad"
        />
        {/* negative fill: a dark card dead ahead and low, in the gap between
            the two glass panels. Metal and glass both need somewhere DARK to
            reflect, or every surface lifts to the same grey and the form
            disappears - and without this gap the sheen would be a permanent
            wash instead of a band with edges that can travel. */}
        <Lightformer
          form="rect"
          intensity={0.03}
          position={[0, -2.5, 6]}
          scale={[5, 7, 1]}
          color="#08101c"
        />
      </Environment>

      <group rotation={[rad(rotX), rad(rotY), rad(rotZ)]}>
        <Device src={src} />
      </group>
    </ThreeCanvas>
  );
};
