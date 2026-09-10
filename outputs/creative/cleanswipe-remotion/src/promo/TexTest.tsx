import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { ThreeCanvas, useOffthreadVideoTexture } from "@remotion/three";

/**
 * Isolation test: does the offthread video texture load AT ALL, on a bare
 * full-frame plane with no phone geometry in the way?
 *
 * The magenta fallback proved the phone's screen plane was drawing correctly
 * and the texture was simply absent, so the remaining question is whether the
 * texture ever resolves. This strips away every other variable.
 */
export const TexTest: React.FC = () => {
  const texture = useOffthreadVideoTexture({
    src: staticFile("screens/ScreenSwipe.mp4"),
    toneMapped: false,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#ff8800" }}>
      <ThreeCanvas width={500} height={900} camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={1} />
        <mesh>
          <planeGeometry args={[1.9, 4.1]} />
          {/* Keyed on the texture so react-three-fiber builds a NEW material
              when it arrives, rather than mutating map on an existing one
              (which needs needsUpdate and silently no-ops otherwise). */}
          <meshBasicMaterial
            key={texture ? "tex" : "none"}
            map={texture ?? null}
            color={texture ? "#ffffff" : "#ff00ff"}
            toneMapped={false}
          />
        </mesh>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
