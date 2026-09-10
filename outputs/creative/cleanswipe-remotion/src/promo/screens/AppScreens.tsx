import React from "react";
import { Img, staticFile } from "remotion";
import { C, FONT } from "../theme";
import { Counter, RingMark } from "../primitives/Brand";

/**
 * SwipeClean's real UI, rebuilt as live React so the film can animate it.
 *
 * Why rebuild rather than drop in the PNG screenshots: the reference films all
 * animate INSIDE the device — counters tick, lists scroll, a card detaches and
 * flies out. A flat screenshot cannot do any of that, and a promo whose device
 * is a still image is exactly what makes cheap app ads look cheap.
 *
 * Everything is laid out in a fixed 390x844 logical space (iPhone/S24 points)
 * and scaled to whatever width the phone frame needs, so one set of numbers
 * works at every size in the film.
 */

export const SCREEN_W = 390;
export const SCREEN_H = 844;

/** Scales the 390x844 logical screen to a target pixel width. */
export const Screen: React.FC<{ width: number; children: React.ReactNode }> = ({
  width,
  children,
}) => (
  <div
    style={{
      width: SCREEN_W,
      height: SCREEN_H,
      transform: `scale(${width / SCREEN_W})`,
      transformOrigin: "0 0",
      background: C.bg,
      fontFamily: FONT.ui,
      color: C.text,
      position: "relative",
      overflow: "hidden",
    }}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

export const StatusBar: React.FC<{ time?: string }> = ({ time = "5:16" }) => (
  <div
    style={{
      height: 44,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 22px",
      fontSize: 15,
      fontWeight: 600,
      color: C.text,
    }}
  >
    <span>{time}</span>
    <span style={{ display: "flex", gap: 5, alignItems: "center", opacity: 0.9 }}>
      <span style={{ fontSize: 12 }}>▮▮▮</span>
      <span
        style={{
          fontSize: 11,
          background: C.text,
          color: C.bg,
          borderRadius: 6,
          padding: "1px 5px",
          fontWeight: 700,
        }}
      >
        58
      </span>
    </span>
  </div>
);

export const AppHeader: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 22px 18px",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* The mark's inner glyph is shade(accent, 0.72) = #0c855d in
          app-logo.tsx, NOT the accent itself. */}
      <RingMark size={32} color={C.green} innerColor="#0c855d" />
      <span
        style={{
          fontFamily: FONT.ui,
          fontWeight: 800,
          fontSize: 26,
          color: C.green,
          letterSpacing: "-0.01em",
        }}
      >
        SwipeClean
      </span>
    </div>
    <div style={{ fontSize: 26, color: C.text, opacity: 0.95 }}>⚙</div>
  </div>
);

const TABS = [
  { label: "Swipe", glyph: "▤" },
  { label: "Compress", glyph: "▣" },
  { label: "Stats", glyph: "▥" },
  { label: "Studio", glyph: "✦" },
];

export const TabBar: React.FC<{ active: number }> = ({ active }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 96,
      background: C.surface,
      display: "flex",
      alignItems: "flex-start",
      paddingTop: 10,
    }}
  >
    {TABS.map((t, i) => {
      const on = i === active;
      return (
        <div
          key={t.label}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              padding: "6px 22px",
              borderRadius: 18,
              // The app's animated tab bar slides an accent highlight pill
              // behind the active tab — reproduced here as a static pill,
              // since the film never cuts mid-tab-change.
              background: on ? "rgba(16,185,129,0.18)" : "transparent",
              fontSize: 20,
              color: on ? C.green : C.muted,
            }}
          >
            {t.glyph}
          </div>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: on ? C.green : C.muted,
            }}
          >
            {t.label}
          </span>
        </div>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      background: C.surfaceSoft,
      borderRadius: 22,
      padding: 20,
      ...style,
    }}
  >
    {children}
  </div>
);

export const GreenButton: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      background: C.green,
      color: "#04231a",
      borderRadius: 16,
      padding: "16px 20px",
      textAlign: "center",
      fontWeight: 800,
      fontSize: 17,
      ...style,
    }}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Smart Clean (Studio tab)
