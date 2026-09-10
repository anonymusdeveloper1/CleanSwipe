import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { PhoneVariant1 } from "./PhoneVariant1";
import { PhoneVariant2 } from "./PhoneVariant2";
import { PhoneVariant3 } from "./PhoneVariant3";
import { PhoneVariant4 } from "./PhoneVariant4";

const VARIANTS = [PhoneVariant1, PhoneVariant2, PhoneVariant3, PhoneVariant4];

/**
 * Renders one variant against the film's own green block, rotating so the
 * travelling specular can be judged. Identical framing for every variant so
 * the only difference is the device itself.
 */
export const LookDev: React.FC<{ variant: number }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const Comp = VARIANTS[(variant - 1) % VARIANTS.length];
  const rotY = Math.sin(frame * 0.05) * 16;
  return (
    <AbsoluteFill
      style={{ backgroundColor: "#10b981", alignItems: "center", justifyContent: "center" }}
    >
      <Comp phoneWidth={460} screen="screens/swipe-0.png" rotY={rotY} rotX={3} rotZ={-1.5} />
    </AbsoluteFill>
  );
};
