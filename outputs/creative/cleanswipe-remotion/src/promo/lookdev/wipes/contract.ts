/**
 * Look-dev contract for liquid transitions. Every variant exports a component
 * with this exact shape so they can be rendered from one harness and compared
 * with nothing else differing.
 */
export type WipeVariantProps = {
  /** Total duration in frames. The frame MUST be fully covered at the midpoint. */
  durationInFrames: number;
  /** Liquid colour - the incoming section's ground. */
  color: string;
  width: number;
  height: number;
  /** Varies the layout between transitions so successive ones differ. */
  seed?: number;
};
