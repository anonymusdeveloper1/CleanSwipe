# SwipeClean — Full UI/UX Redesign Brief

> Purpose: a complete, implementation-grounded description of the existing SwipeClean UI so a designer (or design tool) can recreate a **new** visual design without losing any screen, state, or interaction. Every value below is pulled from the live React Native (Expo) codebase.
>
> **App:** SwipeClean — a photo & video library cleanup app (swipe-to-delete + smart cleanup + compression). Expo SDK 54, React Native 0.81, expo-router, Hermes, Zustand. **System font only** (no custom typeface). Icons: **lucide-react-native**. Brand logo: custom SVG.

---

## 0. Product snapshot & UX principles

SwipeClean helps users reclaim phone storage three ways:
1. **Swipe** — Tinder-style card deck to keep/delete photos & videos.
2. **Compress** — shrink heavy media (and custom files) with quality profiles.
3. **Smart Clean** (Pro) — auto-detect duplicates, similar shots, blurry photos, screenshots, memes, large videos/photos.
Plus **Stats**, a **Premium** paywall, and **Settings**.

**Current design language (what a redesign should preserve or deliberately replace):**
- **Friendly, rounded, "soft-tonal" UI.** Depth comes from *fill tone layering* (background → surfaceSoft → surface → surfaceStrong), **not** drop shadows. Shadows appear in only ~4–5 places.
- **Very heavy typography.** Headings & labels are weight 800–900 almost everywhere.
- **One hero accent color**, user-selectable (5 options), reused identically in light & dark.
- **Heavy use of bottom sheets, full-screen viewers, and centered modal dialogs.**
- **Strong Free-vs-Pro gating** woven through every surface (ads, locks, paywall routing).

---

## 1. Foundations (design tokens)

### 1.1 Color — Light theme
| Token | Hex | Role |
|---|---|---|
| `background` | `#f7f8ff` | App canvas (pale blue-white) |
| `surfaceSoft` | `#edf2ff` | Inset panels, icon chips, stat tiles, pills |
| `surface` | `#ffffff` | Cards, sheets, dialogs, tab bar |
| `surfaceStrong` | `#dde6f8` | Pressed states, segmented track, thumbnail placeholders, progress track |
| `text` | `#111827` | Primary text |
| `muted` | `#4b5563` | Secondary text, inactive icons/labels |
| `faint` | `#c7cfdf` | Disabled icons, grabber handles, Switch off-track |
| `border` | `#dfe7f6` | 1px hairlines & card outlines |
| `green` | `#047857` | Saved / success / "keep" |
| `red` | `#dc2626` | Destructive / delete / error |
| `yellow` | `#f59e0b` | Warning |

### 1.2 Color — Dark theme (mirrors every token)
`background #111827` · `surfaceSoft #253047` · `surface #1f2937` · `surfaceStrong #303d58` · `text #f9fafb` · `muted #cbd5e1` · `faint #64748b` · `border #334155` · `green #34d399` · `red #f87171` · `yellow #fbbf24`. Theme chosen by `settings.darkModeEnabled`.

### 1.3 Accent (brand color — user-selectable, layered on top of either theme)
| Name | Hex |
|---|---|
| **blue (default)** | `#075ec8` |
| purple | `#8b5cf6` |
| green | `#10b981` |
| orange | `#f59e0b` |
| pink | `#ec4899` |

Accent drives: logo, wordmark, active tab, primary buttons, focused borders, progress rings, passcode dots, section headers, icon chips. **Same accent in light & dark** (not re-tinted) — so a redesign should verify accent contrast on dark `surface`.

**Hardcoded non-token colors to watch (candidates to fix in redesign):**
- Tab focus pill background `#dbeafe` — **ignores accent AND dark mode** (always pale blue).
- Scrims: `rgba(15,23,42,0.42–0.5)` (dialogs), `rgba(5,7,13,0.6–0.92)` (media viewers/overlays).
- Chart colors: kept `#5eead4` (teal), deleted `#ef4444` (brighter than theme red), badges `#5eeab0`/`#6ee7b7` mint with `#065f46` text, custom CTA gradient end `#2d7df0`.

### 1.4 Typography (system font; inferred scale)
| Role | Size | Weight |
|---|---|---|
| Display / hero title | 28–30 | 900 |
| Wordmark "SwipeClean" | 26 | 800 |
| Dialog / empty-state / sheet title | 24–26 | 900 |
| Screen heading | 19–22 | 900 |
| Card/section title | 16–18 | 900 |
| Stat value (big number) | 20 | 900 (`tabular-nums`) |
| Run percentage (compress) | 40 | 900 |
| List row title | 15–18 | 600–900 |
| Body / message | 15–16 | 400 (lineHeight ~1.4) |
| Primary button label | 16–17 | 800–900 |
| Settings row title | 15 | 600 |
| Section header (UPPERCASE, letterSpacing 0.4) | 14 | 900 (accent) |
| Caption / sub-line | 12.5–13 | 700–800 |
| Tab label | 12 | 700 |
| Badge / micro | 9–11 | 900 |

