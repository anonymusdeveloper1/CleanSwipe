# SwipeClean — Website Brief (analysis snapshot)

> **Dated one-shot snapshot: 2026-08-25.** Same status as `APP_ANALYSIS.md` /
> `DESIGN-BRIEF.md` / `SECURITY_SCAN.md` — check this date against
> `PROJECT_CONTEXT.md` §11 before trusting it. Produced from a 7-dimension
> code audit with an adversarial fact-check pass over every claim; **code was
> treated as authoritative over docs throughout**, which is why several
> `PROJECT_CONTEXT` §4/§10 statements are marked stale below.
>
> Purpose: the factual substrate for a marketing website (§9 covers landing it
> in this repo without touching the RN app). No design decisions are made here.
>
> **Contains internal detail** — signing-certificate fingerprints, AdMob unit
> IDs, open security findings. Do not publish this file or link it from the site.

## Corrections applied after the audit

- **`outputs/marketing/reels/2026-07-05/screenshot-avalanche.mp4` is NOT
  crop-and-ship.** §8 recommends it for launch; I opened the poster. It is
  SwipeClean-branded and on brand-green, but the logo is a rounded-square
  card-stack (not the ring mark), the internal working title "The Screenshot
  Avalanche" leaks in the top-right of every frame, and the phone shows an
  invented chat UI, not the app. Treat it as **needs rework**, same as the other
  four — it is merely the *least* far from shippable.
- Verified independently: the repo **is public**
  (`gh api repos/anonymusdeveloper1/CleanSwipe` → `"private": false`, 6,824 KB,
  Pages off); the five SwipeClean-branded reels **do** exist at
  `outputs/marketing/reels/2026-07-05/` (~57.6 MB video + 8.0 MB posters);
  **"Compress All" is genuinely gone** — `grep -rn compressAll src/ app/` returns
  only the dead flag string (`feature-flags.ts:30`) and one stale comment
  (`history-screen.tsx:127`), confirming `PROJECT_CONTEXT` §4's long description
  of it is wrong.
- **The Play listing is live and was read directly** (not just inferred from
  `PLAY_RELEASE.md`): title **"SwipeClean: Photo Cleaner"**, developer
  **CognitiX**, category Tools, updated Aug 22 2026, **5+ downloads**, no rating
  yet, "Contains ads · In-app purchases", content rating Everyone. Play's own
  Data safety panel reads **"No data collected"** and **"No data shared with
  third parties"**. This partially settles §6 Q18 — the app is on the public
  production track, not a beta. No price is shown on the listing page.
- The Play listing's privacy-policy link resolves to
  `https://effervescent-douhua-6f5c1d.netlify.app` — confirmed live, titled
  "Privacy Policy for SwipeClean", effective 2026-07-07, contact
  `info.cognitix@gmail.com`, company rendered as "Cognitix team".

---

# SwipeClean — Authoritative Marketing-Site Brief
*Synthesis of 7 fact-checked dimension audits. Code is authoritative over docs throughout. Every claim carries file:line evidence. Adjudications between conflicting reports are marked **[ADJ]**.*

---

## 1. What the product actually is

