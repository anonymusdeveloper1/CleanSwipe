# SwipeClean — App Analysis

_Analysis date: 2026-07-07. Sourced from `PROJECT_CONTEXT.md` (~360 KB), `DESIGN-BRIEF.md`, `CONVERT_PLAN.md`, `package.json`, and the `app/` route structure. No source files were modified._

---

## 1. What the app does & core value proposition

**SwipeClean** (display name "SwipeClean"; Android package `com.cognitix.swipeclean`, slug `swipeclean-free`) is an Expo/React Native mobile app for reclaiming phone storage by cleaning up the device photo/video library. The user grants media-library access and then frees space three ways:

1. **Swipe** — a Tinder-style card deck where a right swipe keeps a photo/video and a left swipe marks it for deletion; marked items are batched into a review queue and only permanently deleted after explicit confirmation.
2. **Compress** — shrink heavy photos and videos (with low/medium/high quality profiles), verified so a re-encode is only kept if it's actually smaller.
3. **Smart Clean (Pro)** — automatic detection of duplicates, near-duplicates, blurry shots, screenshots, memes, and large photos/videos, with a review-then-delete flow.

A Pro **Convert/"Studio"** feature adds on-device media-format conversion, and the app rounds out with **Stats**, a **Premium** paywall, and **Settings**. The core promise is a fast, safe, on-device cleanup utility: destructive actions are always deferred and confirmed, everything runs locally (no cloud upload), and the deletion path is single and audited.

There is **no custom backend, database server, or auth provider**. All state is local and persisted on-device via AsyncStorage. The only external services are RevenueCat (subscription validation) and Google AdMob (ads). The app targets **both Android and iOS with feature parity** (a scope change on 2026-06-29; it was Android-first before), and the repo now tracks both generated native projects (`android/` Kotlin, `ios/` Swift).

---

## 2. Main features & user flows

**Media permission & library loading.** Requests/checks photo+video permission, does a fast "newest page" refresh (page size 80) so recent captures appear immediately, then runs a cooperative full-library scan (pages of 60, yielding between pages) only when no saved full estimate exists yet. Handles `granted` vs `limited` ("selected photos only") access and reconciles the persisted index when access changes.

**Swipe review flow.** A stacked swipe card; right = keep, left = mark for deletion. Tracks reviewed IDs, marks, undo, and month/media-type filters. Only the active card autoplays video (looping, mute/unmute only). When a scope has media but no swipeable cards left, a "completed" panel offers Review Delete List, Start Over (resets only the current month/type, blocked while marked items remain), and Next Month / Choose Month.

**"All Media" gallery grid.** A dense, edge-to-edge FlashList grouped into month sections. Tap opens the previewer; long-press-drag enters a painterly multi-select (paint to select, paint-over-selected to deselect) with edge auto-scroll and a right-edge date scrubber. Selected items batch into the deferred Marked-for-Deletion queue (not an immediate OS delete).

**Marked for Deletion & permanent delete.** A single virtualized FlatList (paginated, PAGE_SIZE 60) grouped by month; restore individual items, confirm, then call `MediaLibrary.deleteAssetsAsync`. State is only updated after the native delete succeeds; the app records deletion history and updates stats.

**Media preview.** Photo pinch/pan zoom with tap-to-toggle chrome; in-app looping video with custom play/pause controls, reachable from library, marked queue, or history.

**Compression cleanup.** Identifies compressible large photos/videos from the shared media index, shows a persisted global savings estimate, queues single or batch jobs, compresses natively, **verifies the output is actually smaller before saving** (a no-gain re-encode fails as "already optimized" rather than writing a larger copy), then optionally deletes originals after user decision. Android has a foreground-service path with progress notifications; iOS is less complete.

**Stats.** Four stat cards (indexed bytes, cleared bytes, indexed count, marked count), an SVG pie chart of swipe distribution (Kept/Deleted/Restored), a Convert lifetime section, and Advanced Stats (Pro). A 2026-07-06 redesign added a gradient hero and count-up animations.

**Settings.** Dark mode, accent-color picker, notification reminders, a 10-language picker, a real Account & Security section (4-digit App Lock passcode via SecureStore + biometric via LocalAuthentication, cold-launch-only lock screen), a Permissions section, and scheduled reminders. Feedback / bug report open pre-addressed email drafts (still placeholders in substance).