Body line-heights ~1.4×. Numbers use `fontVariant:["tabular-nums"]`. Only section headers use letter-spacing + uppercase.

### 1.5 Spacing, radii, shadows
- **Spacing scale (4-based, with frequent in-betweens):** `4, 8, 10, 12, 14, 16, 18, 22, 24, 26, 34`. Screen horizontal padding is **22** on tab screens, **16–20** elsewhere. Card interior padding **16–24**. Empty-state padding **34**.
- **Radii:** controls/chips **8–14**; primary CTAs & tab pill **16**; premium card & segmented inner **18**; dialogs/sheets-as-card **22**; **bottom-sheet / formSheet top corners 28**; icon chips & pad keys = full circle.
- **Shadows (CSS `boxShadow`, soft & sparse):**
  - Tab bar: `0 -6px 18px rgba(15,23,42,0.06)`
  - Premium/CTA: `0 16px 32px rgba(7,94,200,0.22)`, custom CTA `0 8px 22px <accent>4D`
  - Floating CTA (compress detail): `0 13px 28px rgba(7,94,200,0.24)`
  - Scroll-to-top FAB: `0 8px 20px rgba(15,23,42,0.35)`
  - Biometric disc/button: `0 16px 38px <accent>38`, `0 10px 24px <accent>40`

### 1.6 Iconography & motion
- **Icons:** lucide-react-native exclusively; default stroke ~2, bumped to 2.4–3 in chrome and on focused tab icons (2.8). Tinted accent (interactive) / text (neutral) / muted (inactive) / faint (disabled).
- **Motion:** reanimated + Animated. Patterns: card swipe spring + fly-off (300ms), pulsing accent halos (paywall crown, biometric ring ~1.4–1.9s loops), CTA "breathing" pulse, shimmer sweep on compress progress bar (1200ms loop), sheet spring (damping 22 / stiffness 220), drag-to-dismiss scale-down + corner-rounding on full-screen viewers, FadeInDown/Up stagger on paywall. Respects reduce-motion on the lock screen.
- **Haptics:** `Haptics.selectionAsync()` on a committed swipe.

### 1.7 Localization & RTL
- i18next + expo-localization. **11 picker options** (incl. "System default"): English, Español, Português (Brasil), Français, Deutsch, Italiano, Bahasa Indonesia, हिन्दी, العربية, 日本語.
- **Arabic = RTL** (only one). Layout flips via `I18nManager.forceRTL` + reload. Redesign must mirror: header lockup, tab order, chevrons, grabbers, right-aligned dialog buttons, sheet layouts.

---

## 2. Core component library

**Buttons**
- *Primary (accent):* accent fill, radius 14–16, paddingV 14, white label 16–17/800–900; large variants `minHeight 52–62`; press scales ~0.985.
- *Secondary/neutral:* `surface`/`surfaceStrong` fill, 1px border, `text` label 800; pressed → `surfaceStrong`.
- *Destructive:* `red` fill (or `red@14–18` tint + red border + red label), often with `Trash2`.
- *Text button:* label-only, muted or accent, no fill.
- *Circular icon button:* 44–46px circle, `surfaceStrong` (chrome) or translucent black (on media).

**Cards** — `surface` or `surfaceSoft`, radius 12–14, 1px `border`, padding 16. Icon chip = 34–44px rounded-square (radius 8–12) in `surfaceSoft`/`surface` with an accent lucide icon (size 19–24).

**Bottom sheets** — top corners radius 28, `surface` fill, 46×5 `faint` grabber, header row (title 22–24/900 + `X` close), scrim `rgba(15,23,42,0.45)`. Native formSheet (month selector) uses detents `[0.58, 0.92]`, no grabber.

**Centered modal dialog** — scrim `rgba(15,23,42,0.42)`, card `surface` radius 22, padding 24, gap 18, title 24–26/900, body 16–17/muted, right-aligned action row (text Cancel + filled confirm). Icon-led variant adds a 62–64px accent/tinted circle at top.

**Segmented control** — track `surfaceStrong` radius 22 pad 4; active segment = raised `surface` chip radius 18 with accent 15/900 label; inactive muted.

**Toggle (Switch)** — native; track on = accent, off = `faint`.

