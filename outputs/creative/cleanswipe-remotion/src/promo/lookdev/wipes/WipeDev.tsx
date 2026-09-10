import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { WipeVariant1 } from "./WipeVariant1";
import { WipeVariant2 } from "./WipeVariant2";
import { WipeVariant3 } from "./WipeVariant3";

const V = [WipeVariant1, WipeVariant2, WipeVariant3];

/**
 * Harness: the wipe runs over a busy "outgoing scene" stand-in so the shapes
 * are judged against real content, not against flat colour.
 */
export const WipeDev: React.FC<{ variant: number; dur: number }> = ({ variant, dur }) => {
  const { width, height } = useVideoConfig();
  const Comp = V[(variant - 1) % V.length];
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0f16" }}>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(140deg,#1d3f4a 0%,#4a7c3f 40%,#d98324 70%,#14304a 100%)",
        }}
      />
      <Comp durationInFrames={dur} color="#10b981" width={width} height={height} seed={2} />
    </AbsoluteFill>
  );
};
