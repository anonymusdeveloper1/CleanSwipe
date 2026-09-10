import "./index.css";
import { Composition, Folder } from "remotion";
import { AdVideo } from "./AdVideo";
import { ads } from "./ad-data";
import { daily20260705Ads } from "./daily-2026-07-05-data";
import { PromoLandscape, PromoVertical, TOTAL_FRAMES } from "./promo/Promo";
import {
  SCREEN_FRAMES,
  SCREEN_H,
  SCREEN_W,
  ScreenCompress,
  ScreenSmartClean,
  ScreenStats,
  ScreenSwipe,
} from "./promo/ScreenComps";

export const RemotionRoot: React.FC = () => {
  return (
    <>
    {/* 2026-09 motion-graphics promo. The July ad drafts below are kept as-is. */}
    {/* Pass one: the app UI, rendered to videos that become screen textures
        on the 3D device. Must be rendered BEFORE the promo compositions. */}
    <Folder name="PromoScreens">
      {([
        ["ScreenSwipe", ScreenSwipe],
        ["ScreenSmartClean", ScreenSmartClean],
        ["ScreenCompress", ScreenCompress],
        ["ScreenStats", ScreenStats],
      ] as const).map(([id, comp]) => (
        <Composition
          key={id}
          id={id}
          component={comp}
          durationInFrames={SCREEN_FRAMES}
          fps={30}
          width={SCREEN_W}
          height={SCREEN_H}
        />
      ))}
    </Folder>
    <Folder name="Promo2026">
      <Composition
        id="PromoVertical"
        component={PromoVertical}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="PromoLandscape"
        component={PromoLandscape}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
    </Folder>
    <Folder name="CleanSwipeAds">
      {ads.map((ad) => (
        <Composition
          key={ad.id}
          id={ad.id}
          component={AdVideo}
          durationInFrames={ad.duration * 30}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ ad }}
        />
      ))}
      {daily20260705Ads.map((ad) => (
        <Composition
          key={ad.id}
          id={ad.id}
          component={AdVideo}
          durationInFrames={ad.duration * 30}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ ad }}
        />
      ))}
    </Folder>
    </>
  );
};