**Checkbox** — 24×24 radius 7; checked = accent fill + white `Check` (strokeWidth 3); unchecked = 2px `faint` border.

**Chips/pills/badges** — count badge: red circle, white 11/900, 2px background-colored ring; status pill: `surfaceStrong` radius 8, muted 11/900; "PRO" pill: accent fill, white filled `Crown`/`Lock` + label; "best value": mint `#6ee7b7` bg / `#065f46` text.

**Media thumbnail (shared `MediaThumbnail`/`Thumbnail`)** — disk-cached, **downscaled-at-decode** image (`cachePolicy="disk"`, ~512px), `contentFit:"cover"`, `surfaceStrong` placeholder. Videos get a play badge (centered 34×34 black-40% circle, white filled `Play` 17; small 22×22 variant in dense grids). Videos >4096px fall back to a non-decoding placeholder tile (OOM safety — see memory note). **This is the perf-critical primitive; keep the downscale + disk cache behavior in any redesign.**

**Progress** — circular ring (44px, 5px stroke, `surfaceStrong` track + accent arc, center fraction label); linear bar (4–12px track radius 2–6, accent fill); shimmer bar (compress run).

**Empty state** — centered: 74×74 `surfaceSoft` disc + accent lucide icon (34), title 24/900, message 16/muted, optional accent CTA.

**App header (`AppHeader`)** — on every tab screen (not a nav header). `paddingTop = safe-top + 16`, horizontal 22, bottom 18. Left: 32px accent SVG logo + "SwipeClean" wordmark (accent, 26/800). Right: 44×44 `Settings` gear (size 30, `text` color) → `/settings`. Logo = stacked swipe-cards SVG with motion arcs + photo glyph, recolors to accent.

**Ad banner (`AdBanner`)** — Google Mobile Ads anchored adaptive banner (full width, ~50–60px). **Free only** (Pro renders nothing). Docked flush above the tab bar at the bottom of Compress/Stats/Smart Clean/Settings/Premium.

---

## 3. Navigation & information architecture

**Bottom tab bar** — `surface` fill, no top border, soft top shadow, height `72 + max(safe-bottom, 28)` (≥100px). Active tint = accent, inactive = muted. Each icon sits in a 50×28 radius-16 pill that fills `#dbeafe` when focused; icon size 21, stroke 2.8 focused / 2.2 idle; label 12/700.

| # | Route | Label (Free) | Label (Pro) | Icon |
|---|---|---|---|---|
| 1 | `index` | Swipe | Swipe | `Layers` |
| 2 | `history` | **Compress** | Compress | `Archive` |
| 3 | `stats` | Stats | Stats | `BarChart3` |
| 4 | `premium` | **Premium** | **Smart Clean** | `Star` → `Wand2` |

> **Naming caveat:** Tab 2's internal route/file is `history`/`HistoryScreen` but it renders the **Compress** feature (legacy name). Tab 4 is a **single shared route**: Free sees the paywall (Star/"Premium"), Pro sees Smart Clean (Wand2/"Smart Clean"). A redesign should rename for clarity but preserve `/premium` deep-link.

