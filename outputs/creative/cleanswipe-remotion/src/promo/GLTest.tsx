import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Phone3D } from "./primitives/Phone3D";

/**
 * Proves two things at once, both of which the previous build lacked:
 *  1. MOTION GRAPHICS INSIDE THE GLASS - the display is driven by a JPEG
 *     sequence, so the UI animates rather than sitting as a dead still.
 *  2. REAL 3D MOTION - the device swings through a wide arc so the specular
 *     travels and the body genuinely foreshortens, instead of the timid
 *     +/-13deg nudge that still read as a flat card.
 */
export const GLTest: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ backgroundColor: "#10b981", alignItems: "center", justifyContent: "center" }}
    >
      <Phone3D
        phoneWidth={430}
        seq={{ dir: "seq/swipe", frames: 41, pad: 2 }}
        rotY={Math.sin(frame * 0.05) * 30}
        rotX={4 + Math.sin(frame * 0.03) * 4}
        rotZ={-2}
      />
    </AbsoluteFill>
  );
};