**Localization.** Full multi-language UI across every screen via `react-i18next` with device-language detection, a Settings picker, and RTL (Arabic). `en.json` is the canonical key source (~555 keys); parity across all 10 locales is enforced by `npm run i18n:check`.

**Smart Clean (Pro).** 8 real detectors across cheapness tiers (large photos/videos, screenshots, MD5-exact-duplicate photos, memes heuristic, and a pixel pipeline for similar/blurry/duplicate videos using perceptual dHash + variance-of-Laplacian). Scans cheapest-first so fast categories appear in seconds, runs in an Android foreground service, checkpoints continuously, and auto-resumes an interrupted scan on next launch. Per-asset hashes are cached so re-scans are fast. Deletion goes through the same audited path with three layers of "keeper protection."

**Convert / "Studio" (Pro).** A per-item conversion "workbench" in tab 4 (a swipeable `[ Clean | Convert ]` pager). Source-format-aware targets that never offer the file's own format back: images → jpg/png/webp (HEIC/HEIF and GIF-first-frame decode as inputs), video → MP4 / WebM (Android-only) / GIF (iOS-only) plus audio extraction to M4A/WAV (MP3 is code-complete via vendored LAME but currently removed as a product decision). Each format chip appears only where its native engine is compiled in. Stage up to 5 files; conversion is non-destructive.

---

## 3. Architecture & tech stack

**Framework/runtime.** Expo SDK 54, React Native 0.81.5, React 19.1.0, Hermes, New Architecture enabled, TypeScript 5.9 (strict).

**Navigation.** Expo Router 6, file-based routes under `app/`. Route files are thin exports that mount screen components from `src/screens/`. A bottom tab shell (`app/(tabs)/`) has four tabs: Swipe, Compress, Stats, and Premium/Smart-Clean (label+icon swap for Pro). Root layout mounts cross-cutting lifecycle pieces once above the stack (photo-library sync, RevenueCat sync, compression lifecycle, global paywall sheet, global Smart Clean review sheet).

**State management.** Zustand 5 with `persist` middleware over AsyncStorage, following a **one-store-per-domain** convention:
- `useAppStore` (`swipeclean-free-store`) — permissions, filters, review/deletion state, stats, settings. Holds the single audited deletion path `permanentlyDeleteMarked`.
- `useMediaIndexStore` (`swipeclean-media-index-store`) — the **source of truth for gallery assets** (indexed by ID, sorted IDs, compressibility estimates, savings summary, scan cursors, persisted access level). `useAppStore.photos` is intentionally kept empty.
- `useCompressionStore` (`swipeclean-compression-store`), `useSubscriptionStore` + `usePaywallStore`, `useCleanupEventsStore` (append-only ledger, capped at 2000 events), plus Smart Clean and Convert stores.

**Key libraries.** `expo-media-library` (permissions/reads/deletes), `expo-image` (rendering/cache), `expo-video` (playback), `react-native-compressor` (image/video compression + MP4), `expo-image-manipulator` + `jpeg-js` (image convert + perceptual-hash pipeline), `@shopify/flash-list` (virtualized grids), `react-native-reanimated` + `react-native-gesture-handler` (animation/gestures), `react-native-background-actions` (Android foreground service — a **hard singleton** shared by compression and the Smart Clean scan), `expo-notifications`, `expo-local-authentication` + `expo-secure-store` (App Lock), `i18next`/`react-i18next`, `lucide-react-native` + `react-native-svg` + `expo-linear-gradient` (UI), `zustand`.

**Native modules (local Expo modules under `modules/`, Swift + Kotlin behind one JS API, runtime capability-probed).** `SwipeCleanAudioEncode` (video→MP3/M4A/WAV, bundles vendored **LAME 3.100, LGPL**), `SwipeCleanWebm` (Android-only video→WebM/VP8 via MediaCodec + EGL bridge), `SwipeCleanGif` (iOS-only video→GIF via AVAssetImageGenerator + ImageIO), and the legacy `SwipeCleanAudioExtract` (M4A remux fallback). **No FFmpeg anywhere** — a deliberate choice to avoid GPL and keep the binary lean.

**Data-flow shape.** Screens read indexed media through selectors and derive visible sets with `useMemo` + scope filters. Store actions call service files for native work and update state only after success. Foreground-service coordination is one-directional: compression always has priority, a backgrounded scan yields the service, and the scan otherwise runs plain-JS while still checkpointing.