SwipeClean is a free, ad-supported **Android** photo/video cleanup app built in Expo/React Native. Its core loop is a Tinder-style card deck over your camera roll: swipe right to keep, left to mark for deletion — nothing is deleted at swipe time. Marked items land in a deferred review queue that you must explicitly confirm before the OS delete runs. Around that sit three more pillars: a **compression** flow (free unlimited for photos, quota'd for video) that verifies a copy is genuinely smaller before it will let you delete an original; **Smart Clean** (Pro), 8 heuristic detectors that surface duplicates, near-duplicates, blurry shots, screenshots, memes and oversized media; and a **Convert studio** (Pro) for on-device format conversion. There is **no backend, no account, no sign-up, and no cloud upload of media** — a repo-wide grep for `fetch(`/`axios`/`XMLHttpRequest`/`uploadAsync`/`WebSocket` across `src/` and `app/` returns zero application network calls (only two `Image.prefetch` calls on local URIs at `src/components/swipe-photo-card.tsx:57`, `src/services/image-cache-service.ts:15`). All state is local (AsyncStorage + Zustand persist).

**Canonical public name: `SwipeClean`.** Nothing else may appear on the site.

| Where it appears | String | Status |
|---|---|---|
| `app.json:3` `name` | SwipeClean | ✅ canonical |
| `src/i18n/locales/*.json` `common.appName` (all 10) | SwipeClean | ✅ canonical |
| `app.json:4` `slug` / `package.json:2` | swipeclean-free | ❌ internal only |
| Repo directory | PhotoSweep | ❌ historical |
| Git remote (`github.com/anonymusdeveloper1/CleanSwipe`) | CleanSwipe | ❌ historical |
| `revenuecat.service.ts:15` entitlement id | `CleanSwipe Pro` | ❌ internal, never surface |
| `outputs/creative/cleanswipe-remotion/` | CleanSwipe | ❌ historical (poisons 10 ad renders — see §8) |
| `app.json:12,19` bundle/package | `com.cognitix.swipeclean` | ✅ real app id |

**Brand-entity spelling is inconsistent in the shipped app.** Settings footer reads **"SwipeClean by Cognitx team"** (`src/i18n/locales/en.json` `settings.madeBy`, all 10 locales) — missing an "i" — while the signing certificate is `CN=Cognitix, O=Cognitix, C=US` (`PLAY_RELEASE.md:19-20`), the support address is `info.cognitix@gmail.com` (`src/config/contact.ts:21`) and the package is `com.cognitix.swipeclean`. **Cognitix** is almost certainly correct; the footer is a typo shipped in build 7. Owner must confirm before any footer/About copy is written.

---

## 2. Feature truth table

Source of truth for tiering is one file: `src/features/subscription/feature-flags.ts` (FREE_FEATURES = 11 keys at :13-25; PRO_FEATURES = 20 keys at :27-47). **Do not build the marketing table from that file directly** — it contains 6 dead keys (see the limits list below).

| Feature | What it does (user words) | Free / Pro | Platform | Confidence |
|---|---|---|---|---|
| **Swipe deck** | Swipe right to keep, left to mark for deletion. Photos *and* videos, unlimited. Undo the last swipe. Scope by month and media type. | **Free** | Android (iOS unreleased) | certain — `src/screens/swipe-screen.tsx:38,156`; `src/store/app-store.ts:394-432` |
| **Deferred delete queue** ("Marked for Deletion") | Month-grouped grid of everything you marked, with per-item Restore, then one confirm that deletes the whole in-scope queue. | **Free** | Android | certain — `src/screens/review-delete-list-screen.tsx:24,40-41,90,104` |
| **All-Media gallery** | Dense 3–6 column month-sectioned grid; long-press-drag to paint a multi-selection, edge auto-scroll, right-edge date scrubber, batch Trash → marks (never deletes). | **Free** | Android | certain — `src/screens/selected-photos-screen.tsx:57,78,229,296,435,491` |
| **Photo compression** | Shrink big photos. Unlimited, no ad, no cap. Output is JPEG. | **Free** | Android | certain — only entitlement branch in the flow is `mediaType === "video"` (`src/screens/compression-detail-screen.tsx:130`); `photoCompression` has zero call sites |
| **Compression quality presets** (Low / Medium / High) | Choose Max savings / Balanced / Best quality. | **Free** — `advancedCompressionSettings` is in FREE_FEATURES | Android | certain — `feature-flags.ts:19`; the paywall branch at `compression-detail-screen.tsx:155-160` is unreachable dead code |
| **Before/after comparison** | Full-screen animated Compressed↔Original toggle, pinch-zoom to 4×, drag to dismiss. | **Free** | Android | certain — `src/screens/compression-media-viewer-screen.tsx:35,190-196,298-320` |
| **Video compression (library)** | Compress a big video. Free = **2 per day** behind a rewarded ad, then routes to the paywall. Pro = unlimited, no ad. | **Free (2/day, ad) / Pro (unlimited)** | Android | certain — `src/features/compression/free-video-quota.store.ts:7`; `compression-detail-screen.tsx:130-155` |
| **"Compress a custom file"** | Pick any photo/video from the system picker (outside the gallery index) and compress it. Free = **1 per day** behind a rewarded ad. Keep-only (no delete-original). | **Free (1/day, ad) / Pro (unlimited)** | Android | certain — `free-custom-compress-quota.store.ts:7`; `history-screen.tsx:184-208`; `compress-run-screen.tsx:36-38` |
| **Smart Clean** — 8 detectors | Scan the library and surface deletion candidates by category, with one keeper protected per group. | **Pro** | Android (foreground service Android-only; iOS foreground-only) | certain — `useRequireProFeature("smartClean")` at `smart-clean-review-screen.tsx:48`; per-detector `canUseFeature(detector.featureKey)` at `smart-clean-screen.tsx:130,156,363` |
| **One-Tap Recommendations card** | Aggregates every ready, entitled detector into one review target: "Reclaim about {size} across {count} items." | **Pro (by location, not by flag)** | Android | certain — `smart-clean-screen.tsx:145-176,330-346`; the `oneTapRecommendations` key itself is never checked |
| **Convert studio** | Convert images/video, extract audio. Per-item target picker, up to 5 files per batch, non-destructive. | **Pro** | Android (targets differ per OS) | certain — `useRequireProFeature("mediaFormatConvert")` at `convert-run-screen.tsx:37`, `convert-batch-run-screen.tsx:33`; `convert-screen.tsx:22` MAX_BATCH=5 |
| **Basic Stats** | Gradient hero with animated "space reclaimed" + items reviewed; 4 tiles (Total Used / Photos Scanned / Space Cleared / Marked); Kept-Deleted-Restored pie. | **Free** | Android | certain — `src/screens/stats-screen.tsx:69-110`; `src/components/swipe-distribution-chart.tsx:31-36` |
| **Advanced Stats** | This week (items removed · space reclaimed), Last 30 days (items removed · compressed), a 6-week trend chart, last-12 cleanup and compression history lists. | **Pro** | Android | certain — `advanced-stats-section.tsx:35-39,60-84`; `stats-screen.tsx:121` |
| **Conversions stats** | Converted / Processed / Images / Videos / Audio. | **Pro** | Android | certain — `stats-screen.tsx:112-118` |
| **App Lock** | 4-digit PIN (salted SHA-256 in secure store) + optional biometric. Re-locks 15 s after backgrounding. Also gates "Delete Original". | **Free** | Both (labels branch Face ID / Face Unlock) | certain — `src/services/app-lock-service.ts:31-33,66,300`; `src/components/app-lock-gate.tsx:17,126-136,241-245` |
| **Dark mode + 5 accent colors** | Manual toggle (defaults to light) and a 5-swatch accent picker. | **Free** | Both | certain — `src/hooks/use-app-theme.ts:8`; `src/services/settings-service.ts:8-9`; `settings-screen.tsx:411-437` |
| **10 UI languages + RTL** | System default plus 10 languages; Arabic is RTL. | **Free** | Both | certain — `src/i18n/languages.ts:3,5,13-25`; CI-verified 498 keys, 9 non-reference locales in parity, 0 orphans |
| **Reminder notifications** | Cleanup reminders daily 11:00 & 18:00; compression reminders Mon/Wed/Fri 18:00; Pro reminders Sun 12:00. All gated on a master toggle + OS permission. | **Free** | Android (local only, no push) | certain — `src/services/reminder-notification-service.ts:29-41,115-117` |
| **Ads** | Banner on 4 reachable screens, interstitial after a delete batch and after each compression, rewarded video to unlock quota. | **Free only** — `noAds` is Pro | Android | certain — see §5 |
| **Share / open-with** | Share a photo or a converted file to any app you pick. | **Free** | Both | certain — `src/screens/photo-preview-screen.tsx:63`; `src/features/convert/open-media-file.ts:41` |

### Limits and exact numbers (publishable)

**Smart Clean — exactly 8 detectors.** Card/display order (`smart-clean.service.ts:24-33`): duplicate photos · similar photos · duplicate videos · blurry photos · screenshots · memes · large videos · large photos. Scan order is cheapest-first (`:42-51`) so fast categories fill within seconds.
- Thresholds (`src/features/smart-clean/detectors/thresholds.ts`): dHash similar ≤10/64 bits (:17), dHash duplicate-video ≤6 (:20), blur variance <120 on a 64×64 grayscale frame (:23), screenshot aspect tolerance 0.03 with classify score 2 (:31,34), meme ≤600 KB / ≤1280 px long edge / classify threshold 0.5 (:39,42,45). Large video in Smart Clean = ≥8 MB **or** ≥20 s duration (`tier0-large.ts:10-17`) — a *different* rule from the compression eligibility one.
- **[ADJ] Runtime gating.** The `features` report (alone) found all 8 detectors are capability-probed: tier-0 (large photos/videos) and screenshots are pure metadata and always work; duplicate photos needs `ExpoFileSystem`; similar/blurry/duplicate-videos need `ExpoImageManipulator` (`native-capabilities.ts:19-53`; `tier1-duplicate-photos.ts:10-11`; `tier2-*.ts:10-13`). Both packages are production dependencies so a full prebuild should compile them in, but **the repo holds no on-device verification of detector output for the published build 7.** Verdict: say "8 detectors"; do not promise all 8 return results on every device until someone checks build 7 on hardware.

**Compression eligibility** (`src/services/compression-service.ts:58-70`): photo offered at ≥5 MB **or** ≥8,000,000 px; video offered at ≥8 MB **or** bitrate ≥4 Mbps.
**Compression profiles** (`compression-service.ts:22-56`): Low (q 0.35 / 1080 px / 720p / est. ~80% smaller), Medium (0.55 / 1600 px / 1080p / ~50%, default), High (0.9 / 4096 px / 2160p / ~20%). Video bitrate is clamped to `min(target, source × ratio)` so output is **always** below source (`:12-18`).

**Convert formats — platform-split, never present as one list** (`convert-targets.ts:15-21`, `:110-127`):

| | Images | Video | Audio |
|---|---|---|---|
| **Android (shipped)** | JPG, PNG, WebP | **MP4, WebM** | M4A, WAV |
| **iOS (built, unreleased)** | JPG, PNG, WebP | **MP4, GIF** | M4A, WAV |

WebM module is `platforms:["android"]` (`modules/swipe-clean-webm/` has `android/` only, verified). GIF module is `platforms:["apple"]` (`modules/swipe-clean-gif/` has `ios/` only, verified) — and `privacy` confirmed the string `SwipeCleanGif` is **absent from the shipped build-7 dex**, so GIF has never reached a single user. HEIC/HEIF and GIF work as *sources* only; HEIC is never a target. **MP3 is deleted outright** (commit `4572bf5`; `convert-targets.ts:17-20` comment: "no engine path to re-enable"). Android WebM v1 **drops the audio track** and reports no progress (`PROJECT_CONTEXT.md:135,1743`).

**10 languages:** English, Español, Português (Brasil), Français, Deutsch, Italiano, Bahasa Indonesia, हिन्दी, العربية (RTL), 日本語 — plus a "System default" option. 498 leaf keys, CI-enforced parity.

**Other publishable constants:** 5 accent colors · up to 5 files per Convert batch · 2 free video compressions/day · 1 free custom-file compression/day · 3-minute shared full-screen-ad cooldown (`full-screen-ad-gate.ts:15`) · deletion history capped at 2000 entries (`app-store.ts:33`) · cleanup event ledger capped at 2000 (`cleanup-events-store.ts:22`) · 6-week trend + last-12 history lists in Advanced Stats · 4-digit passcode with 15 s re-lock grace.

**[ADJ] Six PRO keys are declared but enforced NOWHERE and have no UI.** I re-ran the exhaustive grep myself: `compressAll`, `batchVideoCompression`, `oneTapRecommendations`, `fasterScanning`, `cleanupHistory`, `compressionHistory`. `PROJECT_CONTEXT §10` and the `repo-structure` report both say *seven*, wrongly including `smartClean` — but `smartClean` **is** enforced at `smart-clean-review-screen.tsx:48`. Verified list of every gate call site: `use-ads-visibility.ts:18`, `compression-detail-screen.tsx:40,130`, `history-screen.tsx:186`, `smart-clean-review-screen.tsx:48`, `convert-run-screen.tsx:37`, `convert-batch-run-screen.tsx:33`, `stats-screen.tsx:112,121`, `smart-clean-screen.tsx:130,156,363` (dynamic detector keys), `smart-clean-store.ts:109`. Nothing else.

---

## 3. Trust & safety story — *the site's core differentiator*

This section is fully code-backed and is the strongest honest material the product has.

### The deletion chain — four gates, all verifiable

1. **A left swipe never deletes.** `swipeCurrentPhoto("delete")` only appends to `markedForDeletion` and `reviewedPhotoIds`; there is no native call (`src/store/app-store.ts:394-432`). The decision is bound to the *specific card id* swiped, so a background re-sort during the 300 ms fly-off can't mark the wrong asset (comment at :394-400).
2. **The queue is reviewable and reversible.** Every tile on `/review-delete-list` has a Restore button (`review-delete-list-screen.tsx:145-170`); month headers carry full per-month counts and bytes even while paged 60 at a time (:24, :59-71).
3. **An explicit in-app confirm.** Title "Delete selected photos?", body "This will permanently remove these photos from your device.", buttons Cancel / **Delete Photos** (red) — `src/components/delete-confirmation-dialog.tsx:11-39`. The same component gates Smart Clean.
4. **The OS consent dialog, and a denial is treated as failure.** `MediaLibrary.deleteAssetsAsync` returning false leaves app state completely untouched (`src/services/photo-library-service.ts:224-246`, comment: "Treat that as a failure so callers never record undeleted media as gone"). State mutates only after success, and the post-await write **re-reads fresh state inside the updater** so a swipe or restore during the seconds-long OS dialog isn't clobbered (`app-store.ts:517-554`).

**Undo — state it precisely.** `undoLastSwipe` reverses exactly one last swipe: removes from the marked queue and the reviewed set, rolls back the stats counter, restores the deck index (`app-store.ts:493-507`). **Bulk multi-select marking deliberately sets no `lastSwipe`** — there is no batch undo; recovery there is per-item Restore (`app-store.ts:467-491`). Once the OS delete runs, nothing in SwipeClean can bring media back; `restoreHistoryItem` (`app-store.ts:581-586`) only flips a log flag and has **no caller**.

**A "Start Over" interlock.** If the current month/media scope still holds marked-but-undeleted items, `restartCurrentSelection` returns `{ok:false, blockedCount}` and offers to open the review list instead (`app-store.ts:557-579`; `swipe-screen.tsx:94-100`).

### The compression safety chain — the single best trust asset

1. Compression writes to a **temp file only** (`compression-service.ts:161-165`).
2. `verifyCompressedOutput` runs **before** the gallery write. It rejects unreadable/zero-byte output, and rejects any result where `finalSizeBytes >= knownOriginalSize` with "This file is already optimized…". Critically it reads the **real original file size from disk**, never the caller's pixel-based estimate, because an over-stated estimate could otherwise authorize deleting a *smaller* real file (`src/features/compression/compression.service.ts:80, :105-113, :126-135`).
3. A cancel is re-checked immediately before the library write, and the temp artifact is deleted (`:43-49`).
4. If `saveToLibrary` returns no asset id, the job **hard-fails** (`:51-57`) — an original is never deleted without a durable copy.
5. Deleting an original requires `outputUri` + `finalSizeBytes > 0` + a `libraryAssetId` **and** `savedBytes > 0` (`compression.store.ts:219-232`), **and** if App Lock is on, the passcode or biometric (`compress-run-screen.tsx:167-199`).

Consequence to state honestly: HEIC sources and already-efficient video legitimately land on "already optimized" and save nothing. Image output is hardcoded JPEG on both platforms (`compression-service.ts:284,316`).

### Smart Clean keeper protection — three independent guards

Initial selection is seeded from `candidateIds` (keepers excluded, `:90-99`); `toggle` early-returns on a keeper (`:102-104`); `handleConfirmed` filters keepers out of the confirmed list (`:135-137`) — all in `src/screens/smart-clean-review-screen.tsx`. A group can never be emptied. Plus a **destructive last-line guard** (`smart-clean-screen.tsx:173-197`): the delete is abandoned if the media index is scanning/refreshing/errored, if the access level no longer matches the permission, or if any requested id is missing from the currently authorized set — a confirmation opened before a permission downgrade cannot delete from a stale snapshot.

### Convert is non-destructive by design

The source is never touched; there is deliberately **no shrink check** because a format change may legitimately produce a larger file; only a non-empty artifact is required; a failed gallery save is a hard error (`src/features/convert/convert.service.ts:6-24,44-46,50-54,71-75`).

**Independent audit line, usable with a caveat:** `SECURITY_SCAN.md:187` — "Delete flows (the crown jewels)… **No data-loss path found.**" If cited, say plainly it is a self-conducted 2026-07-11 internal pass, not third-party certification, and that parts of it are already stale.

---

## 4. Privacy story — what we can truthfully say

### The defensible headline

> **SwipeClean has no servers, no account and no sign-up. Every scan, compression, conversion and deletion runs on your device — your photos are never uploaded anywhere.**

**[ADJ] Do NOT use the unqualified "your photos never leave your phone."** The `privacy` report found the caveat every other report missed: `expo-sharing` `Sharing.shareAsync()` is wired to a Share button in the photo preview (`src/screens/photo-preview-screen.tsx:63`) and to the converter's open/share path (`src/features/convert/open-media-file.ts:41`), plus an Android "open with" intent-launcher hand-off. Media *can* leave the device — user-initiated, to an app the user picks. **"We never upload your photos" is provable; "they never leave your phone" is disprovable by a skeptic in ten seconds.** Better still, disclose it proactively: *"The only way a photo leaves your phone is if you share it yourself."*

### The provable negatives (each independently checkable)

- Zero application network calls in `src/`/`app/` (grep verified in three separate audits).
- **No analytics, crash-reporting, attribution or telemetry SDK.** `grep -ci "sentry|bugsnag|crashlytics|amplitude|mixpanel|posthog|@segment|appsflyer" package-lock.json` → **0**.
- No account, login, sign-up or password surface (`grep -rniE "signIn|signUp|createAccount|OAuth|password"` excluding passcode → no output).
- No push notifications and no push token — everything is scheduled locally; no `google-services.json` exists.
- No CAMERA, LOCATION, RECORD_AUDIO, MANAGE_EXTERNAL_STORAGE, READ_CONTACTS or GET_ACCOUNTS permission in the shipped release manifest (verified against both the merged manifest and the AAB). The app even explicitly *strips* the CAMERA permission expo-image-picker would inject (`android/app/src/main/AndroidManifest.xml:16`).
- Ads are **non-personalized only**, unconditionally: `requestNonPersonalizedAdsOnly: true` on all three surfaces (`ad-banner.tsx:15`, `interstitial.service.ts:23`, `rewarded.service.ts:22`).
- UMP consent **fails closed**: store defaults `canRequestAds: false` and is not persisted (`ads-consent-store.ts:22`); the service `return false` inside a bare catch (`consent.service.ts:22-29`); consent is gathered *before* `mobileAds().initialize()` (`app/_layout.tsx:38-57`) and both full-screen services re-check it. No consent → no ads at all.
- RevenueCat uses **anonymous** app-user IDs — a grep for `logIn|setAttributes|collectDeviceIdentifiers|setEmail|setDisplayName` across all of `src/` and `app/` returns zero hits.
- `<queries>` block is scoped to https VIEW intents only — the app cannot enumerate installed packages (`AndroidManifest.xml:17-23`).

### The honest caveats

- **RevenueCat** (`react-native-purchases` 10.3.0) receives an anonymous customer id and purchase receipts, when you subscribe or restore.
- **Google AdMob + UMP** (`react-native-google-mobile-ads` 16.3.3) — free tier only. The shipped release manifest carries `AD_ID` and `ACCESS_ADSERVICES_AD_ID/TOPICS/ATTRIBUTION`.
- **Never say "works offline" or "no network access."** `INTERNET` is declared (`AndroidManifest.xml:4`). Note that the already-live Play listing *does* contain a "Works offline" bullet (`store-listing-generated/LISTING.md` §3) — **strip that line from any copy reused from it.**
- The shipped release manifest carries **43** `uses-permission` entries (the app's own manifest declares 11); the rest are injected by Google's ad/billing/notification libraries plus ~15 OEM launcher-badge permissions.
- The published AAB ships **unused Google ML Kit barcode-scanning code** (`libbarhopper_v3.so` in all four ABIs, `MlKitInitProvider` registered), dragged in transitively by `expo-dev-client` which sits in `dependencies` not `devDependencies`. Inert — no camera permission, no scanning feature — but "we ship nothing extra" would be false.
- Support emails auto-attach a diagnostics block (RevenueCat Support ID, device alias, app version, platform, plan status) — but the user sees it in their own mail composer before sending; nothing is transmitted silently (`settings-screen.tsx:43-56, 222-238`).
- There is **no in-app or web route to request deletion** of the one server-side record that exists (the anonymous RevenueCat customer + purchase history). The only deletion story shipped is "clear app data or uninstall."

### Legal pages the website MUST host

| Page | Why | Status today |
|---|---|---|
| **Privacy Policy** | Mandatory for Play with `READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO` + `AD_ID`. | Live at `https://effervescent-douhua-6f5c1d.netlify.app` (fetched and confirmed: "Privacy Policy for SwipeClean", effective July 7 2026). **No source file exists in the repo** — a versioning/bus-factor problem. |
| **Terms of Service / EULA** | **Missing entirely.** The app links only Google Play Terms (`contact.ts:27`) / Apple's standard EULA on iOS. | Does not exist |
| **Subscription Terms** | Billing period, auto-renewal, cancellation via Google Play. | Exists only as an in-app string; reuse `en.json` `subscription.billingDisclaimerAndroid` verbatim |
| **Data deletion instructions** | Play requirement; today the only route is uninstall. | Does not exist |
| **Support / Contact** | `info.cognitix@gmail.com` is real and shipped. | Mailto only |
| **Third-party notices** | ⚠️ **Do not publish yet** — see §10. | Licenses screen was deliberately deleted 2026-08-06 |

🚨 **Critical URL constraint.** `PRIVACY_POLICY_URL` is compiled into the shipped bundle — the `privacy` agent byte-verified the string `effervescent-douhua-6f5c1d.netlify.app` is present inside `dist-android/SwipeClean-v1.0.0-vc7-production.aab`, and build 7 is in users' hands. Moving the policy to a branded domain requires either a **permanent 301 on the Netlify host forever**, or a new build with `versionCode ≥ 8` plus a Play Console policy-URL update. The support email is baked in the same way.

---

## 5. Monetization reality

**Tiers:** two subscription plans only — **Monthly** and **Yearly**. No lifetime, no one-time purchase (the component that once advertised one, `premium-card.tsx`, was deleted for contradicting the shipped model — `PROJECT_CONTEXT.md:587`; file confirmed absent). Entitlement id `CleanSwipe Pro`, offering id `default` (`revenuecat.service.ts:15-16`).

**The paywall renders exactly six benefits**, in this order (`premium-screen.tsx:90-97`): Smart Clean · Video compression · Image conversion · Video conversion · Advanced stats · No ads. Hero copy: title "SwipeClean Pro", subtitle "A cleaner, faster version for people who want to review media without ads or friction.", section header "What's included" with a "PRO" crown pill. Yearly card first with a hardcoded **"Best value"** badge and pre-selected; CTA "Start Yearly" / "Start Monthly"; secondary "Restore Purchases".
**[ADJ]** `DESIGN-BRIEF.md:238` lists only four benefits — stale, do not use. `PROJECT_CONTEXT.md:123` claims the paywall shows a Free-vs-Pro comparison table — **it does not** (`premium-screen.tsx:136-255` contains no such component).

**Ad model (free tier).** Three formats, all non-personalized:
- **Banner** — anchored adaptive. Mounted on **5** screens (`history-screen.tsx:354`, `premium-screen.tsx:57`, `settings-screen.tsx:359`, `smart-clean-screen.tsx:372`, `stats-screen.tsx:128`) but **[ADJ] only 4 are reachable**: I verified `premium-screen.tsx:46-48` returns `<StudioScreen/>` when `isPro`, and `AdBanner` returns null when `canUseFeature("noAds")` — so the Smart Clean banner is dead code, since Smart Clean only renders inside the Pro-only Studio. Reachable: **Compress, Stats, Settings, Pro tab.** The `privacy` and `ux-flows` reports said 5; `features` and `monetization` did the reachability trace and are right. **Never a banner on the swipe deck, the gallery, or the marked-for-deletion screen** — `PROJECT_CONTEXT §4`'s claim of a banner on the review-delete success screen is stale.
- **Interstitial** — exactly two break points: dismissing the delete-complete dialog (`review-delete-list-screen.tsx:114`) and after each successful compression (`compression.store.ts:162`). Shared 3-minute cooldown (`full-screen-ad-gate.ts:15`).
- **Rewarded** — user-initiated, unlocks one free video compression (2/day) or one free custom-file compression (1/day).

Real production unit IDs ship in release; `__DEV__` or `EXPO_PUBLIC_ADS_USE_TEST=1` forces Google TestIds (`ad-config.ts:16-25,32-33`). ⚠️ The `privacy` agent found Google's public *test* publisher prefix `ca-app-pub-3940256099942544` is still present as a string in the shipped bundle alongside the real one — that's just the un-minified dev branch, not evidence of test ads, but it means string-presence can never substantiate an ad claim.

### Verdict: can prices and store links appear on the site TODAY?

| Item | Verdict |
|---|---|
| **Prices** | ❌ **NO.** There is not one price string in the repo. Plans are fetched at runtime via `product.priceString` (`revenuecat.service.ts:230`), with i18n fallbacks "Loading store prices..." / "Plans unavailable". A repo-wide currency grep returns exactly four lines, all in docs, all placeholders or Test Store values (€2.99/€19.99 in `APP_ANALYSIS.md:72`; $2.99/$14.99 explicitly labelled PLACEHOLDER at `PROJECT_CONTEXT.md:636`; $9.99/$79.98 Test Store at `:1085`). **Real prices exist only in Play Console.** |
| **Free trial / intro offer** | ❌ **NO.** Grep for `introPrice\|freeTrial\|introductory\|promoOffer\|discount` across `src/`+`app/`+all 10 locales returns zero monetization hits. A Play-side store-configured intro offer could still exist — owner must check. |
| **"Best value" claim** | ⚠️ The badge is hardcoded, not derived from any price comparison. If yearly isn't actually cheaper than 12× monthly in Play Console, both the app *and* the site make an unsupported claim. |
| **Google Play badge/link** | ⚠️ **Probably yes, but unverified.** No Play listing URL exists anywhere in the repo. Derived from `app.json:19`: `https://play.google.com/store/apps/details?id=com.cognitix.swipeclean`. **Owner must paste and confirm the real URL before the CTA ships.** |
| **App Store badge** | ❌ **NO.** See §6. |
| **Traction claims** | ❌ **NO.** No install count, rating, review, testimonial or revenue figure exists anywhere. The only end-to-end purchase verification recorded in the repo is against the RevenueCat **Test Store**. |

**Cancellation.** The app cannot cancel programmatically. Settings shows a "Cancel Subscription" row for **every** `subscriptionStatus === "active"` user (`settings-screen.tsx:344-353`) that deep-links to Play/Apple's management page. `PROJECT_CONTEXT §10`'s "hidden for non-cancellable sources" is stale — that gate was removed 2026-08-21 because it deleted the app's only route to the store subscription page. Safe copy: **"Cancel anytime in Google Play."**

**Known deliberate gap:** offline entitlement never expires. `isProUser` is a bare `subscriptionStatus === "active"` (`feature-access.service.ts:16-18`) and the persisted `expiresAt` is never compared to a date (grep confirms assignment sites only). Documented as an intentional decision to avoid revoking Pro during a billing grace period (`PROJECT_CONTEXT.md:376`). Do not claim prompt revocation or server-side receipt validation.

---

## 6. Release status

### Android — LIVE (owner-confirmed, not repo-provable)

- `dist-android/SwipeClean-v1.0.0-vc7-production.aab` — **versionCode 7, versionName 1.0.0**, applicationId `com.cognitix.swipeclean` (`android/app/build.gradle:130,133-134`), R8 minify + resource shrink on (`:191`), signed `CN=Cognitix, O=Cognitix, C=US`, SHA-256 `381CE9F2…4DE1FA`.
- `PLAY_RELEASE.md:9-11`: "**PUBLISHED ON GOOGLE PLAY** (confirmed 2026-08-22) — live to the public; not in review." `PROJECT_CONTEXT.md:408` repeats it.
- **[ADJ] Confidence: LIKELY, not certain.** The `assets` report found a real contradiction the others missed: commit `f1ef9a7` (the rebrand commit) says build 7 "is uploaded and live as the **Play beta**"; only the *next* commit `0e1e62a` — a **docs-only** edit (diffstat: PLAY_RELEASE.md 4 lines, PROJECT_CONTEXT.md 8 lines) — reclassifies it as public. And `PLAY_RELEASE.md:151-155` still contains an un-deleted 2026-08-17 block: "Production access is not yet approved, and no public production release has been submitted or published." No repo artifact settles it. **Verify with the owner before writing "available now on Google Play."**
- The working tree is **ahead of the published build**: the LAME-removal commit `4572bf5` (dated 2026-08-25, HEAD) is source-only and explicitly NOT build-verified; versionCode was deliberately left at 7. Next upload needs ≥8.

### iOS — code-complete, never shipped. Two open blockers.

1. **No RevenueCat iOS key.** `.env.local` on this machine contains only `USE_TEST_STORE`, `TEST_API_KEY` and `ANDROID_API_KEY` — there is **no `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` line at all**. **[ADJ]** `PROJECT_CONTEXT.md:602` claims the key was wired in on 2026-07-18; `PROJECT_CONTEXT §10` lists it as still open; the file contradicts the history entry. Trust the file: on this checkout iOS billing is unconfigured. **[ADJ] The consequence is *degradation*, not a crash** — `getApiKey()` returns undefined → `configure()` returns false → `ensureConfigured()` throws → `initializeBilling()` catches it into `billingError` → the paywall renders with disabled buttons and "Plans unavailable" (`revenuecat.service.ts:155-172`; `subscription-store.ts:74-82`; `premium-screen.tsx:131-133`). The `monetization` report's "the iOS paywall throws" overstates it.
2. **`ios/SwipeClean/PrivacyInfo.xcprivacy` declares `NSPrivacyCollectedDataTypes` = empty array and `NSPrivacyTracking` = false** while the target links Google-Mobile-Ads-SDK, with no `NSUserTrackingUsageDescription` configured. (`SECURITY_SCAN.md:186` says this file is "currently accurate" — **stale**, superseded by `PROJECT_CONTEXT §10`.)

Also iOS-specific: Smart Clean's foreground service is gated on `Platform.OS === "android"` (`smart-clean-store.ts:439`), so scanning is foreground-only on iPhone; the iOS GIF engine is "code-complete, build unconfirmed."

### What the download buttons can point to today

**One Google Play badge. Nothing else.** No App Store badge, no "available for iPhone and Android", no dated iOS promise. An **iOS email-capture waitlist is defensible**; an App Store badge is not.

---

## 7. Brand & design tokens

### Palette — ship this token block verbatim

Accent colors (5, user-selectable, Settings swatch order; `src/theme/colors.ts:6-12`, header comment "GREEN LEADS: it is the brand accent and the default"):

| Name | Hex | Note |
|---|---|---|
| **green** | `#10b981` | **Brand default.** Force-applied to every pre-existing install by the store's first versioned migration (`app-store.ts:616,640-641`) |
| blue | `#075ec8` | Retired default; survives only as an option + leftovers |
| purple | `#8b5cf6` | |
| orange | `#f59e0b` | |
| pink | `#ec4899` | |

Light theme (`colors.ts:14-26`) / Dark theme (`:28-40`) — the accent hex is used **unmodified in both**:

| Token | Light | Dark |
|---|---|---|
| background | `#f7f8ff` | `#111827` |
| surface | `#ffffff` | `#1f2937` |
| surfaceSoft | `#edf2ff` | `#253047` |
| surfaceStrong | `#dde6f8` | `#303d58` |
| text | `#111827` | `#f9fafb` |
| muted | `#4b5563` | `#cbd5e1` |
| faint | `#c7cfdf` | `#64748b` |
| border | `#dfe7f6` | `#334155` |
| green (semantic) | `#047857` | `#34d399` |
| red | `#dc2626` | `#f87171` |
| yellow | `#f59e0b` | `#fbbf24` |

**Dark mode is a manual toggle defaulting to LIGHT** (`use-app-theme.ts:8`; `settings-service.ts:8`). `app.json:9` `userInterfaceStyle: "automatic"` governs native chrome only. Say "light and dark themes", never "matches your system".

### Brand mark — a 5-line SVG, inline it

`assets/logo-mark.svg` (411 bytes, exact). Master viewBox `-6 -6 60 60`, opaque white ground, centre (24,24):
```
ring:     M24 6.5 A 17.5 17.5 0 1 1 11.6 11.6   stroke #059669  stroke-width 5.4  round cap  no fill
sun dot:  circle cx=18 cy=19.4 r=2.4            fill #047857
mountain: M14.5 30.4 L20 24 L23.4 28 L26.6 24.8 L33 30.4 Z   fill #047857
```
An open storage ring (gap upper-left) around a sun-over-mountains photo glyph. Visually confirmed in `assets/icon.png` (1024×1024, 31,834 B).

⚠️ **Two greens are in play.** The in-app `AppLogo` follows the user's accent and derives the glyph as `shade(color, 0.72)` (`app-logo.tsx:19-27,45-46`) — 4 call sites, all passing `theme.accent`. The **launcher and store icons are deliberately FIXED** at ring `#059669` / glyph `#047857`. A website mark rendered in `#10b981` will not match the Play Store icon. Recommendation: `#10b981` for UI accents, `#059669`/`#047857` for the mark — owner's call.

Android adaptive icon: white background layer, foreground scaled **0.62** about pivot (24,24) — device-verified 2026-08-22, do not reuse 0.82.
⚠️ **The 10 tracked `android/.../mipmap-*/ic_launcher{,_round}.webp` files are stock AOSP Android-robot placeholders** (last touched `d68fbfc`, pre-rebrand; decoded and confirmed). Never pull a logo from there.

### Typography

**System font only — confirmed by absence.** `grep -rn fontFamily src/ app/` returns **zero hits**; no `expo-font` dependency, no `fonts` array. Do not introduce a Google Font. Weights are extreme: 800/900 for nearly all headings and labels.

Measured size histogram (top of the distribution): 16 (×63) · 15 (×48) · 14 (×36) · 13 (×36) · 12 (×34) · 22 (×13) · 17 (×13) · 24 (×9) · 40 (×4). Web ramp: display 40/900 · h1 30/900 · h2 24/900 · h3 22/900 · card title 18/900 · lead 17/600 · body 16/400 (lineHeight 23 ≈ 1.44) · small 14 · caption 13 · micro 12/700.

**Uppercase is a small-label device, not an accent-only signature** — four sites, three treatments: settings section headers (accent, 14/900, ls 0.4), convert group labels (muted, 11.5/800, ls 0.4), convert status labels (11/800, ls 0.5), paywall PRO badge (white on accent, 11/900, ls 0.5).

### Radius & depth

Radius scale by frequency: **14 (×50 — dominant)** · 12 (×22) · 22 (×20) · 10 (×15) · 18 (×11) · 16 (×9) · 24 (×6). Swipe card 34, peek 33. Dialogs and large panels 24. Tiny radii (2/3/6) exist but only on progress-bar tracks and hairline pills.

**Depth comes from tonal layering, not shadows** — the entire app contains exactly **15** `boxShadow` declarations, eight of which are accent glows or media chrome. Use `1px solid var(--border)` hairlines over tonal fills (bg → surface-soft → surface → surface-strong) and reserve `0 14px 30px rgb(16 185 129 / 0.34)` for the single primary CTA.

### Gradients (5 non-scrim)

1. **Stats hero** `[accent, shade(accent,0.28)]` at 135°, radius 24, padding 22 → `linear-gradient(135deg,#10b981,#0c855d)` for brand green. The app's one large brand surface, and derived, so it stays on-brand under every accent — a safe hero choice.
2. Custom-compress CTA `[accent, "#2d7df0"]` — ⚠️ hardcoded blue endpoint regardless of accent.
3. Paywall CTA gloss `[rgba(255,255,255,0.24), transparent]`.
4. Shimmer sweep (compress run + convert progress).
5. A media overlay triple.

### Motion & feel

Springs: tab pill `{damping:22, stiffness:240, mass:0.7}`; result sheet `{22,220}`; drag-dismiss return `{18,180}`; lock entrance `{16,150,0.7}`. Timings: 220 ms tab page transition `Easing.out(Easing.cubic)` (opacity 1→0, translateY 16, scale 0.9→1); entrance `FadeInDown` 420 (stats) / 450 (paywall) with 70/110/140/210/240/280 ms stagger; paywall loops 1500 ms pulse + 1900 ms halo. Pressed state is `scale(0.985)`. **The lock screen genuinely gates on `AccessibilityInfo.isReduceMotionEnabled`** (`app-lock-gate.tsx:104-107,171`) — mirror `prefers-reduced-motion` on the site.

**Haptics — exactly four, all light-touch:** selection on a committed swipe, selection on tab change, Medium impact entering gallery multi-select, Success notification on a completed bulk action.

**Signature motif for the hero — the swipe card, all reproducible in pure CSS.** Card radius 34 + `0 18px 34px rgb(15 23 42/.16)`; up to 3 peek cards behind at radius 33, inset 7 px, each `top: i*6` + `translateY: i*9` + `scale(1 - i*0.025)` + `opacity(1 - i*0.08)` under a `rgb(15 23 42/.07)` wash (total visible stack = 4). Commit at `min(130px, 28% width)` or `|vx| > 0.75`; live rotate ±9°, scale to 0.96. Full-card wash: keep `rgb(4 120 87/.34)`, delete `rgb(220 38 38/.34)`. Stamps: min-width 144, padding 9/18, radius 14, **3 px solid white border, transparent fill**, white 28/900, rotated **+10° (Keep) / −10° (Delete)**. `src/components/swipe-photo-card.tsx:29,124-141,185-229,271-334`.

**Iconography:** `lucide-react` (the app uses `lucide-react-native`) at stroke 2, 2.4 for emphasis, 2.8 on the focused tab icon. App mapping: Layers (Swipe) · Archive (Compress) · BarChart3 (Stats) · Star (Pro tab, free) / Wand2 (Studio, subscribed) · Crown (upgrade) · Sparkles (space reclaimed) · Palette (accent picker) · HardDrive/Images/Trash2 (stat tiles).

**Tab names if the site shows the UI: Swipe · Compress · Stats · Pro (free) / Studio (subscribed).** Never "Premium", never "Smart Clean" as a tab label. `DESIGN-BRIEF.md`'s tab table (143-148), accent table (:49), dialog spec (:117) and Stats spec (:235) are all stale — do not source from it.

**Header lockup, reusable as the site nav** (`app-header.tsx:14-38`): 32 px AppLogo in accent + 10 px gap + wordmark at 26/800 in accent, `numberOfLines={1}`; right = 44×44 hit area with a 30 px gear. The app has never had a drawn logotype.

**Stale blue remnants** (if the site depicts notifications or the Compress CTA): `#075ec8` survives at `app.json:38` (notification plugin colour), `android/.../values/colors.xml:5`, three notification services, and the media-viewer compare toggle; `#2d7df0` in the custom-compress gradient; two `rgba(7,94,200,·)` shadows in compression-detail.

---

## 8. Existing asset manifest

| Path | Type | Depicts | Usable on site? |
|---|---|---|---|
| `assets/logo-mark.svg` | SVG, 411 B, **git-tracked** | Current green ring mark | ✅ **Yes** — inline it |
| `assets/icon.png` | PNG 1024², 31,834 B, **tracked** | Same mark, white ground | ✅ **Yes** — favicon/OG source |
| `ios/.../App-Icon-1024x1024@1x.png` | PNG 1024², 31,834 B, **tracked** | Byte-identical art | ✅ Yes |
| `android/.../drawable/ic_launcher_foreground.xml` | Vector, **tracked** | Ring mark, scale 0.62 | ✅ Reference only |
| `android/.../mipmap-*/ic_launcher*.webp` (10 files) | WebP, **tracked** | **Stock AOSP Android robot** | ❌ **No** — never ship as a logo |
| `store-listing-generated/LISTING.md` | Markdown, 8,312 B, **tracked** | Play-policy-vetted listing copy | ✅ **Yes — the best copy source in the repo** |
| `store-listing-generated/*.png` (10, deleted in `f1ef9a7`) | PNG, recoverable from git | **[ADJ] Fabricated illustrated mockups**, not screenshots | ❌ **No — not even as reference** |
| `e2e-shots/*.png` (**81** files, 2026-06-21, gitignored) | Device captures 1080×2340 | Real app UI, pre-rebrand | ❌ **No** (privacy + brand) |
| `tablet-shots/*.png` (8, gitignored) | Device captures | Mostly blank render probes | ❌ No |
| `outputs/marketing/reels/2026-07-05/*.mp4` (5) | H.264 1080×1920, 22–26 s, 9–14 MB | **SwipeClean-branded** ad reels | ⚠️ **Needs work** — best material available |
| `outputs/marketing/reels/2026-07-05/*-poster.png` (5) | PNG 1080×1920, 1.5–1.7 MB | Reel posters | ⚠️ Needs work |
| `outputs/marketing/reels/2026-07-05/README.md` | Markdown | 5 ready captions + CTAs in posting order | ✅ Yes (social/meta copy) |
| `outputs/creative/cleanswipe-remotion/renders/*.mp4` (10) | H.264 1080×1920 | **Branded "CleanSwipe"** | ❌ **No** unless re-rendered |
| `outputs/creative/.../renders/stills*/[10].jpg` | JPEG **270×480** | CleanSwipe frames | ❌ No — far too small |
| `outputs/creative/.../public/images/*.png` (5) | PNG **941×1672**, 1.4–1.8 MB | AI lifestyle backgrounds | ⚠️ **Needs a legal decision** |
| `outputs/creative/.../public/audio/*.wav` (13) | WAV | 5 music beds + 3 SFX + 5 orphan SAPI voice takes | ❌ **No** — beds are self-declared placeholders |
| `outputs/creative/.../public/voiceover/daily-2026-07-05/` | MP3 + WAV, 5 each | ElevenLabs VO, **names SwipeClean** | ⚠️ Licence check needed |
| `outputs/creative/cleanswipe-five-short-video-scripts-2026-07-04.md` | Markdown | 5 full scripts w/ A-B variants | ⚠️ Internal — mine, don't publish |
| `outputs/marketing/reels/2026-07-05-swipeclean-ai-reel-plan.md` | Markdown, 17.9 KB | Competitor teardown + storyboards | ❌ **Never publish** (names competitors) |
| `marketing/` (root) | — | **Genuinely empty** (3 dirs, 0 files) | n/a |
| `website/` | — | **Does not exist.** `git status --porcelain` is empty | n/a |

### Adjudications on assets

**[ADJ] The deleted store PNGs.** `repo-structure` and `assets` both describe them as recoverable product screenshots and suggest reusing them as a shot list. `brand` actually **recovered and opened** `f1ef9a7^:store-listing-generated/01-swipe.png` and `feature-graphic.png`: they are **illustrated marketing renders** (cream/purple grounds, decorative stars, a drawn phone frame) whose in-phone UI is **invented** — a generic blue rounded-square logo, a mountain-gradient placeholder photo, and **large red-X / green-check circle buttons the real swipe screen has never had** (the real one is drag-only with rotated stamps). `PROJECT_CONTEXT`'s own "they showed the old blue card-stack logo" description is imprecise — they never showed the app's logo at all. **Verdict: do not resurrect them for any purpose, including as a visual reference.** This also raises an owner question: were these published to Play?

**[ADJ] The e2e captures' accent.** `assets` and `repo-structure` call them "pre-rebrand blue UI". `brand` opened `01-launch.png` (1080×2340) and found **dark mode with a GREEN accent throughout** — because the accent has always been user-selectable and the tester had green picked. What actually dates them: the retired tilted card-stack logo, the tab-4 label "Smart Clean", a pale-blue focus pill, and the device status/nav bars. **Also disqualifying: the frame contains a real personal video showing at least one clearly identifiable face plus copyrighted broadcast content on a TV inside the shot.** Privacy and third-party-rights exposure, not merely aesthetic.

**[ADJ] Reel accents.** `brand` claimed "every rendered video and poster is off-brand — all ten use blue `#075ec8`." **Refuted by `assets`**, which opened the posters: `accent` is a per-ad field. The five 2026-07-05 reels are `#075ec8` (blue), **`#10b981` (exact brand green)**, `#0f766e` (teal), `#075ec8`, `#8b5cf6` — see `daily-2026-07-05-data.ts:22,47,72,97,122`. **`screenshot-avalanche.mp4` (22.06 s, 11.0 MB) is already SwipeClean-branded AND already brand-green — the single closest-to-shippable video the product owns.** What *is* uniformly off-brand across all renders is the **logo shape**: a CSS card-stack (`index.css:62-90`), not the ring.

**Remaining reel defects (all fixable in ~4 lines):** the leaked internal working title in the top-right of every frame (`AdVideo.tsx:435` `<div className="ad-title">`), the card-stack `.logo-mark`, the `brandName` default "CleanSwipe" (`AdVideo.tsx:414`), and hand-drawn phone UI with invented copy ("Storage Full / Free up space to keep recording", "SwipeClean keeps the workflow simple.") that exists nowhere in the app.

**AI backgrounds — provenance is CERTAIN, not inferred.** All five `public/images/*.png` embed a **signed C2PA manifest** declaring `digitalSourceType: trainedAlgorithmicMedia` / `softwareAgent: gpt-image v2.0` with an SSL.com certificate chain. Four of five depict photorealistic **identifiable synthetic human likenesses**; the fifth is an empty living room. They are **941×1672**, so they upscale ~15% into a 1080×1920 slot. Decide deliberately whether to preserve or strip the C2PA credential — do not strip it silently.

### Strongest existing headlines, verbatim from `store-listing-generated/LISTING.md`

- **Title (25/30):** `SwipeClean: Photo Cleaner` *(alternates: `SwipeClean: Clean Up Storage` 28, `SwipeClean: Gallery Cleaner` 27)*
- **Short description (76/80):** *"Clean up storage fast: swipe to delete photos, remove duplicates & compress."*
- *"Everything runs 100% on your phone. No cloud upload, no account, no sign-up — your photos never leave your device."* ⚠️ **needs the share carve-out (§4)**
- *"Nothing is removed instantly — marked items go to a review queue, so you always confirm before anything is permanently deleted, and you can undo any swipe."*
- *"Shrink large photos and videos without visibly losing quality"* — **this is the ceiling; never escalate to "no quality loss"**
- *"Free up space, declutter your gallery and take back control of your storage — start swiping today."*
- Convert line, correctly Android-scoped: *"Convert images (JPG, PNG, WebP), convert video (MP4, WebM) and extract audio (M4A, WAV)"*
- ⚠️ **Strip "Works offline"** from the "Private by design" block before reuse.

The 8-caption screenshot table (§5 of LISTING.md) maps 1:1 to real screens and is a ready re-shoot shot list. LISTING.md's own §6 policy check records the deliberate exclusions: no superlatives ("Do not add 'fastest.'"), no "Tinder" (use "card deck"), GIF dropped from the Android Convert copy.

---

## 9. Website integration plan

**Recommended folder: `website/` at repo root.** Verified free — root dirs are `android app assets demo dist dist-android dist-share e2e-shots ios marketing modules node_modules outputs patches scripts src store-listing-generated tablet-shots`. `src/app` does not exist. Note `marketing/` at root is a genuinely empty leftover (not gitignored, not "taken") but `website/` is the better name.

### Config edits

| File | Edit | Status |
|---|---|---|
| **`eslint.config.js`** | 🔴 **REQUIRED.** Insert `      "website/**",` immediately **after line 18** (`"outputs/**",`). Verified line numbers myself: :16 `"scripts/*"`, :17 comment, :18 `"outputs/**"`, :19 `"*.config.js"`, :20 `"*.config.ts"`, :21 `]`. **[ADJ]** The `repo-structure` report said "after line 19" — off by one (still functional, but wrong anchor). Use `**` not `*`: the neighbouring `"dist/*"` is root-anchored and single-level and would not reach `website/dist/**`. | **Hard CI break without it.** Reproduced: a probe `website/` yields `eslint .` → 2 errors / 97 warnings (it lints `website/dist/assets/*.js`); with the fix → 0 website files, 0 errors, 92 warnings, identical to baseline. |
| **`.gitignore`** | 🔴 **REQUIRED.** After line 29 (`!store-listing-generated/*.png`) add `!website/public/**/*.png` and `!website/src/**/*.png`. | `*.png` is a repo-wide blanket at **line 21** with only three negations (24, 25, 29) — verified. `git check-ignore -v website/public/screenshot.png` → `.gitignore:21:*.png`. Silent 404s otherwise. **`.webp` and `.svg` pass through clean** — except **`qr-*.svg` is ignored at `.gitignore:45`**, so never name a site asset that. Optionally add `.vercel/ .netlify/ .vite/`. |
| **`metro.config.js`** | 🟡 Recommended. After line 4 (`const config = getDefaultConfig(__dirname);`), append `/[\\\/]website[\\\/]/` to `config.resolver.blockList`. | Runtime dump confirms `blockList` **is an array** (`[/\.expo[\\\/]types/, /(\\__tests__\\.*)$/]`), `watchFolders = []`, `nodeModulesPaths = []`, `disableHierarchicalLookup = false`. Purely a crawl/watch saving — resolution from `app/`/`src/` walks up only, so `website/node_modules` can never leak into the RN bundle either way. |
| **`tsconfig.json`** | ✅ **No edit needed.** `include` is `["app","src","*.ts","*.tsx",".expo/types/**/*.ts","expo-env.d.ts"]` — all root-anchored (`:13-20`). `tsc --noEmit` exits 0 with a probe `website/` present. Add an explicit `"exclude": ["website"]` only as belt-and-braces. |
| **`vitest.config.ts`** | ✅ **No edit needed** — `include: ["src/**/*.test.ts"]` (`:9`). ⚠️ **Do NOT add an `exclude`** — supplying one *replaces* vitest's defaults. |
| **`scripts/check-i18n.mjs`** | ✅ **No edit needed** — `SOURCE_ROOTS` is hardcoded at **line 25** to `[../src, ../app]` (the `repo-structure` report cited ":20,24" — corrected). ⚠️ Its `readAllSources()` walk (`:66-80`) is unfiltered recursive `readdirSync` with **no node_modules skip**, so a website placed under `src/` or `app/` would be walked file-by-file. Another reason for root placement. |
| **`android/app/build.gradle` / `app.json`** | ✅ No edit needed. `entryFile` resolves via `expo/scripts/resolveAppEntry` (`:12`), `bundleCommand = "export:embed"` (`:22`), and `app.json` has no `assetBundlePatterns`. A sibling `website/` adds **0 bytes** to the AAB. |
| **`.github/workflows/gates.yml`** | 🟡 Leave the job body alone. Add `cache-dependency-path: package-lock.json` to `setup-node` (absent today at `:24-28`, so its key derives from a `**/package-lock.json` glob). Add a **separate** `.github/workflows/website.yml` with `paths: ['website/**']`, its own `cache-dependency-path: website/package-lock.json`, and `working-directory: website`. It must **not** run the root `npm ci` (drags in the whole RN tree plus the load-bearing `patch-package` postinstall). Node 22 satisfies both. |
| **root `package.json`** | 🟡 Add `web:dev` / `web:build` / `web:preview` as `npm --prefix website run …`. **Do NOT add a `workspaces` key** (confirmed absent at runtime; `react` and `react-dom` 19.1.0 are root deps, so an omitting `website/package.json` would resolve up the tree). Do not wire the site into the four gates. | |
| **`.easignore`** | 🟢 Optional insurance — file does not exist today. `website/node_modules` and `website/dist` are already gitignored, but naming `website/` stops `website/src` riding along on every EAS upload. | |

### Doc obligations after landing (per `AGENTS.md:16-49`)

Prepend a `PROJECT_CONTEXT §11` Feature-History entry quoting **real** gate numbers (`AGENTS.md:48`). Current measured baseline: typecheck **exit 0** · `vitest run` **14 files / 123 tests passed** · `check-i18n` **498 keys, 9 locales in parity, 0 orphans** · `eslint .` **0 errors, 92 warnings, 189 files**. Add a `website/` bullet to §3's file map, and update §8 — its closing sentence still asserts the script list ends "no `format` or `build`", which goes stale the moment `web:build` lands.

### Deployment

| Option | Verdict |
|---|---|
| **Cloudflare Pages** | ✅ **Recommended.** Free commercial use, clean apex-domain support, good for a permanent privacy-policy URL. |
| **Netlify** | ✅ Good second — an account already exists and hosts the current privacy policy, so a 301 from `effervescent-douhua-6f5c1d.netlify.app` is trivial to set up on the same account. |
| **Vercel** | ⚠️ Hobby tier is non-commercial and SwipeClean sells a subscription. |
| **GitHub Pages** | ❌ Weakest: `website/dist` is gitignored at any depth, the default URL is the `/CleanSwipe/` subpath (forces a Vite `base`, poor permanent policy URL), and Pages is **not currently enabled** (`gh api …/pages` → 404). |

⚠️ **The repo is PUBLIC** (`github.com/anonymusdeveloper1/CleanSwipe`, 6,824 KB, Pages off). Launching a site makes it findable — and it contains `SECURITY_SCAN.md` with open findings, `PLAY_RELEASE.md` with signing-key fingerprints and artifact hashes, the ~1,800-line `PROJECT_CONTEXT.md`, and real AdMob app IDs at `app.json:66-67`. Decide before launch whether to link it.

**Asset budget:** the five reels are ~57.6 MB of video + 8.0 MB of posters; all fifteen MP4s ≈ 121 MB. Host video externally, not in git.

---

## 10. RED FLAGS — what the website must never claim

**Features that do not exist**
- ❌ **"Compress All" / "batch compression" / "compress your whole library in one tap" / Pause-Resume-Stop batch controls.** Removed in the 2026-06-15 redesign; a repo grep for `compressAll` returns only the dead flag string (`feature-flags.ts:30`) and one comment. `PROJECT_CONTEXT §4` still describes it at length and is **wrong**.
- ❌ **"Batch video compression" / "background compression queue."** ⚠️ **The app's own paywall string overclaims this** — `en.json` `paywall.videoCompression` says "Pro unlocks unlimited and batch video compression with a background queue." Do not launder that onto the site. `compression.store.ts:503-504`: "Foreground, inline: no background/foreground service."
- ❌ **"Background photo compression"** — a FREE flag key with no implementation.
- ❌ **"Faster scanning for Pro" / "cleanup history" / "compression history" / "one-tap recommendations"** as Pro benefits — declared, enforced nowhere, no gating UI.
- ❌ **"Advanced compression settings" as a Pro benefit** — it's in FREE_FEATURES; the lock badge and paywall branch are unreachable dead code, and the in-app string `en.json:61` ("Advanced compression settings are part of Pro.") is itself false.
- ❌ **MP3 output / "extract MP3" / "video to MP3"** — deleted entirely with the vendored LAME encoder (`4572bf5`); no code path remains.
- ❌ **Animated GIF → MP4** — two in-repo comments advertise it (`convert-targets.ts:5-8`, `conversion-engine.ts:9`) but `getAvailableTargets` returns only jpg/png/webp for any image source; line 97-98 of the same file states the truth. A GIF converts to a still frame only.
- ❌ **GIF on any Android-facing page; WebM on any iOS-facing page.** Module `platforms` arrays are exclusive, and `SwipeCleanGif` is absent from the shipped build-7 dex.
- ❌ **A "Free vs Pro comparison" on the paywall** — it doesn't render one.
- ❌ **Onboarding / tutorial / guided setup** — a repo-wide grep for `onboarding|welcome|firstLaunch|hasSeenIntro|tutorial|walkthrough` returns only `en.json:247` "Welcome back" (the biometric lock screen).
- ❌ **Removed surfaces:** a "Largest Photos" screen, redeem/promo codes, an Open-Source Licenses screen, a Privacy section in Settings, analytics settings, "Favorite"/"Missed" swipe categories (the chart ships only Kept/Deleted/Restored; `distribution.favorite`/`.missed` are stale i18n leftovers).
- ❌ **"Delete Selected"-style granular picking on the review screen** — despite the button reading "Delete Selected (N)", there is **no selection UI** there; the only per-item action is Restore, and confirming deletes the entire in-scope queue (`review-delete-list-screen.tsx:104`).
- ✅ *But note:* **do NOT** describe Leave Feedback / Report a Bug as placeholders — both open a real pre-filled `mailto:` with diagnostics (`settings-screen.tsx:222-238`). `PROJECT_CONTEXT §10` is stale on this.

**Overclaims about quality and accuracy**
- ❌ **AI / machine learning / "smart recognition."** The meme detector is an explicitly "conservative metadata heuristic" (filename patterns, size, source album, missing camera EXIF). Duplicates are MD5, similarity is perceptual dHash, blur is variance-of-Laplacian. **No on-device ML anywhere.**
- ❌ **Detection accuracy claims** ("99% accurate", "never deletes the wrong photo"). Documented open issues: the screenshot detector over-matches Canva/WhatsApp/download images; dHash and blur thresholds are untuned at scale.
- ❌ **"No quality loss" / "lossless."** Image output is hardcoded JPEG; video is H.264/MP4. The vetted ceiling is *"without visibly losing quality."* ⚠️ The High profile's own in-app copy says "Keeps your original quality" — another shipped overclaim not to repeat.
- ❌ **Guaranteed savings or a fixed savings percentage.** The 0.2/0.5/0.8 profile ratios are estimates; already-efficient files return "already optimized" and save nothing. Sizes fall back to pixel-based estimates when native metadata is unavailable.
- ❌ **"Convert makes files smaller."** Conversion is explicitly non-destructive with **no shrink check** — a format change can produce a larger file.
- ❌ **"Instant" scanning.** The first Smart Clean scan on a ~3,000-photo / 13 GB library takes **minutes** and is CPU-bound; only re-scans are fast.
- ❌ **All 8 detectors unconditionally available** — 5 of 8 are runtime capability-gated and the published build has no on-device verification record.
- ❌ **FFmpeg, professional codecs, 4K/8K transcoding, HEIC output.**

**Privacy / network overclaims**
- ❌ **"Works offline" / "no network requests" / "we collect nothing" / "zero data collection."** The app links AdMob and RevenueCat, declares `INTERNET`, and the shipped AAB carries `AD_ID` + all three `ACCESS_ADSERVICES_*` permissions. Scope every privacy claim to the media.
- ❌ **The unqualified "your photos never leave your phone"** — see §4; `expo-sharing` refutes it.
- ❌ **"No third-party SDKs" / "no Google code"** — Google Mobile Ads, Play Billing, unconfigured Firebase messaging components, and unused ML Kit barcode-scanning all ship.
- ❌ **"No advertising identifier"** — `AD_ID` ships. Say "non-personalized ads only, after consent, and Pro removes them."
- ❌ **End-to-end encryption / encrypted photo storage / "vault."** Nothing encrypts user media; only the App Lock PIN digest lives in OS-encrypted secure storage. App Lock also deliberately **fails open** when secure storage is unavailable (`app-lock-service.ts:18-23`) and its salt uses `Math.random()`, not a CSPRNG.
- ❌ **GDPR/CCPA "compliance" as a certification** — the app implements Google's UMP flow fail-closed, a mechanism, not an attestation. Publishing the AdMob consent message is still listed as pending.
- ❌ **Deep links (`swipeclean://…`) as a feature** — the scheme is exported with unvalidated params and an unknown route parameter throws (`SECURITY_SCAN` L2).

**Availability, commerce, legal**
- ❌ **App Store badge / "available for iPhone and Android" / any dated iOS promise.** Two open blockers (§6).
- ❌ **Any price, discount %, or free trial.** None exists in the repo.
- ❌ **"Lifetime" / "one-time purchase."**
- ❌ **"Promo codes" / "redeem a code" / "gift subscriptions"** — removed entirely 2026-08-01.
- ❌ **"Ad-free" / "no ads" as a product claim.** Free is ad-supported on four reachable screens. Ad-free is Pro-only. And do **not** say ads appear on Smart Clean even though a banner is imported there — that surface is unreachable.
- ❌ **"Video compression is Pro-only"** stated flatly — free is 2/day via a rewarded ad, plus 1 custom file/day, and the custom-file path (`/compress-run?custom=1`) has **no `canUseFeature` call in it at all**.
- ❌ **Unlimited free video compression by watching ads.**
- ❌ **In-app cancellation or refunds** — the Settings row deep-links to the store.
- ❌ **Server-side receipt validation / prompt revocation of a lapsed subscription** — entitlement is a local flag with no expiry comparison while offline.
- ❌ **Cloud backup, cross-device sync, an account, or recovering deleted photos from within the app.**
- 🚨 ❌ **"No third-party licensed code" / "no LGPL" / an Open-Source-Licenses or third-party-notices page.** The removal (`4572bf5`) is **source-only and explicitly NOT build-verified**; versionCode was deliberately left at 7. The **LIVE build-7 AAB still contains LAME twice** — `libswipecleanlame.so` and `libandroidlame.so` in all four ABIs plus four debug-symbol copies, verified by direct zip listing — with the in-app Licenses screen deliberately deleted. This is a recorded, accepted LGPL exposure in a published app. **Stay silent on licensing until a build-8 `unzip -l` shows no `*lame*.so`.**
- ❌ **Superlatives** ("#1", "best", "fastest", "top-rated") and **"Tinder" / "Tinder-style"** — the ASO policy pass explicitly excluded both (`LISTING.md` §6). Use "card deck". ⚠️ `DESIGN-BRIEF.md:12` uses "Tinder-style" internally.
- ❌ **Competitor names.** Cleaner Guru, CleanLens, Clever Cleaner, Cleaner Kit, Swipe Guru, Photo Cleaner+ appear only in internal research; the plan doc says "do not attack named competitors." **Never publish or link `outputs/research/*.md` or the reel plan.**
- ❌ **Install counts, ratings, reviews, testimonials, "trusted by N users", revenue.** Nothing substantiates any.
- ❌ **Affiliation with Google or Apple**; reproduce store trademarks only per official badge guidelines.

**Sources that must not be mined for copy** (all demonstrably stale, per `AGENTS.md:86-88` "dated one-shot snapshots"): `APP_ANALYSIS.md` (prices €2.99/€19.99, "rewarded is a TEST placeholder", "consent fails OPEN", MP3 at :43/:60/:126) · `DESIGN-BRIEF.md` (blue default at :49, 4-feature Pro list at :238, wrong dialog spec at :117, wrong tab names at :143-148, "Tinder-style" at :12) · `SECURITY_SCAN.md` (H1 LAME, H2 consent, camera permission item, and the PrivacyInfo "currently accurate" line) · `CONVERT_PLAN.md` (MP3) · `README.md:12-13` ("video → mp4/webm/gif" with no platform qualifier) · `PROJECT_CONTEXT §2/§3/§4/§10` on MP3, Compress All, banner placement, tab names, the logo, "feedback/bug are placeholders", "Smart Clean requires full access", and the "528 keys" figure. **`§11` newest-first and the code are authoritative.**

---

## 11. Open questions for the owner
*Each has a sensible default so the owner can just say "defaults are fine."*

### A. Positioning & audience
1. **Site title: `SwipeClean` or the Play recommendation `SwipeClean: Photo Cleaner`?** Which title is actually live in Play Console (`Photo Cleaner` / `Clean Up Storage` / `Gallery Cleaner`)? The `<title>` and H1 should match the store for search consistency. → **Default:** match the live Play title; H1 = "SwipeClean".
2. **Do we publish the exact free-tier quotas** (2 videos/day, 1 custom file/day, each behind a rewarded ad)? Accurate and differentiating, but it also tells users how to avoid paying. → **Default:** state them plainly; honesty is the brand.
3. **Do we disclose the Share caveat proactively** ("the only way a photo leaves your phone is if you share it yourself")? → **Default:** yes — it's more persuasive than an absolute a skeptic can disprove.
4. **Do we name Smart Clean's 8 detectors verbatim**, given the documented over-matching on screenshots? → **Default:** yes, but pair every mention with "review, then confirm", never "one tap deletes".
5. **Does the site mention iOS at all** — silence, "Android first", or an email waitlist? → **Default:** an email-capture waitlist, no dates, no Apple badge.

### B. Design direction
6. **Which green is the *website's* primary brand green?** Three are in play: `#10b981` (in-app accent + default), `#059669` (logo ring, fixed on launcher/store icon), `#047857` (glyph). → **Default:** `#10b981` for UI accents, `#059669`/`#047857` for the mark.
7. **Light or dark mockups?** The app defaults to light; the only real device captures are dark and the green pops harder there. → **Default:** light-first with a dark toggle, mirroring the app.
8. **Ship the interactive accent switcher?** Five swatches live-retinting `--accent`, the inline logo ring and a CSS device mockup — mirrors real shipped behaviour with zero factual risk. → **Default:** yes; it's the strongest zero-risk interactive idea.
9. **Fix the blue leftovers before launch?** `#075ec8` notification colour (`app.json:38`, `colors.xml:5`, three services), the `#075ec8` compare-toggle, the `#2d7df0` gradient endpoint, two `rgba(7,94,200,·)` shadows. Only matters if the site depicts notifications or the Compress CTA. → **Default:** leave for the build-8 pass; avoid depicting those surfaces.
10. **Regenerate the AOSP-robot legacy launcher icons** (`mipmap-*dpi/*.webp`)? Only visible on API < 26. → **Default:** defer.
11. **Does "SwipeClean" need a drawn logotype for the web,** or does the app convention carry over (system font, weight 800, accent, 26 px, 10 px gap after a 32 px mark)? → **Default:** carry the app convention over.

### C. Scope & pages
12. **Which legal pages does the site host?** Privacy Policy is mandatory; ToS/EULA and Data-Deletion do not exist anywhere today. → **Default:** Privacy + ToS + Subscription Terms + Data deletion + Support. **No third-party-notices page until build 8.**
13. **Does the site take over the privacy policy** from `effervescent-douhua-6f5c1d.netlify.app`? This forces a decision on the 301 vs a versionCode-8 build. → **Default:** publish at `/privacy` on the new domain, keep the Netlify host as a permanent 301, and change `src/config/contact.ts:24` on the next release (which is needed anyway).
14. **Which of the 10 app languages does the *site* get?** Arabic would require an RTL layout. → **Default:** English only at launch.
15. **Do we link back to the public GitHub repo?** It exposes `SECURITY_SCAN.md` open findings, signing-key fingerprints and artifact hashes in `PLAY_RELEASE.md`, and real AdMob IDs. → **Default:** no link.
16. **Which spelling — Cognitix or Cognitx?** The in-app footer has the typo; the cert, email and package all say Cognitix. → **Default:** **Cognitix**, and file a follow-up to fix the string in all 10 locale files.

### D. Technical & deployment
17. **Confirm the real Play listing URL** and that it resolves publicly. Nothing in the repo contains it, and "published" rests on an owner statement with an un-deleted contradicting block at `PLAY_RELEASE.md:151-155`. **This blocks the primary CTA.** → **Default:** `https://play.google.com/store/apps/details?id=com.cognitix.swipeclean`, pending owner confirmation.
18. **Is build 7 on the open production track or a beta?** Commit `f1ef9a7` says "live as the Play beta"; the docs-only `0e1e62a` says public. → **Default:** hold "available now" copy until confirmed.
19. **Host: Cloudflare Pages, Netlify, or Vercel?** → **Default:** Cloudflare Pages (Netlify if the 301 convenience wins).
20. **Add `paths-ignore: ['website/**']` to `gates.yml`?** Saves CI minutes but reports "skipped" on website-only PRs. No branch protection exists today. → **Default:** no; just add the separate `website.yml`.
21. **Add a `.easignore` naming `website/`?** → **Default:** yes, cheap insurance.
22. **Drop `expo-dev-client` from production dependencies?** It is what drags Google ML Kit barcode-scanning (`libbarhopper_v3.so`, 4 ABIs) into the public binary for no feature reason. → **Default:** do it in build 8; it makes a "we ship nothing you didn't ask for" claim defensible.

### E. Content & assets
23. **Who re-captures product screenshots on the green build 7?** Nothing current exists. The 8-frame shot list in `LISTING.md` §5 is the template. **This blocks every feature section.** → **Default:** owner exports the current Play Console screenshots; if unavailable, a fresh 8-frame capture pass.
24. **Are the current Play Console screenshots real captures or another round of illustrated mockups** like the deleted set? This determines whether the site can honestly present them as "the app". → **Default:** assume mockups until confirmed; build CSS device mockups from the §7 token sheet instead.
25. **Were the fabricated store renders (red-X / green-check buttons) ever published to Google Play?** If so that is a store-policy exposure independent of the website. → **Default:** flag for owner review.
26. **Do we re-render the reels on-brand?** It's a ~4-line change: `brandName` default at `AdVideo.tsx:414`, five `accent` values, the `.logo-mark` shape in `index.css:62-90`, and deleting the leaked `.ad-title` at `:435`. Alternatively `screenshot-avalanche.mp4` is *already* SwipeClean-branded and brand-green and could ship after a crop. → **Default:** crop-and-ship `screenshot-avalanche.mp4` for launch; re-render the set later.
27. **Are the AI backgrounds and the ElevenLabs voice licensed for commercial use on an owned website,** and do we preserve or strip the embedded C2PA AI-provenance credentials? → **Default:** preserve the credentials; get written licence confirmation before publishing either.
28. **Where do the reels live** — committed (~64 MB, conflicts with the `outputs/` ignore rule), CDN, or embedded from social? Have any already been posted publicly? → **Default:** CDN-hosted or embedded; never committed.
29. **Has the new green ring icon actually been uploaded to Play Console?** `PLAY_RELEASE.md:36-38` says the listing keeps the old blue card-stack mark until it is; `PROJECT_CONTEXT §11` says it was uploaded. If the former is current, the site and the store will visibly disagree. → **Default:** owner verifies in Console.
30. **Should the hardcoded English failure strings be fixed** before the site claims "10 languages"? Known: "The photos were not deleted." (`photo-library-service.ts:236`) and "This video is already optimized…" (`compression.store.ts:633`). → **Default:** claim 10 languages (498 keys, CI-enforced parity is real); file the two strings for build 8.
31. **Move support off the personal Gmail** (`info.cognitix@gmail.com`) to a branded address? That also requires a rebuild — the address is baked into the shipped bundle. → **Default:** keep the Gmail through build 7; change it in the same release as the privacy-policy URL.