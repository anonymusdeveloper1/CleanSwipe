import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { Environment, Lightformer, useTexture } from "@react-three/drei";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { staticFile } from "remotion";
import { PhoneVariantProps } from "./contract";

/**
 * VARIANT 3 - one extruded solid, no stacked planes.
 *
 * WHY THE PREVIOUS BODY READ AS SHARP AND FAKE
 * The old device was a drei <RoundedBox> with three flat <planeGeometry>
 * rectangles laid on its front. Two separate faults, both visible as "sharp
 * corners":
 *
 *  1. Every front layer - the black face, the display, the glass - was a plain
 *     rectangle. Whatever the body did, the SILHOUETTE the eye traces at the
 *     corner was a hard 90 degree plane corner sitting on top of it.
 *  2. <RoundedBox radius={0.2}> never rendered a 0.2 radius. RoundedBox clamps
 *     the radius to half the SMALLEST dimension, and the smallest dimension is
 *     the 0.19 thickness - so the corners actually came out at 0.095, under 5%
 *     of the body width. A real S24 corner is about 15%.
 *
 * Extruding fixes both at once. The corner radius lives in the 2D profile, so
 * it is no longer hostage to the thickness, and every front element is cut from
 * that same profile, so nothing square is ever laid over something round.
 *
 * WHY CIRCULAR ARC CORNERS AND NOT A SQUIRCLE
 * A squircle is arguably closer to the real industrial design, but an
 * arc-cornered rounded rectangle has a property the brief needs: its exact
 * parallel offset is the same rectangle with the radius reduced by the offset.
 * So insetting the outline by CHAMFER and then by BEZEL gives a bezel that is
 * provably the same width on all four sides and around the corners. A
 * superellipse does not offset uniformly - you would have to fudge it, and a
 * fudged bezel is what makes a mockup look pasted together.
 */

/* -------------------------------------------------------------------------- */
/* Proportions. Everything is derived FROM the display outwards.               */
/* -------------------------------------------------------------------------- */

/** The screen PNG is 1080x2340. This ratio is the only thing that may not bend. */
const SCREEN_ASPECT = 2340 / 1080;

const SCREEN_W = 1.856;
const SCREEN_H = SCREEN_W * SCREEN_ASPECT; // 4.0213
/** One uniform black band, identical on all four sides. */
const BEZEL = 0.046;
/** The machined 45 degree edge break between the glass plane and the rail. */
const CHAMFER = 0.026;

const FRONT_W = SCREEN_W + BEZEL * 2;
const FRONT_H = SCREEN_H + BEZEL * 2;
const PHONE_W = FRONT_W + CHAMFER * 2; // 2.000
const PHONE_H = FRONT_H + CHAMFER * 2; // 4.165  -> 2.083:1, an S24 is 2.082:1
const PHONE_D = 0.21; // 7.6mm at this scale

/** ~15% of the body width, which is where a modern Android body actually sits. */
const BODY_R = 0.3;
const FRONT_R = BODY_R - CHAMFER;
const SCREEN_R = FRONT_R - BEZEL;

/** The front plane of the solid, i.e. the glass surface. */
const FRONT_Z = PHONE_D / 2;