// ---------------------------------------------------------------------------

export const SmartCleanScreen: React.FC<{
  /** Drives the One-Tap counters so they can tick on screen. */
  countFrame?: number;
}> = ({ countFrame = 999 }) => (
  <>
    <StatusBar />
    <AppHeader />
    {/* Clean | Convert segmented pager */}
    <div
      style={{
        margin: "0 20px 24px",
        background: C.surfaceStrong,
        borderRadius: 28,
        padding: 5,
        display: "flex",
      }}
    >
      <div
        style={{
          flex: 1,
          background: C.surfaceSoft,
          borderRadius: 24,
          padding: "13px 0",
          textAlign: "center",
          fontWeight: 800,
          fontSize: 17,
          color: C.green,
        }}
      >
        Clean
      </div>
      <div
        style={{
          flex: 1,
          padding: "13px 0",
          textAlign: "center",
          fontWeight: 800,
          fontSize: 17,
          color: C.text,
        }}
      >
        Convert
      </div>
    </div>

    <div style={{ padding: "0 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 26, color: C.green }}>✦</span>
        <span style={{ fontFamily: FONT.display, fontSize: 30, letterSpacing: "-0.02em" }}>
          Smart Clean
        </span>
      </div>
      <div style={{ color: C.muted, fontSize: 16.5, lineHeight: 1.35, marginBottom: 20 }}>
        Automatically find clutter to clean — duplicates, blurry shots,
        screenshots and more.
      </div>

      <GreenButton style={{ marginBottom: 18 }}>⟳&nbsp; Scan again</GreenButton>

      <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 30, color: C.green }}>✧</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.15 }}>
            One-Tap
            <br />
            Recommendations
          </div>
          <div style={{ color: C.muted, fontSize: 15, marginTop: 4 }}>
            Reclaim about{" "}
            <Counter from={0} to={14} startFrame={countFrame} durationInFrames={26} /> GB
            <br />
            across{" "}
            <Counter
              from={0}
              to={2605}
              startFrame={countFrame}
              durationInFrames={26}
              group
            />{" "}
            items
          </div>
        </div>
        <div
          style={{
            background: C.green,
            color: "#04231a",
            borderRadius: 14,
            padding: "13px 16px",
            fontWeight: 800,
            fontSize: 15.5,
          }}
        >
          Review all
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "rgba(16,185,129,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              color: C.green,
            }}
          >
            ⧉
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 19 }}>Duplicate photos</div>
            <div style={{ color: C.muted, fontSize: 15, lineHeight: 1.3, marginTop: 2 }}>
              Find exact copies of the same photo and keep just one.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 17 }}>18 found</span>
          <span style={{ color: C.green, fontWeight: 700, fontSize: 17 }}>
            23 MB reclaimable
          </span>
        </div>
        <GreenButton>Review 18 items&nbsp; ›</GreenButton>
      </Card>
    </div>
    <TabBar active={3} />
  </>
);

// ---------------------------------------------------------------------------
// Swipe
// ---------------------------------------------------------------------------

const CARD_ART = ["promo/hero-1.jpg", "promo/hero-2.jpg", "promo/hero-3.jpg"];
const CARD_NAME = [
  "photo-1485067801970-70573e3f77d0",
  "IMG_20260814_181203",
];
const CARD_META = [
  "Aug 21, 2026 · 7.1 MB · 3000 x 4494",
  "Aug 14, 2026 · 4.8 MB · 4000 x 3000",
];