**Testing/quality gates.** `tsc --noEmit` (typecheck), `scripts/check-i18n.mjs` (locale parity), **Vitest** unit tests on pure modules only (feature-access, cleanup-report selectors, hash/convert utils — ~94 tests), **ESLint 9** flat config, and a **Maestro** UI/E2E suite. Store logic, screens, and services remain untested. Note: Vitest 4 requires Node ≥20.19.

---

## 4. Monetization model

**Free vs Pro, gated through a single source of truth.** `src/features/subscription/feature-flags.ts` holds `FREE_FEATURES`/`PRO_FEATURES` arrays and the `FEATURE_TIER` map; components gate with `canUseFeature(key)` and open a global paywall on denial (no ad-hoc `isPro` checks). Moving a feature between tiers is a one-line change there.

**Subscriptions via RevenueCat** (`react-native-purchases`), no custom billing backend. Pro is granted **only** by an active RevenueCat entitlement `CleanSwipe Pro` mapped to `subscriptionStatus === "active"`. Offering id `default`, packages `monthly`/`yearly` (referenced pricing: Monthly €2.99, Yearly €19.99). The former `EXPO_PUBLIC_FORCE_PRO` build flag and `debugProOverride` dev toggle were **deliberately removed (2026-06-12)** and must not return as entitlement paths. Verified end-to-end against the RevenueCat **Test Store**; real Play/App Store purchases still need dashboard products + a store sandbox.

**Ads via Google AdMob** (`react-native-google-mobile-ads`), for non-Pro users only:
- **Banner** on the review-delete success screen and Compress screen.
- **Interstitial** at the delete-success break and after every compression (with a frequency cap).
- **Rewarded** — Free users watch a rewarded ad to unlock a single **video** compression, capped at **2/day** (persisted, reset at local midnight), then routed to Premium.
- A shared full-screen-ad cooldown (`full-screen-ad-gate.ts`) prevents interstitial + rewarded from stacking. A GDPR/UMP consent gather (`AdsConsentService`, fail-open) runs before SDK init.

**Free/Pro split.** Free = swipe keep/delete (unlimited), **unlimited photo compression**, basic stats, manual cleanup, large-file browsing, sort. Pro = **video compression + Compress All**, advanced compression settings, all of Smart Clean (duplicate/similar/blurry/screenshot/meme/large detectors + one-tap recommendations), Advanced Stats, media-format Convert, faster scanning, cleanup/compression history, and **no ads**.