/* -------------------------------------------------------------------------- */
/* Shape helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Rounded rectangle centred on the origin, built from four true circular arcs. */
const roundedRect = (w: number, h: number, r: number): THREE.Shape => {
  const x = w / 2;
  const y = h / 2;
  const rr = Math.min(r, Math.min(x, y));
  const s = new THREE.Shape();
  s.moveTo(-x + rr, -y);
  s.lineTo(x - rr, -y);
  s.absarc(x - rr, -y + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(x, y - rr);
  s.absarc(x - rr, y - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(-x + rr, y);
  s.absarc(-x + rr, y - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(-x, -y + rr);
  s.absarc(-x + rr, -y + rr, rr, Math.PI, Math.PI * 1.5, false);
  s.closePath();
  return s;
};

/**
 * Smooth the corner facets, keep the chamfer crisp.
 *
 * ExtrudeGeometry is non-indexed, so its own computeVertexNormals() gives every
 * triangle a flat normal - which means the rounded corners of the rail shade as
 * a fan of visible facets, exactly the artefact we are trying to get rid of.
 * toCreasedNormals welds the seams and re-shades below the crease angle, so the
 * corner sweep goes smooth while the two 45 degree chamfer breaks stay hard,
 * which is what puts a defined bright line along the rim.
 *
 * The scale-up is not cosmetic: toCreasedNormals quantises positions to 0.01
 * world units to find shared vertices, and this phone is only 2 units wide, so
 * at 1:1 the weld would start merging genuinely distinct rim vertices. Weld at
 * 10x, then scale the result back.
 */
const creased = (geo: THREE.BufferGeometry, deg: number): THREE.BufferGeometry => {
  geo.scale(10, 10, 10);
  const out = toCreasedNormals(geo, (deg * Math.PI) / 180);
  out.scale(0.1, 0.1, 0.1);
  return out;
};

/**
 * ShapeGeometry's UV generator writes raw world XY into the uv attribute, so a
 * texture would be tiled at 1 unit per repeat. Renormalise against the bounding
 * box: the 1080x2340 PNG then lands on the 1080x2340-proportioned outline
 * one-to-one, with no stretch in either axis.
 */
const withNormalisedUv = (geo: THREE.BufferGeometry): THREE.BufferGeometry => {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  if (!bb || !uv) {
    return geo;
  }
  const w = bb.max.x - bb.min.x;
  const h = bb.max.y - bb.min.y;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / w, (pos.getY(i) - bb.min.y) / h);
  }
  uv.needsUpdate = true;
  return geo;
};

/* -------------------------------------------------------------------------- */
/* The device                                                                 */
/* -------------------------------------------------------------------------- */

const Device: React.FC<{ src: string; rotX: number; rotY: number; rotZ: number }> = ({
  src,
  rotX,
  rotY,
  rotZ,
}) => {
  const texture = useTexture(src);

  const screenMap = useMemo(() => {
    if (!texture) {
      return null;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    texture.needsUpdate = true;
    return texture;
  }, [texture]);

  /**
   * THE WHOLE BODY IS ONE EXTRUSION.
   * bevelSegments={1} is deliberate: a single flat 45 degree facet is what a
   * CNC edge break actually is, and one flat facet returns one clean unbroken
   * highlight line as the device turns. A multi-segment rounded bevel smears
   * that into a soft gradient and the machined read is lost.
   */
  const body = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(roundedRect(PHONE_W, PHONE_H, BODY_R), {
      depth: PHONE_D - CHAMFER * 2,
      bevelEnabled: true,
      bevelThickness: CHAMFER,
      bevelSize: CHAMFER,
      bevelOffset: 0,
      bevelSegments: 1,
      curveSegments: 28,
      steps: 1,
    });
    geo.translate(0, 0, -(PHONE_D - CHAMFER * 2) / 2);
    return creased(geo, 25);
  }, []);

  /** The glass sheet: the front plane of the solid, inset by exactly the chamfer. */
  const glass = useMemo(
    () => new THREE.ShapeGeometry(roundedRect(FRONT_W, FRONT_H, FRONT_R), 28),
    [],
  );

  /** The display, inset from the glass by one uniform bezel. */
  const screen = useMemo(
    () =>
      withNormalisedUv(
        new THREE.ShapeGeometry(roundedRect(SCREEN_W, SCREEN_H, SCREEN_R), 28),
      ),
    [],
  );

  /**
   * The hairline where the glass edge meets the metal. On any photograph of a
   * phone this catches the room and draws a bright thread all the way round the
   * front - without it the black face dies into the rail and the front reads as
   * a printed panel rather than a sheet of glass sitting in a frame.
   */
  const hairline = useMemo(() => {
    const t = 0.009;
    const s = roundedRect(FRONT_W, FRONT_H, FRONT_R);
    s.holes.push(roundedRect(FRONT_W - t * 2, FRONT_H - t * 2, FRONT_R - t));
    return new THREE.ShapeGeometry(s, 28);
  }, []);

  /**
   * Side buttons, extruded the same way so they carry the same edge break.
   * They protrude 0.021 units, which is 0.75mm at this scale - about what a
   * real key stands proud by. Small, but it is the detail that breaks the
   * silhouette into something machined instead of a smooth extruded blank.
   */
  const button = useMemo(() => {
    const make = (len: number) => {
      const geo = new THREE.ExtrudeGeometry(roundedRect(0.066, len, 0.022), {
        depth: 0.026,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.005,
        bevelOffset: 0,
        bevelSegments: 1,
        curveSegments: 12,
        steps: 1,
      });
      return creased(geo, 25);
    };
    return { volume: make(0.44), power: make(0.27) };
  }, []);

  const metal = (
    <meshStandardMaterial
      color="#c8ccd6"
      metalness={1}
      roughness={0.17}
      envMapIntensity={1.4}
    />
  );

  return (
    <group rotation={[rotX, rotY, rotZ]}>
      {/* Aluminium unibody: one solid, chamfered, no plane stack anywhere. */}
      <mesh geometry={body}>{metal}</mesh>

      {/* Right rail: volume rocker above, power below - Galaxy layout. */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={button.volume} position={[0, 0.8, PHONE_W / 2 - 0.01]}>
          {metal}
        </mesh>
        <mesh geometry={button.power} position={[0, 0.31, PHONE_W / 2 - 0.01]}>
          {metal}
        </mesh>
      </group>

      {/* THE GLASS. Not a transparent plane floating over the body - it IS the
          front surface, cut from the same profile as the body and inset by the
          chamfer, so its corners are the body's corners minus the edge break.
          Opaque and near-mirror-smooth: the black is the display panel under it
          and the clearcoat is the sheet on top, which is how a real front face
          behaves. No transparency means no sorting to go wrong either. */}
      <mesh geometry={glass} position={[0, 0, FRONT_Z + 0.0012]}>
        <meshPhysicalMaterial
          color="#04060b"
          metalness={0}
          roughness={0.08}
          clearcoat={1}
          clearcoatRoughness={0.03}
          reflectivity={0.6}
          envMapIntensity={1}
        />
      </mesh>

      <mesh geometry={hairline} position={[0, 0, FRONT_Z + 0.0022]}>
        <meshStandardMaterial
          color="#aeb7c8"
          metalness={1}
          roughness={0.1}
          envMapIntensity={2}
        />
      </mesh>

      {/* The display. Emissive so the UI keeps its own colours, but still a
          standard material so the surface picks up a Fresnel sheen from the
          studio as it turns - an unlit basic material cannot do that and is
          what makes a screen look like a sticker. */}
      <mesh geometry={screen} position={[0, 0, FRONT_Z + 0.0032]}>
        <meshPhysicalMaterial
          color="#000000"
          emissive="#ffffff"
          emissiveMap={screenMap}
          emissiveIntensity={1}
          map={screenMap}
          metalness={0}
          roughness={0.5}
          clearcoat={1}
          clearcoatRoughness={0.05}
          envMapIntensity={2.2}
          toneMapped={false}
        />
      </mesh>

      {/* Punch-hole camera, dead centre. SwipeClean is Google Play only, so an
          iPhone notch or Dynamic Island would be factually the wrong device. */}
      <group position={[0, SCREEN_H / 2 - 0.14, FRONT_Z + 0.0042]}>
        <mesh>
          <circleGeometry args={[0.049, 48]} />
          <meshStandardMaterial color="#0a0c12" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.0006]}>
          <circleGeometry args={[0.037, 48]} />
          <meshPhysicalMaterial
            color="#01030a"
            metalness={0.2}
            roughness={0.06}
            clearcoat={1}
            clearcoatRoughness={0.02}
          />
        </mesh>
      </group>
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/* Canvas                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * At distance 9.2 with fov 32 the visible height at z=0 is
 * 2 * 9.2 * tan(16deg) = 5.2762 units, and the body is 2.0 wide, so the device
 * covers 0.37906 of the canvas height. Inverting that lets callers keep asking
 * for a phone width in pixels. Kept identical to the other look-dev variants so
 * the only thing that differs between them is the device itself.
 */
const CANVAS_H_PER_PHONE_W = 1 / 0.37906;

export const PhoneVariant3: React.FC<PhoneVariantProps> = ({
  phoneWidth,
  screen,
  rotX = 0,
  rotY = 0,
  rotZ = 0,
}) => {
  const height = Math.round(phoneWidth * CANVAS_H_PER_PHONE_W);
  const width = Math.round(height * 0.62);
  const rad = (d: number) => (d * Math.PI) / 180;

  return (
    <ThreeCanvas
      width={width}
      height={height}
      // near/far pulled tight around the subject: the front stack is separated
      // by thousandths of a unit and the default near of 0.1 does not have the
      // depth precision to keep the display in front of the glass.
      camera={{ position: [0, 0, 9.2], fov: 32, near: 4, far: 20 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.28} />
      <directionalLight position={[4, 6, 7]} intensity={1.5} />
      <directionalLight position={[-6, -1, 5]} intensity={0.7} color="#bcd8ff" />

      {/*
        THE STUDIO IS THE MATERIAL. A metalness=1 surface has no diffuse term at
        all - it is nothing but a reflection of its surroundings, so with no
        environment it renders near black. These panels are a small softbox rig
        baked to a cubemap once, and because the map is fixed in world space
        while the phone turns, the reflection of each panel SLIDES along the
        chamfer. That travelling highlight is the entire reason for doing this
        in 3D rather than painting a gradient.

        The dark gaps between the panels matter as much as the panels. An evenly
        lit environment makes metal read as flat grey plastic; metal only looks
        like metal when it has something black to reflect as well.
      */}
      <Environment resolution={512}>
        {/* THE ROOM. The first pass had none of this and the rails came out
            black: a flat rail reflects one fixed direction, and if nothing is
            sitting in that direction there is literally nothing to see. This
            dim wall is the studio cyc - it gives every face a base grey to sit
            on, which is what stops the body reading as black plastic. */}
        <Lightformer
          form="rect"
          intensity={0.42}
          position={[0, 0, 12]}
          scale={[34, 34, 1]}
          color="#dde6f2"
        />
        {/* Ceiling and floor, pulled BACK in z rather than centred overhead.
            The top and bottom chamfers reflect almost straight up and straight
            down and slightly rearwards; with nothing there those two edges
            rendered as a hard black outline, which is most of what made the
            body look like a moulded case rather than a milled one. */}
        <Lightformer
          form="rect"
          intensity={2.8}
          position={[0, 11, -3]}
          scale={[18, 7, 1]}
          color="#fff4e6"
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          position={[0, -11, -3]}
          scale={[15, 6, 1]}
          color="#93a8c6"
        />
        {/* THE RAILS. Two separate strips per side with a deliberate dark gap
            between them, rather than one tall panel. A single panel washed the
            whole rail to a flat blown-out white bar - a painted stripe, not
            metal. Broken into sources, the rail carries bright bands and dark
            bands along its length, and those bands slide as the device turns. */}
        <Lightformer
          form="rect"
          intensity={10}
          position={[-8, 4.2, 3]}
          scale={[1.4, 7, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[-8.5, -3.6, 1.5]}
          scale={[2.4, 5.5, 1]}
          color="#cfe0ff"
        />
        <Lightformer
          form="rect"
          intensity={15}
          position={[7.6, 1.4, 4]}
          scale={[0.65, 9, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={3.2}
          position={[8.2, -4.2, 1.5]}
          scale={[2, 5, 1]}
          color="#dbe8ff"
        />
        {/* Broad soft key from front left - the wash across the glass. */}
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[-6, 4, 7]}
          scale={[6, 9, 1]}
          color="#ffffff"
        />
        {/* Warm accent so the metal is not a dead neutral grey. */}
        <Lightformer
          form="ring"
          intensity={5}
          position={[3.6, 3, 8]}
          scale={2.2}
          color="#ffd29a"
        />
        {/* Rear quarter panels. Whichever rail is turned AWAY from camera
            reflects back-and-outboard, and with nothing there the far edge
            rendered as a hard black outline - the one thing that still read as
            a cut-out rather than a photographed object. */}
        <Lightformer
          form="rect"
          intensity={2.2}
          position={[10, 0, -5]}
          scale={[7, 14, 1]}
          color="#b9c9e2"
        />
        <Lightformer
          form="rect"
          intensity={2.2}
          position={[-10, 0, -5]}
          scale={[7, 14, 1]}
          color="#b9c9e2"
        />
        {/* Cool rim from behind: separates the far edge from the background. */}
        <Lightformer
          form="rect"
          intensity={3}
          position={[-2, 0.5, -9]}
          scale={[12, 12, 1]}
          color="#6fa4ff"
        />
      </Environment>

      <Device
        src={staticFile(screen)}
        rotX={rad(rotX)}
        rotY={rad(rotY)}
        rotZ={rad(rotZ)}
      />
    </ThreeCanvas>
  );
};