export const SwipeScreen: React.FC<{
  /** Photo card offset for the swipe gesture, in logical px. */
  cardX?: number;
  cardRot?: number;
  cardScale?: number;
  /** Which photo is on top of the deck — the deck re-deals after a clear. */
  variant?: number;
  markedCount?: number;
  reviewed?: number;
}> = ({
  cardX = 0,
  cardRot = 0,
  cardScale = 1,
  variant = 0,
  markedCount = 60,
  reviewed = 286,
}) => (
  <>
    <StatusBar time="5:17" />
    <AppHeader />
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "0 20px 18px",
        alignItems: "center",
      }}
    >
      {["↺", "🖼"].map((g) => (
        <div
          key={g}
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            background: C.surfaceStrong,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 19,
            color: C.muted,
          }}
        >
          {g}
        </div>
      ))}
      <div
        style={{
          flex: 1,
          minHeight: 46,
          height: 46,
          borderRadius: 23,
          background: C.surfaceStrong,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontWeight: 800,
          fontSize: 16,
          color: C.text,
        }}
      >
        All Media <span style={{ fontSize: 13 }}>▾</span>
      </div>
      <div style={{ position: "relative" }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            background: C.surfaceStrong,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 19,
            color: C.green,
          }}
        >
          🗑
        </div>
        <div
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            background: C.red,
            color: "#fff",
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            border: `2px solid ${C.bg}`,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 11,
            padding: "0 5px",
          }}
        >
          {markedCount}
        </div>
      </div>
    </div>

    {/* The swipe deck. Gradients stand in for photos — a real photo would need
        a licensed asset, and the film reads the same with a rich field.
        The NEXT card is always drawn behind the top one: without it the frame
        goes empty for the second that the cleared card is flying off, which
        looks like a bug rather than an edit. */}
    <div style={{ padding: "0 26px", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: 26,
          right: 26,
          height: 470,
          borderRadius: 26,
          overflow: "hidden",
          transform: "scale(0.965) translateY(8px)",
          opacity: 0.92,
          boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
        }}
      >
        <Img
          src={staticFile(CARD_ART[(variant + 1) % CARD_ART.length])}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div
        style={{
          position: "relative",
          height: 470,
          borderRadius: 26,
          overflow: "hidden",
          transform: `translateX(${cardX}px) rotate(${cardRot}deg) scale(${cardScale})`,
          boxShadow: "0 22px 44px rgba(0,0,0,0.42)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 18,
            bottom: 16,
            fontWeight: 800,
            fontSize: 17,
            color: "#fff",
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          }}
        >
          {CARD_NAME[variant % CARD_NAME.length]}
        </div>
        <Img
          src={staticFile(CARD_ART[variant % CARD_ART.length])}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {/* A soft bottom scrim so the filename stays legible over any photo. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 120,
            background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.62))",
          }}
        />
        {/* KEEP / CLEAR verdict stamps, revealed by the drag direction. */}
        {cardX !== 0 && (
          <div
            style={{
              position: "absolute",
              top: 28,
              [cardX > 0 ? "left" : "right"]: 24,
              padding: "10px 20px",
              borderRadius: 14,
              fontWeight: 900,
              fontSize: 24,
              letterSpacing: "0.04em",
              color: "#fff",
              background: cardX > 0 ? C.green : C.red,
              opacity: Math.min(1, Math.abs(cardX) / 90),
              transform: `rotate(${cardX > 0 ? -10 : 10}deg)`,
            }}
          >
            {cardX > 0 ? "KEEP" : "CLEAR"}
          </div>
        )}
      </div>
    </div>

    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "22px 26px",
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          border: `4px solid ${C.surfaceStrong}`,
          borderTopColor: C.green,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12.5,
          fontWeight: 800,
        }}
      >
        {reviewed + variant}/3763
      </div>
      <div style={{ fontSize: 17, color: C.text, fontWeight: 600 }}>
        {CARD_META[variant % CARD_META.length]}
      </div>
    </div>
    <TabBar active={0} />
  </>
);

// ---------------------------------------------------------------------------
// Compress
// ---------------------------------------------------------------------------

