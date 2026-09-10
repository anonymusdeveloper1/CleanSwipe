import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { Environment, Lightformer, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { staticFile } from "remotion";
import { PhoneVariantProps } from "./contract";

/* ===========================================================================
 * VARIANT 2 - ALPHA-MASKED ROUNDED CORNERS
 * ===========================================================================
 *
 * The brief: keep the front stack as flat planes and round their corners by
 * making the corners TRANSPARENT, using a procedurally drawn rounded-rect
 * alpha mask. No corner geometry.
 *
 * WHAT WAS ACTUALLY WRONG WITH Phone3D.tsx - there were TWO bugs, and only
 * fixing the obvious one would still have shipped sharp corners:
 *
 *   1. (the reported bug) the front face, the screen and the glass are
 *      <planeGeometry> - square rectangles laid over a rounded body. Their
 *      square silhouette is drawn on top of the rounded one, so the device
 *      reads as a screenshot on a card. Fixed here by the alpha mask.
 *
 *   2. (the hidden bug, and the bigger one) the BODY was not actually rounded
 *      either. drei's <RoundedBox> builds an ExtrudeGeometry with
 *      `depth: depth - radius * 2` and `bevelSize/bevelThickness = radius`,
 *      so the XY corner radius and the Z edge fillet are THE SAME NUMBER.
 *      Phone3D asked for radius 0.2 on a body only 0.19 deep, which makes the
 *      extrusion depth NEGATIVE (0.19 - 0.4 = -0.21): the front and back
 *      bevels pass through each other and the "flat front face" collapses.
 *      A phone-thin box can never get a phone-sized corner radius out of
 *      <RoundedBox>, because a 10.6mm corner would force a 21mm-thick body.
 *
 * So the body here is one ExtrudeGeometry authored directly, which decouples
 * the two: a big XY corner radius (BODY_R, ~10.6mm at S24 scale) and a small
 * separate bevel (RAIL, ~1.3mm) for the chamfered edge of the rail. That
 * bevel is the thing the specular highlight runs along as the device turns -
 * it is a narrow curved band, so a small rotation sweeps the reflected
 * lightformer a long way across it. Still ONE body mesh, same as before.
 * ========================================================================= */

/* ---------------------------------------------------------------------------
 * DIMENSIONS - derived FROM the screen outwards, never the reverse.
 *
 * BEZEL is the single number that separates the display edge from the body
 * edge, and it is applied identically on all four sides, so the frame is
 * uniform by construction. The screen keeps the texture's exact 1080x2340
 * aspect; the body height falls out of it.
 *
 * BEZEL is itself made of three visible bands, outside in:
 *   RAIL - the chamfer of the metal rail, the bright rim you see head-on
 *   LIP  - a hairline of flat metal cap between the rail and the glass
 *   INK  - the black mask printed under the glass: the "bezel" proper
 * ------------------------------------------------------------------------ */
const RAIL = 0.038;
const LIP = 0.006;
const INK = 0.03;
const BEZEL = RAIL + LIP + INK; // 0.074

const SCREEN_W = 1.852;
const SCREEN_H = SCREEN_W * (2340 / 1080); // 4.0127 - undistorted, by definition
const PHONE_W = SCREEN_W + BEZEL * 2; // 2.0000
const PHONE_H = SCREEN_H + BEZEL * 2; // 4.1607
const PHONE_D = 0.212; // 7.5mm at this scale; S24 is 7.6mm

/**
 * Outer corner radius. 0.30 here = 10.6mm on a 70.6mm-wide body, which is a
 * Galaxy S24. This is the number <RoundedBox> could not give us.
 */
const BODY_R = 0.3;

/** z of the flat front face of the body, after ExtrudeGeometry.center(). */
const FRONT_Z = PHONE_D / 2;

/* The three concentric front rects. Each radius is the body radius minus that
 * layer's inset, which is what keeps the metal rim and the black bezel an even
 * width all the way around INCLUDING through the corners - the giveaway detail
 * that a masked corner is the right radius rather than merely round. */
const CAP_W = PHONE_W - RAIL * 2; // flat area of the body's front face
const CAP_H = PHONE_H - RAIL * 2;
const CAP_R = BODY_R - RAIL;

const GLASS_INSET = RAIL + LIP;
const GLASS_W = PHONE_W - GLASS_INSET * 2;
const GLASS_H = PHONE_H - GLASS_INSET * 2;
const GLASS_R = BODY_R - GLASS_INSET;

const SCREEN_R = BODY_R - BEZEL;

/* S24 punch-hole camera: centred in the status bar, not an iPhone notch or
 * island. Measured against the 1080x2340 texture - ~58px across, centred
 * ~66px below the top of the display, which is exactly the gap the app's own
 * status bar leaves between the clock and the battery. */
const HOLE_R = (29 / 1080) * SCREEN_W;
const HOLE_Y = SCREEN_H * (0.5 - 66 / 2340);

/* ---------------------------------------------------------------------------
 * THE MASK ITSELF
 *
 * A rounded rect drawn white-on-black into a 2D canvas and handed to three as
 * an alphaMap. three samples the GREEN channel of an alphaMap, so a plain
 * greyscale fill is all that is needed, and the texture must stay in linear
 * space (NoColorSpace) or the sRGB decode would bend the mask's antialiased
 * edge and fatten the corners.
 *
 * The canvas is drawn at the plane's own aspect ratio so one radius in canvas
 * pixels maps to one radius in world units on both axes - a square mask
 * stretched onto a 1:2.2 plane would give elliptical corners.
 * ------------------------------------------------------------------------ */
type RoundRectCtx = CanvasRenderingContext2D & {
  roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
};

const traceRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  const withRoundRect = ctx as RoundRectCtx;
  if (typeof withRoundRect.roundRect === "function") {
    withRoundRect.roundRect(x, y, w, h, r);
    return;
  }
  // Chrome has had roundRect since 99 and the render browser is newer than
  // that, but a headless render that silently drew a square mask would be the
  // exact bug this variant exists to fix, so it is worth six lines of arcTo.
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const makeCornerMask = (aspect: number, radiusFrac: number, px = 1024) => {
  const w = px;
  const h = Math.max(2, Math.round(px * aspect));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  traceRoundRect(ctx, 0, 0, w, h, Math.min(radiusFrac * w, Math.min(w, h) / 2));
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

/**
 * A hint of a lens inside the punch hole, and - more usefully - a soft alpha
 * falloff at its rim, so the hole is antialiased by its own texture instead of
 * showing a polygonal circleGeometry edge.
 */
const makeLensTexture = (px = 256) => {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const c = px / 2;
  const g = ctx.createRadialGradient(c * 0.84, c * 0.8, 1, c, c, c);
  g.addColorStop(0, "#0a1420");
  g.addColorStop(0.4, "#010308");
  g.addColorStop(0.8, "#000103");
  g.addColorStop(0.91, "#26476f");
  g.addColorStop(1, "#0c1a2c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

/**
 * Micro-variation for the metal.
 *
 * A perfectly uniform roughness is a reliable tell of a CG render: real
 * anodised metal has a faint mottle, so its highlight has texture in it rather
 * than being a clean airbrushed gradient. Deterministic value noise (a fixed
 * sin-hash, no Math.random - Remotion forbids it) drawn small and scaled up
 * with canvas smoothing gives soft blobs rather than grain.
 *
 * Kept VERY low contrast and low frequency on purpose. The first pass used
 * 24 cells over a 3x6 repeat and it read as salt-and-pepper sensor noise along
 * the rail: the rail is only about three pixels tall on screen, so anything
 * with real contrast in it aliases into speckle instead of resolving into
 * mottle. At this amplitude it only breaks the highlight's perfect evenness,
 * which is all it is there to do.
 */
const makeRoughnessMap = (cells = 10, px = 256) => {
  const small = document.createElement("canvas");
  small.width = cells;
  small.height = cells;
  const sctx = small.getContext("2d") as CanvasRenderingContext2D;
  const img = sctx.createImageData(cells, cells);
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      const n = s - Math.floor(s);
      const v = Math.round(238 + n * 17);
      const i = (y * cells + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  sctx.putImageData(img, 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, px, px);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

/**
 * The body: one rounded-rect shape, extruded, with a small bevel for the rail
 * chamfer. toCreasedNormals welds and smooths across the corner arcs while
 * keeping the front/back faces crisply flat - ExtrudeGeometry alone is
 * non-indexed and therefore flat-shaded, which would band the corners into
 * visible facets exactly where the eye looks for roundness.
 */
const buildBody = () => {
  const w = CAP_W;
  const h = CAP_H;
  const r = CAP_R;
  const x = -w / 2;
  const y = -h / 2;

  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);

  const geo = new THREE.ExtrudeGeometry(shape, {
    // ExtrudeGeometry's bevel EXPANDS the outline outward from the cap by
    // bevelSize, so the shape above is the flat cap and the silhouette comes
    // out at PHONE_W x PHONE_H with a BODY_R corner. Depth stays positive
    // (0.136), which is the check the original <RoundedBox> call failed.
    depth: PHONE_D - RAIL * 2,
    bevelEnabled: true,
    bevelSize: RAIL,
    bevelThickness: RAIL,
    bevelOffset: 0,
    bevelSegments: 8,
    curveSegments: 40,
    steps: 1,
  });
  geo.center();
  return toCreasedNormals(geo, 0.45);
};

const Device: React.FC<{
  src: string;
  rotX: number;
  rotY: number;
  rotZ: number;
}> = ({ src, rotX, rotY, rotZ }) => {
  const screenTex = useTexture(src);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 16;

  const body = useMemo(buildBody, []);
  const glassMask = useMemo(
    () => makeCornerMask(GLASS_H / GLASS_W, GLASS_R / GLASS_W),
    [],
  );
  const screenMask = useMemo(
    () => makeCornerMask(SCREEN_H / SCREEN_W, SCREEN_R / SCREEN_W),
    [],
  );
  const lens = useMemo(() => makeLensTexture(), []);
  const rough = useMemo(() => makeRoughnessMap(), []);

  return (
    <group rotation={[rotX, rotY, rotZ]}>
      {/* Titanium body. metalness 1 means it renders whatever the Environment
          shows it, so the studio below is doing most of the work here. */}
      <mesh geometry={body}>
        <meshStandardMaterial
          color="#a7acb6"
          metalness={1}
          roughness={0.31}
          roughnessMap={rough}
          envMapIntensity={1.05}
        />
      </mesh>

      {/* THE BLACK MASK UNDER THE GLASS - the bezel proper.
          Flat plane, corners removed by the alpha mask. transparent + a low
          alphaTest, and depthWrite OFF: the discard keeps the fully clear
          corners from ever reaching the blend, and turning depth writes off
          means the antialiased fringe on the corner arc cannot punch a depth
          hole that the screen and glass in front of it would then fail
          against. Ordering is pinned by renderOrder instead, which is safe
          because this whole stack is parallel planes at known depths - there
          is nothing for the sort to get wrong. */}
      <mesh position={[0, 0, FRONT_Z + 0.0012]} renderOrder={1}>
        <planeGeometry args={[GLASS_W, GLASS_H]} />
        <meshStandardMaterial
          color="#05070d"
          roughness={0.32}
          metalness={0.45}
          envMapIntensity={0.55}
          alphaMap={glassMask}
          transparent
          alphaTest={0.02}
          depthWrite={false}
        />
      </mesh>

      {/* THE DISPLAY. Same trick, tighter radius: BODY_R - BEZEL, so the
          rounded display sits concentrically inside the rounded body and the
          black frame stays an even width around the corner. Unlit and
          toneMapped off so the UI keeps its own colours; knocked back a few
          percent so the glass sheen has somewhere to go. */}
      <mesh position={[0, 0, FRONT_Z + 0.003]} renderOrder={2}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial
          map={screenTex}
          color="#e6ecf4"
          toneMapped={false}
          alphaMap={screenMask}
          transparent
          alphaTest={0.02}
          depthWrite={false}
        />
      </mesh>

      {/* Punch-hole camera: a centred hole, not an iPhone notch or island.
          SwipeClean ships on Google Play only, so an Apple silhouette would be
          factually wrong about the product. It sits in the gap the app's own
          status bar already leaves between the clock and the battery, which is
          where a real S24 puts it. */}
      <mesh position={[0, HOLE_Y, FRONT_Z + 0.0042]} renderOrder={3}>
        <circleGeometry args={[HOLE_R, 48]} />
        <meshBasicMaterial map={lens} toneMapped={false} transparent depthWrite={false} />
      </mesh>

      {/* THE GLASS.
          Additive rather than alpha-blended. A sheet of glass at ~5% opacity
          blends in only 5% of its own reflection, which is why the previous
          version's glass was invisible; what glass actually does to the image
          underneath is ADD a reflection to it. So: black base colour (no
          diffuse to wash the UI out), clearcoat for the second specular lobe,
          and additive blending, which leaves the reflection and nothing else.
          depthWrite off - it is genuinely translucent and must never occlude.
          Its alphaMap does double duty: it scales the additive contribution,
          so the corners add nothing and no square sheen escapes the
          silhouette.
          Roughness matters more than it looks. At 0.05 this was a mirror and
          reflected a lightformer's straight edge as a hard white wedge across
          the UI, which read as a rendering bug rather than as glass; 0.22 with
          a matching clearcoatRoughness blurs the environment into the soft
          gradient a real sheet of cover glass actually gives. */}
      <mesh position={[0, 0, FRONT_Z + 0.006]} renderOrder={4}>
        <planeGeometry args={[GLASS_W, GLASS_H]} />
        <meshPhysicalMaterial
          color="#000000"
          metalness={0}
          roughness={0.22}
          clearcoat={1}
          clearcoatRoughness={0.16}
          envMapIntensity={1.15}
          alphaMap={glassMask}
          transparent
          opacity={0.3}
          alphaTest={0.01}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

/* ---------------------------------------------------------------------------
 * Framing.
 *
 * A long lens: fov 26 at distance 12 is roughly an 85mm product shot. Wider
 * would splay the body's verticals and read as a game asset. The canvas is
 * sized so the body comes out exactly `phoneWidth` px across:
 *   visible height at z=0 = 2 * distance * tan(fov/2)
 *   canvasHeight          = phoneWidth * thatHeight / PHONE_W
 * dpr 2 supersamples, which is what keeps the masked corner arcs and the
 * rail's silhouette clean at this size.
 * ------------------------------------------------------------------------ */
const FOV = 26;
const DISTANCE = 12;

export const PhoneVariant2: React.FC<PhoneVariantProps> = ({
  phoneWidth,
  screen,
  rotY = 0,
  rotX = 0,
  rotZ = 0,
}) => {
  const visibleH = 2 * DISTANCE * Math.tan((FOV / 2) * (Math.PI / 180));
  const height = Math.round((phoneWidth * visibleH) / PHONE_W);
  const width = Math.round(height * 0.6);
  const rad = (d: number) => (d * Math.PI) / 180;

  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={2}
      camera={{ position: [0, 0, DISTANCE], fov: FOV, near: 0.5, far: 60 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      {/* Low ambient on purpose. Metal that is lit rather than reflected goes
          flat and plastic; almost all of the body's brightness should be
          coming off the Environment below. */}
      <ambientLight intensity={0.22} />
      <directionalLight position={[4, 6, 8]} intensity={1.5} />
      <directionalLight position={[-6, -1, 5]} intensity={0.5} color="#bcd9ff" />

      {/* The studio. Everything not covered by a panel stays black, and that
          matters more than the panels do: metal reads as metal because of the
          CONTRAST between what it reflects, so an evenly bright environment
          would turn the rail into white plastic.

          The narrow strips are the pieces that sell rotation - a thin bright
          source reflected in a curved chamfer becomes a long streak that
          travels a long way for a small turn. There are deliberately TWO of
          them per side with a gap between, because one continuous strip put an
          even white line down the whole rail, and an even line is a stroke,
          not a reflection. The gap gives the rail a bright length and a dark
          length that slide past each other as the device turns.

          The two sides are gelled slightly differently - cool left, warm right
          - the way a real two-head setup would be, so the metal picks up a
          colour shift across its width instead of one flat grey. */}
      <Environment resolution={512}>
        <Lightformer
          form="rect"
          intensity={7}
          position={[-4, 3.8, 4]}
          scale={[0.5, 5, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={5}
          position={[-3.7, -3.4, 4.2]}
          scale={[0.42, 3.8, 1]}
          color="#dfeaff"
        />
        <Lightformer
          form="rect"
          intensity={5.5}
          position={[4.2, -0.6, 4.2]}
          scale={[0.5, 5.5, 1]}
          color="#fff2df"
        />
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[4.8, 3.4, 2.5]}
          scale={[3.5, 6, 1]}
          color="#cfe0ff"
        />
        <Lightformer
          form="rect"
          intensity={2}
          position={[0, 6.5, 1]}
          scale={[7, 2.5, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={4}
          position={[-1.2, -5.5, 4]}
          scale={[5, 1.1, 1]}
          color="#ffd9b0"
        />
        <Lightformer
          form="ring"
          intensity={3.5}
          position={[2.6, 2.2, 5]}
          scale={1.4}
          color="#ffffff"
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
