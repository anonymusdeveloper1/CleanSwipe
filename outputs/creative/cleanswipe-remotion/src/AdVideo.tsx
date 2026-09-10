import { Audio } from "@remotion/media";
import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { AdConfig, ScreenKind } from "./ad-data";

type AdVideoProps = {
  ad: AdConfig;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const activeCaption = (ad: AdConfig, seconds: number) =>
  ad.captions.find((caption) => seconds >= caption.startMs / 1000 && seconds < caption.endMs / 1000) ??
  ad.captions[ad.captions.length - 1];

const activeScene = (ad: AdConfig, seconds: number) =>
  ad.scenes.find((scene) => seconds >= scene.start && seconds < scene.end) ?? ad.scenes[ad.scenes.length - 1];

const phase = (seconds: number, offset = 0) => (Math.sin((seconds + offset) * 2.8) + 1) / 2;

const Logo = ({ accent, brandName = "CleanSwipe" }: { accent: string; brandName?: string }) => (
  <div className="logo">
    <div className="logo-mark" style={{ borderColor: accent }}>
      <div style={{ background: accent }} />
      <div />
    </div>
    <span>{brandName}</span>
  </div>
);

const PhotoGrid = ({ mode = "review" }: { mode?: "review" | "gallery" }) => {
  return (
    <div className={`photo-grid ${mode}`}>
      {Array.from({ length: 12 }).map((_, index) => (
        <div className="photo-cell" key={index}>
          <div className="photo-tone" style={{ background: photoColor(index) }} />
          {mode === "review" && index % 5 === 0 ? <span className="keep">KEEP</span> : null}
          {mode === "review" && index % 5 !== 0 ? <span className="check">OK</span> : null}
        </div>
      ))}
    </div>
  );
};

const photoColor = (index: number) => {
  const colors = ["#dbeafe", "#dcfce7", "#fde68a", "#e0e7ff", "#fee2e2", "#f3e8ff"];
  return colors[index % colors.length];
};

const SmartCleanScreen = ({ accent, progress }: { accent: string; progress: number }) => {
  const cards = ["Duplicates", "Similar", "Blurry", "Screenshots", "Large videos", "Memes"];
  return (
    <div className="app-screen">
      <div className="app-title">Smart Clean</div>
      <div className="scan-button" style={{ background: accent }}>
        Scan now
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.min(100, progress * 100)}%`, background: accent }} />
      </div>
      {cards.map((card, index) => (
        <div className="category-card" key={card}>
          <div className="icon-chip" style={{ color: accent }}>
            {card.slice(0, 1)}
          </div>
          <div>
            <strong>{card}</strong>
            <small>{index % 2 === 0 ? "Ready to review" : "Found candidates"}</small>
          </div>
          <span>{index + 3}</span>
        </div>
      ))}
    </div>
  );
};

const SwipeScreen = ({ accent, progress }: { accent: string; progress: number }) => {
  const tilt = interpolate(progress % 1, [0, 0.5, 1], [-7, 8, -5]);
  return (
    <div className="app-screen">
      <div className="app-title">Swipe</div>
      <div className="month-pill">July 2026</div>
      <div className="swipe-card" style={{ transform: `rotate(${tilt}deg)` }}>
        <div className="photo-tone large" style={{ background: "#dbeafe" }} />
        <span className={tilt > 0 ? "keep-label" : "delete-label"}>{tilt > 0 ? "Keep" : "Delete"}</span>
      </div>
      <div className="mini-progress">
        <div style={{ width: `${Math.min(100, progress * 100)}%`, background: accent }} />
      </div>
    </div>
  );
};

const ReviewScreen = ({ accent }: { accent: string }) => (
  <div className="app-screen">
    <div className="app-title">Review Delete List</div>
    <div className="review-note">Keeping the best. Review the rest.</div>
    <PhotoGrid />
    <div className="delete-bar" style={{ background: "#dc2626" }}>
      Delete selected
    </div>
    <div className="control-note" style={{ borderColor: accent }}>
      You confirm before anything is removed.
    </div>
  </div>
);

const StorageScreen = ({ accent }: { accent: string }) => (
  <div className="app-screen warning-screen">
    <div className="storage-alert">
      <strong>Storage Full</strong>
      <span>Free up space to keep recording.</span>
    </div>
      <div className="scan-button" style={{ background: accent }}>
      Open SwipeClean
    </div>
  </div>
);

const StatsScreen = ({ accent }: { accent: string }) => (
  <div className="app-screen">
    <div className="app-title">Ready again</div>
    <div className="stat-big" style={{ color: accent }}>
      Space reclaimed
    </div>
    <div className="stat-row"><span>Photos reviewed</span><strong>Today</strong></div>
    <div className="stat-row"><span>Delete list</span><strong>Confirmed</strong></div>
    <div className="camera-ready">Camera ready</div>
  </div>
);

const CompressScreen = ({ accent, progress }: { accent: string; progress: number }) => (
  <div className="app-screen">
    <div className="app-title">Compress</div>
    <div className="filter-pill">Videos - Heavy files</div>
    <PhotoGrid mode="gallery" />
    <div className="compress-card">
      <strong>Compression progress</strong>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.min(100, progress * 100)}%`, background: accent }} />
      </div>
      <small>{"Original -> smaller copy"}</small>
    </div>
  </div>
);