export const CompressScreen: React.FC<{ countFrame?: number }> = ({
  countFrame = 999,
}) => (
  <>
    <StatusBar />
    <AppHeader />
    <div style={{ padding: "0 20px" }}>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 33,
          letterSpacing: "-0.025em",
          marginBottom: 8,
        }}
      >
        Ready to Compress
      </div>
      <div style={{ color: C.muted, fontSize: 16.5, lineHeight: 1.35, marginBottom: 18 }}>
        We&rsquo;ve identified 13 GB of heavy media that can be optimized
        without losing quality.
      </div>

      <Card
        style={{
          padding: "16px 18px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 16.5 }}>
          Estimated savings:{" "}
          <Counter
            from={0}
            to={6.6}
            decimals={1}
            startFrame={countFrame}
            durationInFrames={28}
          />{" "}
          GB
        </span>
        <span style={{ color: C.green, fontWeight: 800, fontSize: 15.5 }}>
          ⟳ Estimate again
        </span>
      </Card>

      <Card
        style={{
          padding: "16px 18px",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 17 }}>⇅ Filter</span>
        <span style={{ color: C.muted, fontSize: 15.5 }}>All months · Both</span>
      </Card>

      <div
        style={{
          background: `linear-gradient(96deg, ${C.green} 0%, #14b8c4 55%, #2f7fe0 100%)`,
          borderRadius: 18,
          padding: "18px 20px",
          fontWeight: 800,
          fontSize: 18,
          color: "#04231a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <span>▣&nbsp; Compress a custom file</span>
        <span>›</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          ["promo/grid-01.jpg", "11 MB → 5.3 MB"],
          ["promo/grid-02.jpg", "11 MB → 5.3 MB"],
          ["promo/grid-03.jpg", "11 MB → 5.3 MB"],
          ["promo/grid-04.jpg", "6.3 MB → 3.1 MB"],
          ["promo/grid-05.jpg", "6.3 MB → 3.1 MB"],
          ["promo/grid-06.jpg", "6.3 MB → 3.1 MB"],
        ].map(([src, label], i) => (
          <div
            key={i}
            style={{
              borderRadius: 14,
              overflow: "hidden",
              background: C.surfaceSoft,
            }}
          >
            <Img
              src={staticFile(src as string)}
              style={{ height: 86, width: "100%", objectFit: "cover", display: "block" }}
            />
            <div style={{ padding: "8px 8px 10px", fontSize: 11.5, color: C.muted }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
    <TabBar active={1} />
  </>
);

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const StatsScreen: React.FC<{ countFrame?: number }> = ({
  countFrame = 999,
}) => (
  <>
    <StatusBar />
    <AppHeader />
    <div style={{ padding: "0 20px" }}>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 34,
          letterSpacing: "-0.025em",
          marginBottom: 6,
        }}
      >
        Storage Stats
      </div>
      <div style={{ color: C.muted, fontSize: 16.5, marginBottom: 18 }}>
        Analysis of your visual ecosystem.
      </div>

      <div
        style={{
          background: `linear-gradient(140deg, ${C.green} 0%, ${C.greenDeep} 100%)`,
          borderRadius: 24,
          padding: "22px 24px",
          marginBottom: 16,
          color: "#04231a",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, fontSize: 18 }}>
          ✧ Space reclaimed
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 62,
            lineHeight: 1.05,
            color: "#fff",
            margin: "6px 0 2px",
          }}
        >
          <Counter from={0} to={315} startFrame={countFrame} durationInFrames={30} /> MB
        </div>
        <div style={{ fontWeight: 700, fontSize: 15.5, opacity: 0.85 }}>
          657 items reviewed
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {[
          ["▤", "16 GB", "Total Used", C.green],
          ["🖼", "3,758", "Photos Scanned", C.green],
          ["✧", "315 MB", "Space Cleared", C.green],
          ["🗑", "60", "Marked", C.red],
        ].map(([glyph, value, label, col], i) => (
          <Card key={i} style={{ padding: 18 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                background:
                  col === C.red ? "rgba(248,113,113,0.14)" : "rgba(16,185,129,0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                marginBottom: 14,
              }}
            >
              {glyph as string}
            </div>
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: 27,
                color: col as string,
                marginBottom: 2,
              }}
            >
              {value as string}
            </div>
            <div style={{ color: C.muted, fontSize: 15 }}>{label as string}</div>
          </Card>
        ))}
      </div>
    </div>
    <TabBar active={2} />
  </>
);
