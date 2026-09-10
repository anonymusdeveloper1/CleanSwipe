import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { Environment, Lightformer, RoundedBox, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { staticFile } from "remotion";
import type { PhoneVariantProps } from "./contract";

/**
 * VARIANT 4 - "photographed device".
 *
 * WHY THE PREVIOUS ONE READ AS SHARP AND FAKE
 * The body was a drei <RoundedBox> but the front face, the display and the
 * glass were all <planeGeometry> - three square rectangles stacked on a
 * rounded body. Every one of those squares punched its corner straight through
 * the rounded silhouette, so the outline the eye actually traces was a
 * rectangle. (RoundedBox made it worse: it clamps its radius to
 * min(w,h,d)/2, so a 0.19-deep body could never have a corner radius above
 * ~0.095 however large a number you passed it. The corners were sharp because
 * they were literally clamped almost flat.)
 *
 * THE FIX HERE IS STRUCTURAL, NOT COSMETIC: there is no planeGeometry and no
 * RoundedBox in the device at all. Every surface - metal shell, black mask,
 * display, cover glass - is swept from ONE rounded-rectangle outline family by
 * `sweep()` below, so all four share the exact same corner arc by
 * construction. They cannot disagree.
 *
 * The outline family has a useful property: offsetting a rounded rect inward
 * by `d` keeps the four corner centres fixed and just shrinks the radius to
 * r-d. So "inset by d" is exact, rings at different insets correspond
 * point-for-point, and the signed distance to the outer edge of any ring is
 * simply -d. That last fact is what makes the 2.5D glass dome cheap: the edge
 * roll-off is a function of the ring index alone, no per-vertex SDF needed.
 *
 * WHAT SELLS IT AS A PHOTOGRAPH
 *  - 2.5D cover glass: the front stack is a plateau that rolls off over the
 *    outer ~3mm, so the UI bends at the extreme edges and the rim catches a
 *    separate, tighter highlight from the flat middle.
 *  - The glass thins toward the rim (it domes 0.022, the panel under it only
 *    0.012), which is what real bonded cover glass does and gives a real
 *    parallax between the black mask and the glass edge as the device turns.
 *  - Satin-brushed rail: a deterministic value-noise roughness map whose
 *    streaks run ALONG the rail, so the travelling highlight breaks into
 *    fibres instead of sliding as one clean bar.
 *  - A real cast shadow onto a shadow-catcher behind the device, so it sits in
 *    front of the green rather than floating on it.
 *  - The environment includes a large green panel behind the camera-facing
 *    side: the metal reflects the backdrop it is standing in, which is the
 *    single cheapest cue that an object is really there.
 */

/* ------------------------------------------------------------------ *
 * Proportions. Derived FROM the screen so the bezel is uniform.
 * ------------------------------------------------------------------ */
const TEX_W = 1080;
const TEX_H = 2340;

const PHONE_W = 2.0; // widest point of the metal, at mid-depth
const PHONE_D = 0.176;
const BODY_R = 0.28; // plan corner radius of the metal at its widest
const BEVEL_SIZE = 0.026; // how far the flat front is inset from the widest point
const BEVEL_T = 0.03; // how far the rail rolls back over that inset
const BEZEL = 0.052; // black frame, IDENTICAL on all four sides

/** Inset, from the outer silhouette, at which the display begins. */
const BEZEL_TOT = BEVEL_SIZE + BEZEL;
const SCREEN_W = PHONE_W - 2 * BEZEL_TOT;
const SCREEN_H = (SCREEN_W * TEX_H) / TEX_W;
/** Body height FOLLOWS the screen. Never the reverse. */
const PHONE_H = SCREEN_H + 2 * BEZEL_TOT;

const BX = PHONE_W / 2 - BODY_R;
const BY = PHONE_H / 2 - BODY_R;
const FP = PHONE_D / 2; // z of the flat metal front

/** 2.5D edge: the front stack is flat, then rolls off over this outer band. */
const CURVE_BAND = 0.085;
const GLASS_DOME = 0.022;
const PANEL_DOME = 0.012;

const SCREEN_BASE = FP + 0.001;
const MASK_BASE = FP + 0.0019;
const GLASS_BASE = FP + 0.0034;

/** The display tucks a hair under the mask so the seam cannot leak. */
const SCREEN_OVER = 0.006;
/** Innermost ring before the flat centre fan (must stay under BODY_R). */
const D_INNER = 0.27;

const ARC_SEG = 72; // per 90deg corner: ~1.3px chord at final render scale
const SIDE_SEG = 14;

const HOLE_R = 0.046;
const HOLE_Y = SCREEN_H / 2 - 0.155;

/** Roll-off parameter: 1 at the outer edge of the front face, 0 on the plateau. */
const edgeT = (d: number) => {
  const x = (d - BEVEL_SIZE) / CURVE_BAND;
  return x <= 0 ? 1 : x >= 1 ? 0 : 1 - x;
};
const domeZ = (d: number, base: number, dome: number) => {
  const t = edgeT(d);
  return base + dome * (1 - t * t);
};

/* ------------------------------------------------------------------ *
 * The one outline family everything is built from.
 * ------------------------------------------------------------------ */
type Pt = { x: number; y: number };
const Q = Math.PI / 2;

const outlineFrom = (bx: number, by: number, r: number, arcSeg: number, sideSeg: number): Pt[] => {
  const corners: [number, number, number][] = [
    [bx, by, 0],
    [-bx, by, Q],
    [-bx, -by, 2 * Q],
    [bx, -by, 3 * Q],
  ];
  const pts: Pt[] = [];
  for (let c = 0; c < 4; c++) {
    const cx = corners[c][0];
    const cy = corners[c][1];
    const a0 = corners[c][2];
    for (let i = 0; i <= arcSeg; i++) {
      const a = a0 + (i / arcSeg) * Q;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    const nx = corners[(c + 1) % 4][0];
    const ny = corners[(c + 1) % 4][1];
    const na = corners[(c + 1) % 4][2];
    const p1x = cx + r * Math.cos(a0 + Q);
    const p1y = cy + r * Math.sin(a0 + Q);
    const p2x = nx + r * Math.cos(na);
    const p2y = ny + r * Math.sin(na);
    for (let i = 1; i < sideSeg; i++) {
      const t = i / sideSeg;
      pts.push({ x: p1x + (p2x - p1x) * t, y: p1y + (p2y - p1y) * t });
    }
  }
  return pts;
};

type Ring = { d: number; z: number; t: number };

/**
 * Sweep a set of concentric rounded-rect rings into an indexed, smoothly
 * shaded surface. `flip` picks the winding: false for the outward-facing
 * shell (radius grows as z falls), true for the front-facing layers (radius
 * shrinks as z rises).
 */
const sweep = (opts: {
  rings: Ring[];
  capFirst?: 1 | -1;
  capLast?: 1 | -1;
  flip?: boolean;
  uv: (x: number, y: number, s: number, t: number) => [number, number];
}): THREE.BufferGeometry => {
  const { rings, capFirst, capLast, flip, uv } = opts;

  const base = outlineFrom(BX, BY, BODY_R, ARC_SEG, SIDE_SEG);
  const n = base.length;
  const stride = n + 1; // duplicated seam vertex so the UV does not wrap back

  const s: number[] = [0];
  let per = 0;
  for (let j = 1; j <= n; j++) {
    const a = base[j - 1];
    const b = base[j % n];
    per += Math.hypot(b.x - a.x, b.y - a.y);
    s.push(per);
  }
  for (let j = 0; j <= n; j++) s[j] /= per;

  const k = rings.length;
  const total = k * stride + (capFirst ? 1 : 0) + (capLast ? 1 : 0);
  const pos = new Float32Array(total * 3);
  const uvs = new Float32Array(total * 2);

  for (let i = 0; i < k; i++) {
    const ring = rings[i];
    const pts = outlineFrom(BX, BY, BODY_R - ring.d, ARC_SEG, SIDE_SEG);
    for (let j = 0; j <= n; j++) {
      const p = pts[j % n];
      const vi = i * stride + j;
      pos[vi * 3] = p.x;
      pos[vi * 3 + 1] = p.y;
      pos[vi * 3 + 2] = ring.z;
      const t = uv(p.x, p.y, s[j], ring.t);
      uvs[vi * 2] = t[0];
      uvs[vi * 2 + 1] = t[1];
    }
  }

  let cursor = k * stride;
  let capAIdx = -1;
  let capBIdx = -1;
  if (capFirst) {
    capAIdx = cursor;
    pos[cursor * 3 + 2] = rings[0].z;
    const t = uv(0, 0, 0, rings[0].t);
    uvs[cursor * 2] = t[0];
    uvs[cursor * 2 + 1] = t[1];
    cursor++;
  }
  if (capLast) {
    capBIdx = cursor;
    pos[cursor * 3 + 2] = rings[k - 1].z;
    const t = uv(0, 0, 0, rings[k - 1].t);
    uvs[cursor * 2] = t[0];
    uvs[cursor * 2 + 1] = t[1];
    cursor++;
  }

  const idx: number[] = [];
  for (let i = 0; i < k - 1; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j;
      const d = c + 1;
      if (flip) idx.push(a, d, c, a, b, d);
      else idx.push(a, c, d, a, d, b);
    }
  }
  if (capFirst) {
    for (let j = 0; j < n; j++) {
      if (capFirst === 1) idx.push(capAIdx, j, j + 1);
      else idx.push(capAIdx, j + 1, j);
    }
  }
  if (capLast) {
    const off = (k - 1) * stride;
    for (let j = 0; j < n; j++) {
      if (capLast === 1) idx.push(capBIdx, off + j, off + j + 1);
      else idx.push(capBIdx, off + j + 1, off + j);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();

  // Weld the duplicated seam column, otherwise a hard crease runs down the
  // right-hand rail exactly where the highlight is brightest.
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < k; i++) {
    const a = i * stride;
    const b = i * stride + n;
    const nx = nrm.getX(a) + nrm.getX(b);
    const ny = nrm.getY(a) + nrm.getY(b);
    const nz = nrm.getZ(a) + nrm.getZ(b);
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(a, nx / l, ny / l, nz / l);
    nrm.setXYZ(b, nx / l, ny / l, nz / l);
  }
  nrm.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
};

/** Rings across a front layer: dense at the rim where the dome bends. */
const faceRings = (dFrom: number, dTo: number, count: number, base: number, dome: number): Ring[] => {
  const out: Ring[] = [];
  for (let i = 0; i <= count; i++) {
    const f = Math.pow(i / count, 2);
    const d = dFrom + (dTo - dFrom) * f;
    out.push({ d, z: domeZ(d, base, dome), t: i / count });
  }
  return out;
};

const bodyRings = (): Ring[] => {
  const raw: { d: number; z: number }[] = [];
  const S = 14;
  const zRail = FP - BEVEL_T;
  raw.push({ d: BEVEL_SIZE, z: FP });
  for (let i = 1; i <= S; i++) {
    const a = (i / S) * Q;
    raw.push({ d: BEVEL_SIZE * (1 - Math.sin(a)), z: FP - BEVEL_T * (1 - Math.cos(a)) });
  }
  const RAIL = 8;
  for (let i = 1; i <= RAIL; i++) raw.push({ d: 0, z: zRail - (2 * zRail * i) / RAIL });
  for (let i = 1; i <= S; i++) {
    const a = Q * (1 - i / S);
    raw.push({ d: BEVEL_SIZE * (1 - Math.sin(a)), z: -(FP - BEVEL_T * (1 - Math.cos(a))) });
  }
  let acc = 0;
  const ts = [0];
  for (let i = 1; i < raw.length; i++) {
    acc += Math.hypot(raw[i].d - raw[i - 1].d, raw[i].z - raw[i - 1].z);
    ts.push(acc);
  }
  return raw.map((p, i) => ({ d: p.d, z: p.z, t: ts[i] / acc }));
};

/* ------------------------------------------------------------------ *
 * Deterministic brushed-metal roughness. No Math.random / Date.now.
 * ------------------------------------------------------------------ */
const hash1 = (n: number) => {
  const s = Math.sin(n * 127.1 + 3.77) * 43758.5453123;
  return s - Math.floor(s);
};
const vnoise = (x: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i) * (1 - u) + hash1(i + 1) * u;
};

const makeBrushTexture = (): THREE.Texture | null => {
  if (typeof document === "undefined") return null;
  const W = 96;
  const H = 1024;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const band =
      vnoise(y / 23) * 0.5 + vnoise(y / 8.3 + 31.7) * 0.33 + vnoise(y / 2.9 + 77.3) * 0.17;
    for (let x = 0; x < W; x++) {
      // Very slight variation ALONG each fibre so it is not a perfect stripe.
      const along = vnoise(x / 30 + y / 260 + 11.3) - 0.5;
      const r = Math.max(0.06, Math.min(0.6, 0.24 + (band - 0.5) * 0.4 + along * 0.06));
      const v = Math.round(r * 255);
      const o = (y * W + x) * 4;
      img.data[o] = v;
      img.data[o + 1] = v;
      img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 0.16);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  return tex;
};

/* ------------------------------------------------------------------ *
 * The device.
 * ------------------------------------------------------------------ */
const Device: React.FC<{ src: string; rot: [number, number, number] }> = ({ src, rot }) => {
  const texture = useTexture(src);

  const geo = useMemo(() => {
    const planarScreen = (x: number, y: number): [number, number] => [
      x / SCREEN_W + 0.5,
      y / SCREEN_H + 0.5,
    ];
    const planarFront = (x: number, y: number): [number, number] => [
      x / PHONE_W + 0.5,
      y / PHONE_H + 0.5,
    ];
    return {
      body: sweep({
        rings: bodyRings(),
        capFirst: 1,
        capLast: -1,
        uv: (_x, _y, s, t) => [s, t],
      }),
      mask: sweep({
        rings: faceRings(BEVEL_SIZE, BEZEL_TOT, 18, MASK_BASE, PANEL_DOME),
        flip: true,
        uv: planarFront,
      }),
      screen: sweep({
        rings: faceRings(BEZEL_TOT - SCREEN_OVER, D_INNER, 30, SCREEN_BASE, PANEL_DOME),
        capLast: 1,
        flip: true,
        uv: planarScreen,
      }),
      glass: sweep({
        rings: faceRings(BEVEL_SIZE, D_INNER, 34, GLASS_BASE, GLASS_DOME),
        capLast: 1,
        flip: true,
        uv: planarFront,
      }),
    };
  }, []);

  const brush = useMemo(() => makeBrushTexture(), []);

  const screenTex = useMemo(() => {
    if (!texture) return null;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 16;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }, [texture]);

  return (
    <group rotation={rot}>
      {/* Metal shell. One swept surface: flat front, rolled bevel, straight
          rail, rolled back bevel. Smooth normals throughout, so the specular
          slides continuously instead of stepping facet to facet. */}
      <mesh geometry={geo.body} castShadow>
        <meshStandardMaterial
          color="#b9bfcc"
          metalness={1}
          roughness={0.24}
          roughnessMap={brush}
        />
      </mesh>

      {/* Black mask under the glass. A ring, so its inner aperture gives the
          display its rounded corners without the display itself needing
          them - exactly how the real part is made. */}
      <mesh geometry={geo.mask}>
        <meshStandardMaterial color="#05070c" metalness={0.15} roughness={0.42} />
      </mesh>

      {/* The display: pure emitted light, no shading. A lit material here is a
          trap - a punctual light on a roughness-0.16 dielectric peaks its GGX
          lobe far above 1.0, and with toneMapped off that clipped to a white
          slab across half the UI. All the glare belongs on the glass sheet
          above, where it can be controlled independently. */}
      <mesh geometry={geo.screen}>
        <meshBasicMaterial map={screenTex} toneMapped={false} />
      </mesh>

      {/* Cover glass, additively blended: black base contributes nothing, only
          its reflections are added, so the sheen reads as glare on top of the
          UI instead of a grey film over it. */}
      <mesh geometry={geo.glass} renderOrder={10}>
        <meshPhysicalMaterial
          color="#000000"
          metalness={0}
          roughness={0.09}
          clearcoat={0.5}
          clearcoatRoughness={0.07}
          ior={1.52}
          reflectivity={0.5}
          transparent
          opacity={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Centred punch-hole camera. Galaxy S24, not an iPhone island - the app
          ships on Google Play only. */}
      <mesh position={[0, HOLE_Y, SCREEN_BASE + PANEL_DOME + 0.0012]}>
        <circleGeometry args={[HOLE_R, 64]} />
        <meshBasicMaterial color="#000205" toneMapped={false} />
      </mesh>
      <mesh position={[0, HOLE_Y, SCREEN_BASE + PANEL_DOME + 0.0018]}>
        <circleGeometry args={[HOLE_R * 0.74, 64]} />
        <meshPhysicalMaterial
          color="#04070e"
          metalness={0.2}
          roughness={0.07}
          clearcoat={1}
          clearcoatRoughness={0.02}
        />
      </mesh>

      {/* Side keys on the right rail - volume rocker above, power below. */}
      {([
        [1.02, 0.4],
        [0.55, 0.24],
      ] as const).map(([y, h]) => (
        <RoundedBox
          key={y}
          args={[0.02, h, 0.075]}
          radius={0.009}
          smoothness={4}
          position={[PHONE_W / 2 - 0.0015, y, 0]}
        >
          <meshStandardMaterial color="#8f96a4" metalness={1} roughness={0.33} />
        </RoundedBox>
      ))}
    </group>
  );
};

/* ------------------------------------------------------------------ *
 * Canvas sizing: fov 32 at distance 9.2 shows 2*9.2*tan(16deg) world units
 * of height, so a phone PHONE_W wide occupies PHONE_W/visibleH of the canvas
 * height. Invert that and the caller keeps thinking in pixels.
 * ------------------------------------------------------------------ */
const FOV = 32;
const DIST = 9.2;
const VIS_H = 2 * DIST * Math.tan(((FOV / 2) * Math.PI) / 180);

export const PhoneVariant4: React.FC<PhoneVariantProps> = ({
  phoneWidth,
  screen,
  rotY = 0,
  rotX = 0,
  rotZ = 0,
}) => {
  const height = Math.round((phoneWidth * VIS_H) / PHONE_W);
  const width = Math.round(height * 0.7);
  const rad = (d: number) => (d * Math.PI) / 180;

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ position: [0, 0, DIST], fov: FOV }}
      gl={{ antialias: true, alpha: true }}
      shadows={{ type: THREE.VSMShadowMap }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.12} />

      {/* Key. Deliberately almost black: it exists ONLY to throw the shadow,
          and <shadowMaterial> draws that from the shadow mask alone, so its
          darkness does not depend on this intensity at all. Carrying real
          brightness here was what smeared a milky slab across the display -
          a punctual light on the near-mirror cover glass, whose GGX peak sits
          far above 1.0 and which no amount of envMapIntensity could turn
          down. Every actual photon in this scene comes from the Environment
          below, where it can be shaped panel by panel. */}
      <directionalLight
        position={[-1.9, 3.1, 7]}
        intensity={0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-radius={9}
        shadow-blurSamples={20}
        shadow-bias={-0.0006}
        shadow-camera-near={1}
        shadow-camera-far={16}
        shadow-camera-left={-2.6}
        shadow-camera-right={2.6}
        shadow-camera-top={3.2}
        shadow-camera-bottom={-3.2}
      />

      {/* Shadow catcher: invisible except where the phone occludes the key,
          so the device sits IN FRONT OF the green rather than on top of it. */}
      <mesh position={[0, 0, -0.62]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <shadowMaterial transparent opacity={0.34} color="#05231a" />
      </mesh>

      {/* The studio. A metal at metalness 1 renders near-black under lights
          alone; these panels are the thing it actually reflects, and the fact
          that they are in world space is why the highlight TRAVELS as the
          device turns. */}
      <Environment resolution={1024}>
        {/* Big key softbox, camera left. */}
        <Lightformer form="rect" intensity={2.2} position={[-4.6, 3.2, 5.2]} scale={[5, 12, 1]} color="#ffffff" />
        {/* Narrow strip, camera right - this is the one that draws the long
            thin bar down the right rail. */}
        <Lightformer form="rect" intensity={3.4} position={[4.3, 0.4, 4.4]} scale={[0.45, 12, 1]} color="#e6f0ff" />
        {/* Second, shorter strip slightly forward, so the rail highlight
            breaks into two travelling segments rather than one dead bar. */}
        <Lightformer form="rect" intensity={2.0} position={[3.2, -2.6, 5.6]} scale={[0.7, 5, 1]} color="#ffffff" />
        {/* The panel the GLASS reflects: rotated off-axis so its mirror image
            crosses the display as a diagonal streak. A panel square to the
            camera reflects as a full-height slab and reads as a paint blob. */}
        <Lightformer
          form="rect"
          intensity={1.3}
          position={[2.6, 4.6, 3.2]}
          rotation={[-0.62, -0.5, 0.7]}
          scale={[1.4, 7, 1]}
          color="#ffffff"
        />
        {/* Overhead trough. */}
        <Lightformer form="rect" intensity={1.6} position={[0, 6.2, 1.6]} scale={[9, 1.6, 1]} color="#ffffff" />
        {/* Rim panels behind the device. */}
        <Lightformer form="rect" intensity={2.1} position={[-5.2, 0.5, -4.6]} scale={[2.6, 11, 1]} color="#c8daff" />
        <Lightformer form="rect" intensity={1.5} position={[5.2, 1.5, -4.2]} scale={[2.2, 10, 1]} color="#ffd9b2" />
        {/* Warm practical, adds a small round glint to the glass dome. */}
        <Lightformer form="ring" intensity={1.4} position={[2.6, 3.6, 3.4]} scale={2.2} color="#ffe3c0" />
        {/* Floor bounce, tinted by the green it is standing on. */}
        <Lightformer form="rect" intensity={0.7} position={[0, -5.4, 2.6]} scale={[8, 2.4, 1]} color="#8fd8bb" />
        {/* Screen spill onto the rails. These sit BESIDE the device, not in
            front of it: a panel on the display's own axis is mirrored by the
            glass across the entire UI and stains every black pixel with its
            colour (a warm one turned the whole navy interface brown). Off to
            the side it only grazes the rails. Not pointLights either - a
            punctual light this close to a near-mirror sheet burns a blown
            white pinhole into it that reads as a dead pixel. */}
        <Lightformer form="rect" intensity={0.5} position={[2.3, 0.3, 0.35]} scale={[0.5, 3.4, 1]} color="#e0a468" />
        <Lightformer form="rect" intensity={0.35} position={[-2.3, -0.6, 0.35]} scale={[0.5, 3, 1]} color="#5fb9d8" />
        {/* The backdrop itself. The metal should reflect the room it is in,
            and the room here is a green cyclorama. */}
        <Lightformer form="rect" intensity={0.45} position={[0, 0, -9]} scale={[18, 18, 1]} color="#10b981" />
      </Environment>

      <Device src={staticFile(screen)} rot={[rad(rotX), rad(rotY), rad(rotZ)]} />
    </ThreeCanvas>
  );
};