const CompareScreen = ({ accent }: { accent: string }) => (
  <div className="app-screen">
    <div className="app-title">Compare</div>
    <div className="compare-box">
      <div>
        <span>Compressed</span>
      </div>
      <div>
        <span>Original</span>
      </div>
    </div>
    <div className="segmented" style={{ borderColor: accent }}>
      <span style={{ background: accent }}>Compressed</span>
      <span>Original</span>
    </div>
    <div className="scan-button" style={{ background: accent }}>
      Save or share
    </div>
  </div>
);

const ConvertScreen = ({ accent }: { accent: string }) => (
  <div className="app-screen">
    <div className="app-title">Studio</div>
    <div className="segmented" style={{ borderColor: accent }}>
      <span>Clean</span>
      <span style={{ background: accent }}>Convert</span>
    </div>
    <div className="format-sheet">
      <strong>Choose format</strong>
      <div className="format-row">
        {["MP4", "JPG", "PNG", "AUDIO"].map((format) => (
          <span key={format}>{format}</span>
        ))}
      </div>
    </div>
    <div className="scan-button" style={{ background: accent }}>
      Convert
    </div>
  </div>
);

const MessageScreen = ({ accent, label, brandName = "CleanSwipe" }: { accent: string; label: string; brandName?: string }) => (
  <div className="app-screen message-screen">
    <div className="bubble incoming">Can you fix this?</div>
    <div className="bubble outgoing" style={{ background: accent }}>
      {label}
    </div>
    <div className="message-card">{brandName} keeps the workflow simple.</div>
  </div>
);

const EndScreen = ({ accent, brandName = "CleanSwipe" }: { accent: string; brandName?: string }) => (
  <div className="app-screen end-screen">
    <Logo accent={accent} brandName={brandName} />
    <div className="end-headline">Clean up your camera roll.</div>
    <div className="end-subtitle">Swipe, Smart Clean, Compress, Convert.</div>
    <div className="scan-button" style={{ background: accent }}>
      Try {brandName}
    </div>
  </div>
);

