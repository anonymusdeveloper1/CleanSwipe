import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadArchivo } from "@remotion/google-fonts/ArchivoBlack";
import {
  CompressScreen,
  Screen,
  SmartCleanScreen,
  StatsScreen,
  SwipeScreen,
} from "./screens/AppScreens";
import { SPRING_TIGHT, beats } from "./theme";

loadArchivo("normal", { weights: ["400"], subsets: ["latin"] });
loadInter("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

/**
 * Pass one of a two-pass render.
 *
 * A 3D mesh cannot display React DOM, so the app UI cannot live directly on
 * the phone's screen once the device becomes real geometry. These
 * compositions render the SAME screen components used before, to standalone
 * videos, which `Phone3D` then maps onto the display mesh as a frame-synced
 * texture. Everything animated survives the trip: counters still tick, the
 * deck still re-deals.
 *
 * BUILD ORDER MATTERS: these must be rendered to public/screens/ BEFORE the
 * promo compositions, or the texture is missing and the display renders flat.
 * See `npm run build:screens` in package.json.
 *
 * Rendered at 1080x2340 (9:19.5, the S24's ratio) so the texture maps onto the
 * screen plane without distortion.
 */

export const SCREEN_W = 1080;
export const SCREEN_H = 2340;
/** Long enough to cover the longest section that shows a device. */
export const SCREEN_FRAMES = 200;

/**
 * SAFE INSET.
 * The UI used to be rendered full-bleed to the texture edge, so once mapped
 * onto the device its header and tab bar sat flush against the display border
 * and the display's own rounded corners (16% of screen width) cut into them.
 * That is what made the screens look oversized and cropped inside the phone.
 *
 * The UI is now drawn slightly smaller and centred on the app's own background
 * colour, so the surround reads as screen rather than as a crop, and nothing
 * important lands under a rounded corner.
 */
const UI_INSET = 0.93;

const Host: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const w = Math.round(SCREEN_W * UI_INSET);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#111827",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: w, height: Math.round((w / 390) * 844) }}>
        <Screen width={w}>{children}</Screen>
      </div>
    </AbsoluteFill>
  );
};

/**
 * The swipe deck. Timings are deliberately identical to the SWIPES array in
 * SwipeScene, so the card leaving the screen and the photo flying out of the
 * device are the same event seen twice.
 */
export const ScreenSwipe: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const SWIPES = [
    { at: beats(3), dir: -1 },
    { at: beats(5.5), dir: 1 },
    { at: beats(8), dir: -1 },
  ];

  let variant = 0;
  for (const sw of SWIPES) if (frame >= sw.at + 10) variant++;

  const active = SWIPES.find((sw) => frame >= sw.at && frame < sw.at + 46);
  const inCard = active
    ? spring({ frame: frame - active.at, fps, config: SPRING_TIGHT, durationInFrames: 16 })
    : 0;
  const cardX = active ? active.dir * inCard * 560 : 0;
  const cleared = SWIPES.filter((sw) => frame >= sw.at + 10 && sw.dir < 0).length;

  return (
    <Host>
      <SwipeScreen
        cardX={cardX}
        cardRot={cardX * 0.02}
        variant={variant}
        markedCount={60 + cleared}
      />
    </Host>
  );
};

export const ScreenSmartClean: React.FC = () => (
  <Host>
    <SmartCleanScreen countFrame={8} />
  </Host>
);

export const ScreenCompress: React.FC = () => (
  <Host>
    <CompressScreen countFrame={4} />
  </Host>
);

export const ScreenStats: React.FC = () => (
  <Host>
    <StatsScreen countFrame={4} />
  </Host>
);