**Release blockers on monetization:** a **real AdMob rewarded ad unit** (currently a Google TEST placeholder in `ad-config.ts`), a configured consent form + Play Data-Safety ad-ID declaration, an iOS AdMob app (the iOS App ID is still Google's sample id), and real store products for RevenueCat.

---

## 5. Notable, unusual & important callouts

**Deliberate architectural decisions.**
- **Single audited deletion path.** All permanent deletes (review-delete and Smart Clean) route through `permanentlyDeleteMarked`, which only mutates state after `MediaLibrary.deleteAssetsAsync` succeeds and honors the OS consent-dialog boolean. Smart Clean deletes only under full (`granted`) access and enforces "keeper protection" in three places.
- **Media index is the one source of truth.** `useAppStore.photos` is intentionally empty; every screen derives from `useMediaIndexStore`. The index is access-aware and prunes stale entries when access downgrades full→limited.
- **A recurring crash class is documented as a rule:** components must subscribe to primitives or stable refs only — never a selector that builds a fresh object/array (`Object.values`/`.map`) from store state, which loops `useSyncExternalStore`. Derived shapes go in `useMemo`; compact persisted data is expanded once on hydrate.
- **No FFmpeg, no GPL.** Format conversion is built from platform APIs + a few vendored libs, capability-probed so an unbuilt platform degrades gracefully instead of crashing.

**Licensing / compliance gotcha (Convert).** LAME 3.100 (MP3) is **LGPL v2**. Android links it as a separate `.so` (comfortable LGPL position); **iOS statically compiles it into the pod, which is a known LGPL §6 "relink-provision" gray zone for an App Store binary that must be resolved before release.** The LAME tree is intentionally **duplicated** (`lame/` for Android, byte-identical `ios/lame/`) because CocoaPods `../` paths silently break `public_header_files`; patches must be applied to both copies and nothing enforces sync. `lame/config.h` is hand-written and load-bearing (three documented config traps around `ieee754_float32_t`, `HAVE_NASM`, and header paths). MP3 is currently removed as a product-facing target even though the code path exists.

**Convert parity gaps & engine limits.** WebM has no iOS side (needs libvpx — not approved); GIF has no Android side (needs a vendored encoder — not approved). WebM v1 is video-only (drops the audio track). Android MP3/WAV buffers the whole PCM stream in memory (~10 MB/min stereo → OOM risk on long videos; iOS streams). GIF caps at 15 s / 10 fps / 150 frames / 480 px. New-format chips only appear after a dev-client rebuild that compiles the matching native module.

**Security & performance audit (2026-07-05).** A multi-agent audit found the persisted media-index row was ~1.5 MB on a 3,339-asset library — approaching Android's 2 MB CursorWindow cliff and `JSON.parse`d on the JS thread every cold launch. Fixes applied: disable iOS iCloud network pulls during scans (`shouldDownloadFromNetwork: false`, the biggest launch win), debounced full-store writes, `android:allowBackup="false"` (plaintext AsyncStorage was ADB/cloud-exfiltratable), `READ_EXTERNAL_STORAGE` capped at `maxSdkVersion 32`, ads moved off the critical path, and a deletion write-back race fixed. **Left unfixed (documented):** no splash-screen gating during iOS JS startup, App-Lock PIN has no attempt lockout and the gate starts unlocked (content can flash during hydration), several unbounded audio buffers, and a WebM MediaMuxer leak on early failure.

**Known issues / technical debt.**
- **Destructive native flows (deletion, compression) are high-risk** and explicitly need real-device testing across Android versions, permission states, limited access, large files, and interrupted jobs.
- A **scoped-storage `EACCES` bug** on Android "selected photos only" access historically blocked compressing camera photos (partially mitigated by re-resolving a readable URI via `getAssetInfoAsync`).
- **6K/8K video-thumbnail OOM** was mitigated with `largeHeap` + raised decode dimensions but is committed-not-yet-rebuilt; the resolution-independent native fix is deferred.
- Detector thresholds want tuning at scale (the screenshot detector over-matches Canva/WhatsApp/downloads; the meme detector is a conservative metadata heuristic with no on-device ML).
- **~88–93 advisory ESLint warnings** remain (mostly React-Compiler/Reanimated `.value` false-positives, set to "warn"). Test coverage is pure-module-only.
- Release Android build **currently uses the debug keystore** — production signing must be configured before release. Debug manifests still carry `SYSTEM_ALERT_WINDOW`.
- Feedback and bug-report remain placeholders; analytics/error-reporting are unimplemented (deliberately removed from Settings).

**Native rebuild discipline.** Because many features are local native modules, changing native deps requires a full rebuild/reinstall — Metro-only reloads into an older APK crash with "Cannot find native module …" errors. App Lock, biometrics, Convert chips, and RevenueCat all follow this "capability-probe + degrade-until-rebuilt" pattern.

**Process norm.** `PROJECT_CONTEXT.md` is a living document with an "AI Agent Rules" section: read it before changes, append a dated Feature History entry after every feature, mark partial work as partial, preserve unrelated changes in the git tree, and keep destructive native changes conservative and confirmed. The file's detailed Feature History (2026-06-07 → 2026-07-06) is the effective changelog.

---

## 6. Quick reference

| Aspect | Summary |
|---|---|
| **Type** | Expo/React Native photo/video cleanup utility (Android + iOS parity) |
| **Core loop** | Swipe keep/delete → deferred review → confirmed permanent delete |
| **Pillars** | Swipe, Compress, Smart Clean (Pro), Convert/Studio (Pro), Stats, Settings |
| **Navigation** | Expo Router 6, file-based, 4 bottom tabs |
| **State** | Zustand + persist (AsyncStorage), one store per domain; media index is source of truth |
| **Backend** | None — fully on-device; RevenueCat (subs) + AdMob (ads) only |
| **Monetization** | Free vs Pro via RevenueCat entitlement `CleanSwipe Pro`; AdMob banner/interstitial/rewarded for Free |
| **Native modules** | Audio encode (LAME MP3/M4A/WAV), WebM (Android), GIF (iOS); no FFmpeg |
| **i18n** | 10 languages, en.json canonical (~555 keys), parity-enforced, RTL for Arabic |
| **Testing** | typecheck + i18n-check + Vitest (pure modules) + ESLint + Maestro E2E |
| **Biggest release blockers** | Real AdMob units + consent, store products, production signing, iOS LAME/LGPL static-link resolution, real-device QA of delete/compress |