const FloatingTile = ({
  children,
  accent,
  top,
  left,
  delay,
  seconds,
}: {
  children: ReactNode;
  accent: string;
  top: number;
  left: number;
  delay: number;
  seconds: number;
}) => {
  const y = Math.sin((seconds + delay) * 2.6) * 14;
  const scale = 0.96 + phase(seconds, delay) * 0.06;

  return (
    <div
      className="floating-tile"
      style={{
        top,
        left,
        borderColor: accent,
        transform: `translateY(${y}px) scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
};

const DynamicOverlay = ({ ad, seconds, sceneProgress }: { ad: AdConfig; seconds: number; sceneProgress: number }) => {
  if (ad.visualStyle === "panic") {
    const flashOpacity = interpolate(seconds, [0, 0.18, 0.45, 0.8], [0, 0.78, 0.08, 0], clamp);
    return (
      <div className="dynamic-layer panic-layer">
        <div className="alert-flash" style={{ opacity: flashOpacity }} />
        <FloatingTile accent="#dc2626" top={398} left={58} delay={0} seconds={seconds}>
          LOW STORAGE
        </FloatingTile>
        <FloatingTile accent={ad.accent} top={705} left={742} delay={0.4} seconds={seconds}>
          DUPLICATES
        </FloatingTile>
        <FloatingTile accent="#f59e0b" top={1010} left={72} delay={0.8} seconds={seconds}>
          BIG VIDEOS
        </FloatingTile>
        <div className="speed-bars" style={{ transform: `translateX(${interpolate(sceneProgress, [0, 1], [-90, 60], clamp)}px)` }}>
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (ad.visualStyle === "routine") {
    return (
      <div className="dynamic-layer routine-layer">
        <div className="calendar-card">
          <strong>FRI</strong>
          <span>10-min reset</span>
        </div>
        <div className="vertical-filmstrip">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} style={{ background: photoColor(index + 2), transform: `translateY(${Math.sin(seconds * 2 + index) * 8}px)` }} />
          ))}
        </div>
        {["Pick month", "Swipe", "Review", "Done"].map((item, index) => (
          <div
            className="checkline"
            key={item}
            style={{
              top: 430 + index * 92,
              opacity: interpolate(seconds, [index * 1.8, index * 1.8 + 0.35], [0.25, 1], clamp),
            }}
          >
            <span style={{ background: ad.accent }} />
            {item}
          </div>
        ))}
      </div>
    );
  }

  if (ad.visualStyle === "trust") {
    return (
      <div className="dynamic-layer trust-layer">
        <div className="shield-ring" style={{ borderColor: ad.accent, transform: `scale(${0.92 + phase(seconds) * 0.08})` }}>
          REVIEW
        </div>
        {["Find clutter", "Keep memories", "You decide"].map((item, index) => (
          <div
            className="trust-step"
            key={item}
            style={{
              top: 420 + index * 150,
              transform: `translateX(${Math.sin(seconds * 2 + index) * 18}px)`,
              borderColor: index === 1 ? "#047857" : ad.accent,
            }}
          >
            {item}
          </div>
        ))}
      </div>
    );
  }

  if (ad.visualStyle === "travel") {
    const fill = `${Math.round(interpolate(sceneProgress, [0, 1], [18, 88], clamp))}%`;
    return (
      <div className="dynamic-layer travel-layer">
        <div className="diagonal-band" />
        <div className="file-meter">
          <strong>4K VIDEO</strong>
          <span>Heavy file found</span>
          <div><i style={{ width: fill, background: ad.accent }} /></div>
        </div>
        <div className="boarding-list">
          <span>Passport</span>
          <span>Charger</span>
          <span>More space</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dynamic-layer studio-layer">
      <div className="chat-pop one">Can you send MP4?</div>
      <div className="chat-pop two">On it.</div>
      {["JPG", "MP4", "PNG", "AUDIO"].map((format, index) => (
        <div
          className="format-orbit"
          key={format}
          style={{
            transform: `rotate(${seconds * 18 + index * 90}deg) translateX(250px) rotate(${-seconds * 18 - index * 90}deg)`,
            borderColor: ad.accent,
          }}
        >
          {format}
        </div>
      ))}
    </div>
  );
};

const PhoneMock = ({ kind, accent, progress, label, brandName }: { kind: ScreenKind; accent: string; progress: number; label: string; brandName?: string }) => {
  return (
    <div className="phone">
      <div className="speaker" />
      {kind === "storage" ? <StorageScreen accent={accent} /> : null}
      {kind === "smart" ? <SmartCleanScreen accent={accent} progress={progress} /> : null}
      {kind === "review" ? <ReviewScreen accent={accent} /> : null}
      {kind === "swipe" ? <SwipeScreen accent={accent} progress={progress} /> : null}
      {kind === "stats" ? <StatsScreen accent={accent} /> : null}
      {kind === "compress" ? <CompressScreen accent={accent} progress={progress} /> : null}
      {kind === "compare" ? <CompareScreen accent={accent} /> : null}
      {kind === "convert" ? <ConvertScreen accent={accent} /> : null}
      {kind === "message" ? <MessageScreen accent={accent} label={label} brandName={brandName} /> : null}
      {kind === "end" ? <EndScreen accent={accent} brandName={brandName} /> : null}
    </div>
  );
};

export const AdVideo = ({ ad }: AdVideoProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  const scene = activeScene(ad, seconds);
  const caption = activeCaption(ad, seconds);
  const sceneProgress = interpolate(seconds, [scene.start, scene.end], [0, 1], clamp);
  const entrance = spring({ frame, fps, config: { damping: 24, stiffness: 120 } });
  const phoneY = interpolate(entrance, [0, 1], [80, 0]);
  const phoneScaleBase = ad.visualStyle === "routine" ? 0.88 : ad.visualStyle === "studio" ? 0.9 : 1;
  const phoneScale = phoneScaleBase * interpolate(sceneProgress, [0, 0.1, 1], [0.96, 1, 1.025], clamp);
  const phoneRotate =
    ad.visualStyle === "panic"
      ? interpolate(sceneProgress, [0, 0.08, 0.18, 1], [-10, 5, -2, 1], clamp)
      : ad.visualStyle === "travel"
        ? interpolate(sceneProgress, [0, 0.35, 1], [6, -3, 3], clamp)
        : ad.visualStyle === "studio"
          ? Math.sin(seconds * 2.2) * 2.5
          : Math.sin(seconds * 1.4) * 1.4;
  const phoneX =
    ad.visualStyle === "routine"
      ? -118
      : ad.visualStyle === "trust"
        ? 104
        : ad.visualStyle === "studio"
          ? 82
          : 0;
  const bgScale = interpolate(seconds, [0, ad.duration], [1.04, 1.12], clamp);
  const warningAudio = ad.id === "StorageFullMoment" || ad.id === "BigVideoFlight";
  const brandName = ad.brandName ?? "CleanSwipe";

  return (
    <AbsoluteFill className={`composition ${ad.visualStyle}`}>
      <Audio src={staticFile(ad.audio)} volume={0.07} />
      <Audio src={staticFile(ad.voiceover)} volume={1} />
      {warningAudio ? <Audio src={staticFile("audio/warning.wav")} volume={0.35} /> : null}
      {[6, 12, 18, 23].map((second) => (
        <Sequence from={Math.floor(second * fps)} key={second}>
          <Audio src={staticFile("audio/tap.wav")} volume={0.2} />
        </Sequence>
      ))}
      <Img
        className="background-image"
        src={staticFile(ad.background)}
        style={{ transform: `scale(${bgScale})` }}
      />
      <div className="scrim" />
      <DynamicOverlay ad={ad} seconds={seconds} sceneProgress={sceneProgress} />
      <div className="top-safe">
        <Logo accent={ad.accent} brandName={brandName} />
        <div className="ad-title">{ad.title}</div>
      </div>
      <div className="hero-copy">
        <div className="kicker" style={{ color: ad.accent }}>
          {scene.kicker}
        </div>
        <h1>{scene.caption}</h1>
      </div>
      <div className="phone-wrap" style={{ transform: `translate(${phoneX}px, ${phoneY}px) rotate(${phoneRotate}deg) scale(${phoneScale})` }}>
        <PhoneMock kind={scene.screen} accent={ad.accent} progress={sceneProgress} label={scene.caption} brandName={brandName} />
      </div>
      <div className="caption-card">
        <span style={{ background: ad.accent }} />
        <p>{caption.text}</p>
      </div>
      <div className="bottom-cta">
        <strong>{brandName}</strong>
        <span>Scan your camera roll</span>
      </div>
    </AbsoluteFill>
  );
};