**Stack presentations** (all `headerShown:false`, content bg = `background`):
| Screen | Presentation |
|---|---|
| `settings`, `review-delete-list`, `selected-photos`, `compression-detail`, `smart-clean-review` | `card` (push) |
| `compress-run` | `card`, **gestureEnabled:false** (can't swipe-dismiss mid-run) |
| `month-selector` | **formSheet**, detents 0.58/0.92, radius 28, no grabber |
| `photo-preview` | `modal` |
| `compression-media-viewer` | **transparentModal**, fade |

**Root-mounted overlays** (cover everything): `ProUpgradeSheet`, `SmartCleanPreviewOverlay`, and **`AppLockGate` (mounted last → covers tabs + sheets)**.

---

## 4. Screen-by-screen specs

### 4.1 Swipe (Home / `index`)
Top→bottom: **AppHeader** → **control bar** (4 controls, horizontal, gap 10) → **card deck** (flex) → **progress + metadata row**.

- **Control bar (all 46×46 circles, `surfaceStrong`, radius 23):** Undo (`RotateCcw` 21, accent/faint+0.55 when disabled) · Selected photos (`Images` 22, muted → `/selected-photos`) · **Month pill** (`flex:1`, shows scope label 16/800 + `ChevronDown` → `/month-selector`) · Marked-for-deletion (`Trash2` 22, accent when >0, red count badge "99+").
- **Card:** maxWidth 640, radius 34, `boxShadow 0 18px 34px rgba(15,23,42,0.16)`. Media fills `cover`. Up to **3 cards peek behind** (inset, scaled `1−i·0.025`, nudged down, faded, dark wash 7%); next card animates live with the drag. Bottom filename strip: full-width, `rgba(0,0,0,0.32)`, white 15/700 (ext stripped, `_`→space). **No date/size/type badge on the card** — that lives in the row below.
- **Directional drag feedback:** centered labels minWidth 144, 3px white border, transparent fill, white 28/900 — **"Keep" (+10°, drag right)** and **"Delete" (−10°, drag left)**; opacity ramps with drag (≈0.45 at 38px → full at threshold). Full-card color wash fades in: **green `rgba(4,120,87,0.34)` (keep/right)** / **red `rgba(220,38,38,0.34)` (delete/left)**.
- **Gestures:** **left = Delete, right = Keep. No up/down action** (vertical damped). Claim drag at `|dx|>8` & horizontal-dominant. Commit threshold `min(130, width·0.28)` or velocity `|vx|>0.75`. Rotation −9°…+9°, slight scale to 0.96. Fly-off 300ms; snap-back spring. **Tap = open full-screen preview.** Haptic on commit.
- **Progress row:** 44px ring (track `surfaceStrong`, accent arc, center `12/240` 10/900) + metadata line muted 15/21 `"<date> · <size> · <resolution>"`.
- **On-card video:** autoplay, loop, **starts muted**, no native controls; mute toggle top-right (42×42 black-44% circle, `VolumeX`/`Volume2`). Player **unmounts on focus loss** (decoder safety).
- **States:**
  - *End of deck "complete":* 74×74 `surfaceSoft` disc + `CheckCircle2` (accent), title 25/900, message; buttons "Review Delete List (n)" (accent), "Start Over" (`RotateCcw`), "Next Month: …"/"Choose Month" (`ArrowRight`).
  - *No media:* EmptyState with `BrushCleaning` broom.
  - *Permission onboarding:* EmptyState `BrushCleaning`, title **"Allow media access"**, message about Photos & Videos access. Button = **"Allow Access"** (→ "Requesting…") + secondary **"Open Settings"** link; when permanently denied (`canAskAgain:false`) primary becomes **"Open Settings"** (system). Granted/Limited both bypass straight to the deck.
  - *Loading:* centered accent spinner + "Loading your media library…".
  - *RestartBlocked dialog:* if Start Over with pending marks → modal "Delete marked items first" + "Review Delete List".

### 4.2 Photo preview (full-screen `modal`)
Near-black `#05070d`. Tap toggles chrome. **Photo:** `CachedImage` `contain`; pinch zoom 1–4×, pan when zoomed, tap resets zoom. **Video:** `contain`, autoplay/loop, faint top scrim; center 78×78 white-17% play/pause (`Play` filled / `Pause`). **Top chrome:** gradient scrim + two 46×46 white-16% circles — `ArrowLeft` (back), `Share2` (native share). **Bottom chrome:** gradient + title (white 19/900) + metadata (white 72% 13/700, video shows duration). **Action row** (each flex, minHeight 54, radius 12): if marked → single **Restore** (neutral, `RotateCcw`); else **Keep** (green, `Check`) + **Delete** (red, `Trash2`).

### 4.3 Month selector (formSheet)
`surface`, top radius 28, grabber 46×5 faint. Header "Select Month" 24/900 + `X`. **Media-type segmented control** All/Photos/Videos. **Month list:** first row "All …"; each row minHeight 58, radius 12, 1px border, **leading 42px progress ring** (`cleared/total`), two-line text (month 18/900 + `"<count> <noun> · <size>"` 13/700). Selected = accent border + `surfaceSoft` fill + accent label + trailing `Check`. Tap selects & closes.

### 4.4 Compress (`history` / "Compress")
One vertically-scrolling 3-col FlashList; the hero is the list header (scrolls away). AdBanner pinned below; scroll-to-top FAB floats.
- **Hero text:** "Ready to Compress" 24/900 + subtitle (muted) summarizing heavy-media total (`formatBytes`).
- **Savings estimate pill** (compact, *not* a big hero): `surfaceSoft` bar minHeight 36 radius 8 — `"Estimated savings: <value/Estimating…/Not calculated>"` + an **"Estimate now"** button (`RefreshCw` 13 accent; cycles "Estimate again"/"Estimating…").
- **Filter row:** full-width `surfaceSoft` bar minHeight 46 — `SlidersHorizontal` (accent) + "Filter" + right summary `"All months · Both"` → opens filter dialog.
- **"Compress a custom file" CTA** (the brand gradient): minHeight 54 radius 14, **LinearGradient accent→`#2d7df0`**, colored shadow; white `FileUp` chip + label 16/900 + `ChevronRight`.
- **Media grid:** 3 cols, gap 8, edge pad 16 (14 < 380px), cell `aspectRatio 0.92`, radius 12. Cell = thumbnail + bottom dark scrim gradient + caption: filename (white 12/800) + **`"<original> -> <compressed>"`** (white-88% 10/700). Video play badge bottom-left. Tap → compression-detail. Already-compressed items are excluded. Paginates 60 at a time (footer spinner).
- **Filter dialog (bottom sheet):** segmented Both/Photos/Videos + month list (rows with `"<count> · <size>"`, selected = accent border + `surfaceSoft` + `Check`). Selecting a month applies & closes.
- **States:** not-hydrated spinner; permission EmptyState; **empty** = `Images` "No heavy media" + "Refresh"; scanning spinner + "Estimating…"; loading-more footer; FAB appears after 600px scroll (48px accent circle, `ArrowUp`).

### 4.5 Custom-file & video compress (ad-gated)
- **Pro:** opens OS picker immediately → `compress-run` (Keep-only).
- **Free:** daily quota (`FREE_DAILY_CUSTOM_LIMIT` / `FREE_DAILY_VIDEO_LIMIT`). Quota left → **ad dialog**; quota exhausted → `/premium`.
- **Ad dialog (centered modal):** 62px `surfaceStrong` circle + `FileUp`/`Video` (accent), title 22/900, body, **quota badge** pill (`Gift` + "<n> of <N> free today"), Cancel + **"Watch ad"** (accent). Confirm → rewarded ad → on reward, record quota + open picker.

### 4.6 Compress run (`compress-run`, gesture-locked)
- **Running:** media preview (flex, radius 18, `cover`) → big **percentage 40/900 accent** → **shimmer progress bar** (12px, accent fill + sweeping white highlight) → live size row `realBytes → ArrowRight → liveCompressed (green, ticking down)` → "Compressing…" with cycling dots → **Cancel** (neutral). Cancel = confirmation modal (red `AlertTriangle` disc, "Keep compressing" accent / "Cancel" destructive).
- **Done:** result preview card (height 260, tap → comparison viewer via `Maximize2`), `CheckCircle2` + "Compressed!", summary card (Original/Compressed/**You saved** green), decision buttons **Delete original** (red, hidden for custom) / **Keep original**/"Done". **Delete passcode gate** if App Lock on (PIN modal w/ `Lock` disc + PasscodePad).
- **Failed:** `AlertTriangle` (accent), "Finished", error, **Close** + **Retry**.

### 4.7 Compression detail (`compression-detail`)
Custom header (`ArrowLeft` accent / title accent / `Settings`). Body: type row (`Video`/`BrushCleaning` + title + green codec badge "HEVC High") → **MediaPreview** (radius 16, info chips for resolution/duration/type, tap → viewer) → **metrics bar** (Original `text` / Reduced **green** / Save **accent**, 1px dividers) → **Compression quality** Low/Medium/High **QualityCards** (1.3px border, selected = accent border + soft shadow; icons `SlidersHorizontal`/`BrushCleaning`/`Sparkles`; subtitles Max savings/Balanced/Best quality). **Free is pinned to Medium** — other cards dimmed 0.7 w/ `Lock`, tap → paywall. Info panel (`Info` + description). Inline status/decision panels per job state. **Floating bottom Compress CTA** minHeight 62 radius 14 accent + `Sparkles`, label state-driven ("Compress now"/"Compressing NN%"/"Compressed").

### 4.8 Compression media viewer (`transparentModal`, fade)
Pure black `#05070d`. **Standard:** media `contain`; **drag-down to dismiss** (scales to 0.84, corners → 24px, backdrop fades); top scrim + 44×44 back circle + "Swipe down" hint pill; video center 74×74 play/pause. **Result mode** (Android post-compress): drag disabled, mounts the **CompressionResultSheet**. **Comparison mode:** pinch-zoom 1–4× + a bottom **"Compressed / Original" segmented toggle** (`rgba(31,41,55,0.88)` track, sliding `#075ec8` indicator) that swaps the displayed URI.

### 4.9 Compression result sheet
Draggable bottom sheet that rests in a 92px **peek** (never fully dismisses). Peek: drag handle + status icon (`CheckCircle2` green if saved / `AlertTriangle` accent) + title "Compressed!"/"Finished" + subtitle **"You saved <size>"** + rotating `ChevronUp`. Expanded: summary card (Original/Compressed/**You saved** green) + decision buttons (**Delete original**/**Delete compressed copy** red + **Keep original**), busy spinner.

### 4.10 Smart Clean (Pro; tab 4 when Pro)
ScrollView, 20px inset, 14px gaps. **Title** `Wand2` + "Smart Clean" 24/900 + subtitle. Optional **limited-access notice** card. **Scan CTA** (full-width accent, `Search`/"Scan now" → `RefreshCw`/"Scan again"; disabled w/ live "Indexing gallery · n" while indexing). **Scanning card:** spinner + label ("Scanning {c} of {t}…" / "Analyzing photos…") + **Stop** chip + 6px accent progress bar + "keep using the app" note. (Android foreground-service notification mirrors progress with a Stop action; auto-resumes after interruption.) **One-Tap Recommendations** card (`Sparkles`, "Reclaim about {size} across {count}" + accent "Review all").
- **8 category cards** (`smart-clean-card`, fixed order): Duplicate photos (`Copy`) · Similar photos (`Images`) · Duplicate videos (`Film`) · Blurry photos (`Aperture`) · Screenshots (`Smartphone`) · Memes (`Smile`) · Large videos (`Video`) · Large photos (`Image`). Each: `surfaceSoft` radius 14, 40×40 `surface` icon chip (accent 22), title 16/900 + 2-line description, status pill ("Not scanned"/"Nothing found"), stats row **"{n} found"** + **"{size} reclaimable"** (green), and an action button — ready→**"Review {n} items"** (accent + `ChevronRight`), locked→**"Unlock with Pro"** (`Lock`), scanning→spinner "Scanning…", empty→disabled "Nothing found".

### 4.11 Smart Clean review (`smart-clean-review`)
Full screen. Header: `ArrowLeft` + category title 19/900 + subtitle "Keeping the best — review the rest". **Grid:** FlashList **4 cols** (3 < 380px), gap 8, cells square radius 10. **Border encodes state:** keeper = 2px green; selected = 2px red; idle = 1px border. **All non-keepers pre-selected on open** (user deselects to keep). Top-right 22px checkmark (selected = red fill + white `Check`; idle = black-35%). Keeper badge top-left = green pill `ShieldCheck` + "KEEP" (not toggleable). Tap toggles; **long-press → preview overlay**. Clusters flattened into one grid (grouping shows only via KEEP badges). **Sticky bottom bar:** "{size} selected" (left) + **"Delete {count}"** red button (right) → confirmation dialog.

### 4.12 Smart Clean preview overlay (root-mounted, full-screen)
Covers the review grid without unmounting it (preserves selection). Black backdrop fades on drag. Media centered (`CachedImage` contain / custom video). Top-right 44×44 black-50% `X`. **Drag-down to dismiss** (scale 0.86, corners 22px). Tap-to-close (photos). **Custom video controls:** center 72×72 play/pause + bottom bar (mute, current time, white scrubber w/ 14px thumb, duration). **Pure viewer — no in-overlay keep/delete.**

### 4.13 Review / Marked-for-deletion (`review-delete-list`)
Header `ArrowLeft` + "Marked for Deletion" (accent 20/900). **Summary card:** "{n} photos/videos" 20/900 + "{size} selected" + 44px light-red `#ffd8d5` disc w/ red `Trash2`. **Month-grouped grid** (3 cols, gap 12, radius 10): each month section header (label 16/900 + "{count} · {size}"); tiles with top-right 28px white **Restore** circle (`RotateCcw` accent) + tap → preview. **Fixed bottom bar:** full-width **dark-red `#c9171d`** "Delete Selected ({n})" + `Trash2`. → confirmation dialog → **OS-native delete-consent dialog** (`MediaLibrary.deleteAssetsAsync`) → success `Alert` "Cleanup complete" ("{size} cleared / {n} deleted"; Free may see a capped interstitial). **Empty:** `Images` "No … marked for deletion." + "Swipe left to queue them here."

### 4.14 Selected photos / "All Media" (`selected-photos`)
Header `ArrowLeft` (30) + scope label (accent 19/900) + "{n} · {size}". **Grid 3 cols, gap 10, tiles radius 14.** Tile = thumbnail; **Mark button** top-right 32px circle (`Trash2` — unmarked: `surface`+red icon; marked: red fill + white icon + red-16% tile overlay + red border). Tap body → preview. **Empty:** `BrushCleaning`. Per-tile marking (no bulk bar); feeds the marked-for-deletion queue.

### 4.15 Stats
ScrollView, 20px inset, gap 20. **Title** "Stats" 22/900 + subtitle. **2×2 stat-card grid:** Total used (accent) · Space cleared (green) · Photos scanned (accent) · Marked (red). Stat card: `surfaceSoft` minHeight 84 radius 13, label 15/muted + value 20/900 tabular (tone-colored, no icon). **Swipe distribution chart:** `surfaceSoft` card radius 22; 150px **pie** (solid wedges) — Kept `#5eead4` / Deleted `#ef4444` / Restored accent; legend rows (12px dot + "{%} {label}" + right-aligned count); empty = `ChartPie`. **Advanced stats:** Free → locked upsell card (`BarChart3` chip + "Unlock" accent CTA → paywall); Pro → weekly/monthly stat rows + **Storage trend** horizontal bar list + **Cleanup/Compression history** lists (36px event-colored icon badges: `Wand2`/`Archive`/`ArrowDown`/`AlertTriangle`/`Trash2`, 2-line text, green bytes-freed pill). AdBanner (Free).

### 4.16 Premium / Paywall (`premium`; Pro sees Smart Clean instead)
Centered column (max 680), staggered FadeIn. **Hero:** pulsing accent halo behind 78px accent circle w/ white filled **`Crown`** (38); title 30/900 + subtitle. **"What's included" card:** `surface` radius 18, **1.5px accent border**; tinted header "Included" + accent "PRO" pill; 4 feature rows (38px accent-tint chip + label 15/800 + green `Check`): `Wand2` Smart Clean · `Video` Video compression · `BarChart3` Advanced stats · `ShieldOff` No ads. **Plans — yearly + monthly only** (no lifetime, no explicit trial UI). Radio cards (22px radio; selected = 2px accent border + 7% accent tint); **yearly default-selected** with mint "best value" badge; prices from RevenueCat `priceString` ("Loading…"/"Unavailable" states; unavailable dimmed 0.55). **Primary CTA:** full-width accent minHeight 58 radius 16, glossy white top-highlight gradient + breathing pulse, white `Crown` + "Start yearly/monthly". **Restore** text button (`RotateCcw` accent). Faint legal line. Entitlement = `CleanSwipe Pro`. Purchase/restore results via native `Alert`. (`premium-card.tsx` is **dead code** — ignore.)

### 4.17 Pro upgrade sheet (root-mounted)
Opens when a Free user taps any gated feature. Centered modal, scrim `rgba(15,23,42,0.5)`. Card `surface` radius 22; 64px accent circle + white `Sparkles`; title 22/900 + per-feature message; **"Upgrade"** (accent → `/premium`) + **"Maybe Later"** (text). Doesn't purchase — routes to the paywall.

### 4.18 Settings
ScrollView, 18px inset, gap 18. Header: `ArrowLeft` + "Settings" 22/900. **Grouped sections** (`SettingsSection`: UPPERCASE accent header 14/900 + `surface` card radius 13 clipping rows). **Rows** (`SettingsRow`: minHeight 58, 34px `surfaceSoft` accent icon chip + title 15/600 + optional 2-line subtitle + trailing control; 1px dividers; disabled = 0.5):
- **Account & Security:** Biometric auth (`Fingerprint`, toggle) · App Lock (`Lock`, toggle → passcode setup/verify modal) · Change passcode (`KeyRound`, chevron — only when lock on).
- **Appearance:** Dark mode (`Moon`, toggle) · **Accent color** (`Palette` + **5 swatches**: 28px circles; selected = 2px self-color ring around 18px dot; tap applies instantly).
- **Language:** (`Languages`, chevron + current label) → **language picker dialog** (centered modal, 11 options, native names, selected = `surfaceSoft` + accent border + `Check`).
- **Permissions:** Photos & Videos (`Images`, live access label; trailing = "Full access" accent pill if limited, else checkbox) · Notifications (`Bell`, checkbox).
- **Notifications:** Allow notifications (master `Bell`) + Cleanup (`Layers`) / Compression (`Archive`) / Pro (`Star`) sub-toggles (disabled at 0.5 when master off).
- **Compression:** Compression quality (`Gauge`, chevron + "{label} · {fidelity}") → quality picker dialog.
- **Support:** Upgrade to Premium (`Star`, Free only) · Cancel subscription (`XCircle`, active only) · Leave feedback (`ToggleLeft` → mail) · Report a bug (`Bug` → mail) · Privacy policy (`ShieldCheck`).
- **Footer:** AdBanner (Free) + faint "Made by…" credit. (No version row; Restore lives on the Premium tab.)

### 4.19 App Lock gate (root-mounted, full-screen, zIndex 1000)
Three states: **resolving** (logo 58 + accent spinner) · **biometric** (logo 48; centered breathing accent ring + 138px `surfaceSoft` disc w/ `ScanFace`/`Fingerprint` accent 62; title 28/900 + subtitle; primary accent "Unlock" minHeight 56 + secondary "Use Passcode") · **pin** (logo + title 22/900; **PasscodePad**: N 16px dots (accent, red+shake on error) + 76px circular keys `surfaceSoft` digit 28/700 + biometric/`Delete` keys; optional "use biometric" link). Fails open if no passcode configured.

---

## 5. Cross-cutting patterns

- **Free vs Pro (gating).** Pro unlocks: Smart Clean (all 8 detectors + recommendations), advanced stats, video/batch compression, compress-all/custom, quality profiles (Low/High), faster scanning, history, **no ads**. Free keeps: unlimited swipe-to-delete, photo compression (Medium only), basic stats, manual cleanup, daily-limited custom/video compress (ad-gated). Surfaces: ads only for Free; locked cards show `Lock` + "Unlock with Pro" → ProUpgradeSheet/paywall; tab 4 swaps Premium↔Smart Clean.
- **Ads.** Anchored adaptive banner (Free, docked above tab bar) + rewarded ads (custom/video compress) + capped interstitial (after a delete batch). GDPR/UMP consent gathered before SDK init.
- **Permissions.** Granted/Limited proceed; Denied → EmptyState w/ "Allow Access"/"Open Settings"; Limited shows "Full access" pill in Settings. Limited users get a "scanning only selected" notice in Smart Clean.
- **Deletion.** Always routes through the **OS-native delete-consent dialog**; a denial leaves files untouched. Optional **App Lock PIN gate** before destructive actions. Success/failure via native `Alert`.
- **Performance primitives (do not regress).** All grids use FlashList + the downscaled, disk-cached `MediaThumbnail`; oversized videos use non-decoding placeholders; expo-image memory cache is cleared on background; swipe/preview video players unmount on focus loss. (These fixed real OOM/ANR crashes — see project memory.)

---

## 6. Inconsistencies to reconcile in the redesign

1. **Grid metrics diverge** by screen — Smart Clean review (4-col / gap 8 / radius 10), review-delete (3-col / gap 12 / radius 10), selected-photos (3-col / gap 10 / radius 14), Compress (3-col / gap 8 / aspect 0.92 / radius 12). Unify into one grid system + tile spec.
2. **Tab focus pill `#dbeafe` is hardcoded** — ignores accent & dark mode. Make it tonal/accent-aware.
3. **Chart reds differ** from theme red (`#ef4444` vs `#dc2626`); marked-bar uses `#c9171d`. Consolidate the destructive-red ramp.
4. **Internal vs displayed naming:** route `history` = "Compress"; tab 4 dual-purpose. Rename routes/components for clarity (preserve `/premium` deep-link).
5. **No central type/spacing tokens** — everything is inline. A redesign should introduce a token layer (the scales in §1.4–1.5) so it's themeable.
6. **Dead code:** `premium-card.tsx` unused — the live paywall is `premium-screen.tsx`. Plans are **monthly + yearly only** (no lifetime/trial despite some leftover copy).
7. **Accent on dark surfaces** — verify contrast for all 5 accents on `#1f2937`.

---

## 7. Screen & component inventory (for coverage)

**Screens (13):** swipe, photo-preview, month-selector, compress (history), compress-run, compression-detail, compression-media-viewer, smart-clean, smart-clean-review, review-delete-list, selected-photos, stats, premium, settings. **Root overlays (3):** ProUpgradeSheet, SmartCleanPreviewOverlay, AppLockGate.
**Key components:** app-header, app-logo, ad-banner, empty-state, media-thumbnail/thumbnail/cached-image, swipe-photo-card, video-media-player, month-selector(+bottom-sheet), photo-grid, stats-card, swipe-distribution-chart, advanced-stats-section/locked-card, smart-clean-card, compression-result-sheet, media-compression-overlay, compression-filter-dialog, custom/video-compress-ad-dialog, premium-card(dead), pro-upgrade-sheet, settings-section/row, passcode-pad, app-lock-gate, delete-confirmation-dialog.
**Icon set (lucide):** Layers, Archive, BarChart3, Star, Wand2, Settings, Search, RefreshCw, SlidersHorizontal, FileUp, ChevronRight/Down/Up, Images, Image, Trash2, RotateCcw, Check, X, Play, Pause, Volume2/VolumeX, ArrowLeft/Right/Up/Down, Share2, Maximize2, CheckCircle2, AlertTriangle, BrushCleaning, Copy, Film, Aperture, Smartphone, Smile, Video, ShieldCheck, ShieldOff, Lock, KeyRound, Fingerprint, ScanFace, Delete, Crown, Sparkles, Gift, Palette, Languages, Moon, Bell, Gauge, Info, ChartPie, Bug, ToggleLeft, XCircle, Eye, Gauge. Brand logo = custom SVG (stacked swipe cards + motion arcs + photo glyph).
