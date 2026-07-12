# SwipeClean — Deep Security & Bug Scan

_Scan date: 2026-07-11. Read-only audit — no code was modified. Scope: full repo (`src/`, `app/`, `android/`, `ios/`, `modules/`, configs, `.env*`, git history, dependencies). Six parallel area audits (secrets/config, Android native, iOS native, vendored native modules, billing/ads/entitlements, JS app layer) plus `npm audit`; every finding below was verified against the actual source lines._

## Verdict at a glance

**No Critical findings. No committed secrets. No data-loss path in the delete flows. No Pro-entitlement backdoors in shipping code.** The destructive paths (delete, compress-then-delete) are unusually defensively written — correct ordering, verification gates, post-await state re-reads.

The real exposure clusters in four areas:

1. **Ads/GDPR consent** — fail-open consent handling means ad requests can fire before/without consent in regulated regions (AdMob policy / GDPR risk to the ad account).
2. **LAME LGPL compliance on iOS** — statically linked, no in-app attribution (store/legal risk, blocks a clean iOS release).
3. **Release-hygiene traps** — Test Store env flag ungated by `__DEV__`, debug-signing fallback, R8 off, iOS test AdMob IDs.
4. **Crash/robustness classes in the media pipeline** — whole-track PCM in RAM, codec loops that can hang forever on corrupt media, a cancel-race that pollutes persisted state.

Severity counts: **Critical 0 · High 2 · Medium 12 · Low ~18**.

---

## HIGH

### H1. LAME (LGPL v2) statically linked into the iOS binary; no in-app license/attribution on either platform
- **Files:** `modules/swipe-clean-audio-encode/ios/SwipeCleanAudioEncode.podspec:13,33-40` (`s.static_framework = true`, LAME `.c` sources compiled into the pod); `modules/swipe-clean-audio-encode/android/CMakeLists.txt:13-16`
- **Description:** On Android, LAME builds into its own shared lib `libswipecleanlame.so` (close to LGPL §6(b)'s "suitable shared library mechanism" — defensible). On iOS it is **statically compiled into the signed app binary**; LGPL v2 §6 then requires distributing relinkable object files, which is effectively impossible for a signed App Store binary (the classic "LGPL on iOS" problem). Additionally, there is **no in-app open-source-licenses screen** anywhere in `src/` mentioning LAME or LGPL (the vendored `COPYING` file exists in the repo but ships nowhere user-visible).
- **Risk:** Legal/takedown exposure; Apple has historically pulled apps over (L)GPL complaints. Applies the day an iOS build ships with MP3 support; the attribution gap applies to Android **now** (MP3 is currently removed as a product decision, but the .so still ships if compiled in).
- **Fix:** Add an "Open-source licenses" screen with the LGPL text + source offer (LAME 3.100 + your modified `config.h`). For iOS: build LAME as an embedded dynamic framework, publish relinkable objects, or drop MP3-on-iOS. Keep the Android shared-.so scheme and document the source offer.

### H2. Ad requests can fire before/without UMP consent (fail-open consent pipeline)
- **Files:** `src/features/ads/ads-consent-store.ts:21` (`canRequestAds: true` default); `src/features/ads/consent.service.ts:24-26` (any UMP error → `true`, "never block ads on a consent error"); `app/_layout.tsx:37-52` (gather deferred behind `InteractionManager.runAfterInteractions`); `src/features/ads/interstitial.service.ts:49-59` and `src/features/ads/rewarded.service.ts:52-58` (no `canRequestAds` check inside the services)
- **Description:** Three compounding gaps: (a) the consent store defaults to `true` and is only corrected after `gather()` resolves, so on every launch there is a window where a previously-denying user's `<AdBanner />` computes `shouldShowAds === true` and issues a real banner request; (b) any UMP error fails open, so an EEA user whose consent form errors gets ads with no recorded consent; (c) the interstitial/rewarded services never check consent themselves — after a denial, every task-end trigger (post-delete `review-delete-list-screen.tsx:106`, post-compression `compression.store.ts:158`) hits the `if (!loaded) { ad.load(); return; }` branch and issues a fresh ad request. `requestNonPersonalizedAdsOnly: true` mitigates personalization but does not replace the consent gate.
- **Risk:** Google UMP policy requires ads only when `canRequestAds` is true; violations are a GDPR compliance issue and can get the AdMob account flagged/suspended — a direct business risk in the **currently shipping Android build**.
- **Fix:** Default `canRequestAds: false`, flip true only after `gather()` resolves (banner appears a moment later). Fail closed on UMP errors, or fail open only when `getConsentInfo` says consent is not required. Add a `canRequestAds` bail-out at the top of `preload()`, `maybeShow()`, and `showForReward()` (defense-in-depth in the services, not just the `_layout` call site).

---

## MEDIUM

### M1. RevenueCat Test Store flag has no `__DEV__` guard — a release build can ship free Pro
- **File:** `src/features/subscription/revenuecat.service.ts:156-159`
- **Description:** `if (process.env.EXPO_PUBLIC_REVENUECAT_USE_TEST_STORE === "1") return TEST_API_KEY;` is evaluated in release builds too. Test Store purchases auto-succeed with no payment. Project history (`PROJECT_CONTEXT.md`) shows release builds have been made with temporary `.env.local` contents before — a stale flag would grant everyone fully-functional free Pro. Only documentation (`.env.example:8-12`) protects against this today.
- **Fix:** `if (__DEV__ && process.env.EXPO_PUBLIC_REVENUECAT_USE_TEST_STORE === "1")`, and/or throw loudly in release when the flag is set.

### M2. Cancelled compression still saves the output to the gallery and pollutes persisted state (verified race)
- **Files:** `src/features/compression/compression.store.ts:117-160` (`markCompleted`), `:357-373` (`cancelJob`); `src/features/compression/compression.service.ts:36`
- **Description:** `cancelJob` only flips store state — it never aborts the native encode (react-native-compressor supports `cancelCompression`). The still-running job then verifies, **saves the compressed copy into the device gallery**, and calls `markCompleted`. The zustand `set()` correctly early-returns for cancelled jobs (line 120), and the stats ledger below is guarded on post-set status (lines 152-153) — but the `useAppStore.setState` at **lines 147-149 runs unconditionally**, adding the item to persisted `compressedMedia`.
- **Risk:** After a cancel: an orphan compressed duplicate appears in the gallery; the source asset is thereafter excluded from every cleanup scan (`getCompressedSourceIds()` → `ignoredSourceIds`, `app-store.ts:583-585`) so it silently disappears from the Cleanup feature; the Compressed screen lists an item the user cancelled. Same class in Convert: a cancelled conversion's artifact is still saved to the gallery (`convert.store.ts:221-232` + `convert.service.ts:54`), though the convert store skips its own bookkeeping.
- **Fix:** Guard the `useAppStore.setState` on post-set job status (mirror the ledger guard two lines below); call the compressor's native cancel from `cancelJob`; delete the temp output on cancel.

### M3. App Lock PIN stored as plaintext (not hashed) in SecureStore
- **File:** `src/services/app-lock-service.ts:153` (stores raw passcode), `:165-168` (raw string compare)
- **Description:** The 4-digit passcode is persisted verbatim. SecureStore is Keystore/Keychain-encrypted at rest, but the raw value is recoverable on a rooted device or via Keychain dumps — and the iOS Keychain survives uninstall (the code acknowledges lingering passcodes at `compress-run-screen.tsx:171-174`). Users commonly reuse their device/bank PIN.
- **Fix:** Store `salt + SHA-256(salt‖pin)` (`expo-crypto` is available in the SDK) and compare digests; migrate lazily on first successful verify.

### M4. App Lock only engages on cold start — never re-locks on background
- **File:** `src/components/app-lock-gate.tsx:14-19, 68-71` (cold-start-only by design; no `AppState` listener re-arms the gate)
- **Risk:** Once unlocked, the photo library, delete queue, and Smart Clean results stay exposed until the process dies — much weaker than users will assume from a "lock app" toggle.
- **Fix:** `AppState` listener that re-arms `locked` after N seconds in background (grace period for share-sheet round-trips).

### M5. No rate limit / lockout on PIN attempts
- **Files:** `src/components/app-lock-gate.tsx:155-170`; `src/screens/compress-run-screen.tsx:184-196`
- **Description:** `verifyPasscode` can be called indefinitely — no delay, counter, or backoff over a 10,000-combination space.
- **Fix:** Persist a failed-attempt counter (SecureStore) with exponential backoff (e.g. 30 s after 5 failures).

### M6. Whole audio track decoded to PCM in RAM → OOM on long videos
- **Files:** `modules/swipe-clean-audio-encode/android/.../AudioEncodeModule.kt:104-155` (`ByteArrayOutputStream` accumulation + `toByteArray()` copy); `modules/swipe-clean-audio-encode/ios/AudioEncodeModule.swift:81-88` (`var pcm = Data()` grows unbounded for WAV)
- **Description:** MP3/WAV paths buffer the entire decoded track: 48 kHz stereo ≈ 11.5 MB/min → a 1-hour video ≈ 690 MB, with growth-doubling and JNI pin-or-copy multiplying peak usage several-fold. Given this app's history of large-gallery OOMs, this is a realistic hard OOM kill (not a promise rejection).
- **Fix:** Stream: feed decoder chunks directly to LAME per-chunk, or spool PCM to a temp file; for WAV write a placeholder header and patch sizes afterwards (a `RandomAccessFile` is already used).

### M7. Codec drain loops can spin forever on malformed media; no timeout or cancellation
- **Files:** `modules/swipe-clean-audio-encode/android/.../AudioEncodeModule.kt:118-148` (`while (!sawOutputEos)`); `modules/swipe-clean-webm/android/.../VideoTranscoder.kt:85-145` (`while (!outputDone)`)
- **Description:** Both loops rely solely on the codec emitting `BUFFER_FLAG_END_OF_STREAM`. A corrupt/truncated gallery file (untrusted input — includes downloaded videos) or buggy OEM codec that stops producing output after input-EOS causes an infinite 10 ms busy-wait: the JS promise never settles, no cancellation reaches native, CPU/battery burn until process death.
- **Fix:** Bail after a bounded number of consecutive `INFO_TRY_AGAIN_LATER` iterations post-input-EOS (CTS pattern); plumb an overall deadline + cancel flag from JS.

### M8. iOS: potential out-of-bounds read on non-contiguous `CMBlockBuffer`
- **Files:** `modules/swipe-clean-audio-encode/ios/SCLameEncoder.m:79-84`; `modules/swipe-clean-audio-encode/ios/AudioEncodeModule.swift:86-87`
- **Description:** Both call `CMBlockBufferGetDataPointer` with `lengthAtOffset = NULL` and read `totalLength` bytes. If the buffer is non-contiguous (not guaranteed by the API contract for untrusted user media), the pointer only covers the first segment → heap over-read (garbage audio at best, crash at worst).
- **Fix:** Check `CMBlockBufferIsRangeContiguous` / use `CMBlockBufferCreateContiguous`, or copy segment-wise via `CMBlockBufferCopyDataBytes`.

### M9. Release builds are not minified/obfuscated (R8 disabled)
- **Files:** `android/app/build.gradle:69,144-147`; `android/gradle.properties` (flag absent → defaults false)
- **Risk:** Shipped AAB is trivially decompilable — all Kotlin symbols and client-side gating logic readable, easing reverse engineering/repackaging.
- **Fix:** `android.enableMinifyInReleaseBuilds=true` (+ `enableShrinkResourcesInReleaseBuilds=true`) in `gradle.properties`; test with the existing `proguard-rules.pro`.

### M10. Release build silently falls back to debug signing when `keystore.properties` is missing
- **File:** `android/app/build.gradle:143` (`keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug`)
- **Risk:** A "release" APK built on CI/another machine gets signed with the well-known debug key (`android`/`androiddebugkey`) — could be accidentally distributed or trivially impersonated on sideload channels. (Play Console would reject the upload, limiting real-world impact.)
- **Fix:** `throw new GradleException(...)` when the keystore is absent, or gate the fallback behind an explicit `-PallowDebugSigning` flag.

### M11. iOS ships Google's sample AdMob App ID and test ad units — nothing gates an iOS release
- **Files:** `app.json:66` + `ios/SwipeClean/Info.plist:43-44` (`ca-app-pub-3940256099942544~1458002511`, Google's public demo App ID); `src/features/ads/ad-config.ts:19-26` (iOS units = `TestIds.*`)
- **Description:** Deliberate placeholders (iOS out of v1 scope), but no release-build assertion exists: a production iOS binary would serve test ads on the demo App ID — AdMob policy violation and zero revenue. Related gaps for later: no `SKAdNetworkItems` (broken attribution) and no ATT string if tracking is ever added (`Info.plist`, keys absent).
- **Fix:** Before any iOS release: real IDs in `app.json` + re-prebuild; add a throw in `ad-config.ts` when `!__DEV__ && Platform.OS === "ios"` and the unit is still a `TestIds` value; add `skAdNetworkItems` to the plugin config.

### M12. Unbounded on-disk caches (thumbnails, full-res prefetch, video frames)
- **Files:** `src/services/thumbnail-service.ts:112` (one JPEG per asset per size bucket, no eviction/cap); `src/store/media-index-store.ts:337-339` (full-library scan prefetches 12 **full-resolution** images per 60-asset page into expo-image's `memory-disk` cache); `src/features/compression/compression-service.ts:145-158` (`videoThumbnailCache` evicts map entries but never deletes extracted frame files)
- **Risk:** Multi-GB cache footprint on large libraries — ironic for a storage-cleaning app; OS reclamation of `cacheDirectory` mitigates but defeats the caches under pressure.
- **Fix:** Byte-budgeted LRU eviction (e.g. 500 MB); skip full-res prefetch during full scans (grids render thumbnails).

---

## LOW

### L1. App Lock fails open on any SecureStore error
- **Files:** `src/services/app-lock-service.ts:132-146` (`hasPasscode` → `false` on catch); `src/components/app-lock-gate.tsx:82-85` (no passcode → unlock)
- Deliberate and documented ("never strand the user"), but a Keystore read error — or restoring an app backup to a device without the Keystore entry — silently bypasses the lock. Consider failing open only for "module absent" and showing a "lock unavailable" notice for runtime errors.

### L2. Deep-link surface: every route externally invokable; params unvalidated
- **Files:** `app.json` (`scheme: "swipeclean"`); `android/app/src/main/AndroidManifest.xml:32-38` (exported `MainActivity`, `VIEW`/`BROWSABLE` for `swipeclean` + `exp+swipeclean-free`); `src/screens/compress-run-screen.tsx:35,68-87` (`origin` param → `router.dismissTo(origin as never)`; auto-enqueues a compression job for any `id` on mount)
- `swipeclean://compress-run?id=…&origin=<junk>` from any app auto-starts a compression job, and an unknown `origin` route throws (crash). Custom schemes are also hijackable by other apps (no ownership verification). No sensitive action is reachable — deletes always require the OS consent dialog and the PIN gate guards delete-original — so impact is nuisance job-starts and navigation crashes. **Fix:** allow-list `origin` against known routes; validate `id` against the media index before enqueuing.

### L3. Native modules delete-then-write any caller-supplied path (defense-in-depth)
- **Files:** `AudioEncodeModule.kt:37-39`, `AudioExtractModule.kt:60-62`, `WebmModule.kt:23-25`, `lame_jni.c:47`, `AudioEncodeModule.swift:19`, `GifModule.swift:28`
- All four modules take `outputPath` verbatim from JS, delete whatever exists there, and write. Current callers (`audio-engine.ts:59`, `webm-engine.ts:35`, `gif-engine.ts:38`) construct safe sandbox paths with typed extensions, so **no exploitable traversal exists today** — but the module contract is "delete + overwrite any writable path", an arbitrary-file-overwrite primitive for any future caller. **Fix:** canonicalize and require the path under `cacheDir`/`filesDir` (iOS: app container) inside each module.

### L4. Converted audio files accumulate in `documentDirectory` forever
- **Files:** `src/features/convert/engine/audio-engine.ts:56-59`; `src/features/convert/convert.service.ts:47-52` (keeps the sandbox copy AND saves to media store); no `deleteAsync` anywhere under `src/features/convert`
- Documents dir is never OS-reclaimed (and iOS-backed-up by default); failed/partial encodes persist too. **Fix:** delete the sandbox file on `resetCompletedJob`, or sweep stale `convert-*` files at launch; prefer `cacheDirectory` once a media-store copy exists.

### L5. Unchecked `fwrite`/`fclose` → disk-full reported as encode success
- **Files:** `modules/swipe-clean-audio-encode/android/.../lame_jni.c:69,75`; `ios/SCLameEncoder.m:85,98`
- A truncated MP3 gets saved to the media store as a "successful" conversion. **Fix:** check `fwrite` return and `fclose != 0`.

### L6. `KEY_MAX_INPUT_SIZE` from container metadata trusted for allocation
- **Files:** `AudioEncodeModule.kt:83-84`; `AudioExtractModule.kt:68-74`
- A crafted MP4 declaring a huge value → instant `OutOfMemoryError`; a too-small value → `readSampleData` throw. **Fix:** `coerceIn(64KB, 8MB)` with retry-larger.

### L7. WebM: `MediaMuxer` fd leak when never started; partial outputs not cleaned on failure
- **File:** `modules/swipe-clean-webm/android/.../VideoTranscoder.kt:77,125,153` — `release()` only called `if (muxerStarted)`; a pre-`start()` failure leaks the native fd and leaves a zero-byte `.webm`. `release()` is safe on an unstarted muxer (only `stop()` isn't). Same "partial output not deleted on failure" applies to the audio-encode paths.

### L8. EGL/GLES glue robustness gaps (crash-shaped, not exploitable)
- **Files:** `modules/swipe-clean-webm/android/.../InputSurface.kt:39-41` (`numConfigs[0] == 0` unchecked → null-config crash on exotic devices); `OutputSurface.kt:39-42` (spurious wakeup treated as timeout — the classic Grafika wait-loop bug)

### L9. Persisted "active" entitlement has no local expiry check (unbounded offline grace)
- **Files:** `src/store/subscription-store.ts:284-290`; `src/features/subscription/feature-access.service.ts:16-18`
- `subscriptionStatus === "active"` from AsyncStorage grants Pro until a successful RevenueCat refresh; `expiresAt` is stored but never compared to now. Exposure: a lapsed subscriber keeps Pro while fully offline. **Fix:** treat "active" as free when `expiresAt` is more than a grace window (3–7 days) past.

### L10. `localCancelled` can suppress a legitimate promotional entitlement
- **Files:** `src/store/subscription-store.ts:210-225,339-350`; `revenuecat.service.ts:255-259`
- The Test-Store-targeted local-cancel path also catches RevenueCat `PROMOTIONAL` grants (`source: "none"`): a dashboard-granted Pro user who taps "cancel" gets their still-active entitlement suppressed on every refresh until a purchase. Revokes rather than grants, but it's a persisted kill-switch. **Fix:** key the local-cancel path on the raw entitlement store value.

### L11. Interstitial/rewarded consent gap in dialog paths
- Covered under **H2(c)** — listed here as the per-service fix reminder (`interstitial.service.ts`, `rewarded.service.ts`).

### L12. "Share" in photo preview shares the URI string, not the media
- **File:** `src/screens/photo-preview-screen.tsx:58-60` — Android `Share.share` uses `message`, so recipients get the literal `content://media/…` text. Use `expo-sharing` (already a dependency).

### L13. Unbounded persisted growth: `history` and `reviewedPhotoIds`
- **File:** `src/store/app-store.ts:447,557-568` — `history` is never capped (the events ledger is, at 2000); `reviewedPhotoIds` approaches library size. AsyncStorage rows have practical Android limits (~2 MB cursor window); a multi-year power user could hit hydration failures. **Fix:** cap history (~500); prune `reviewedPhotoIds` against the index on reconcile (the limited-access path already does — `app-store.ts:630-633`).

### L14. Compression verify falls back to a pixels-based size estimate
- **File:** `src/features/compression/compression.service.ts:92-94` — when the original's real size can't be read, verification trusts `originalSizeBytes`, which can be an estimate (`photo-library-service.ts:140`). An overstated estimate could pass a not-smaller output, and the user may then delete the genuinely smaller original. Rare edge (unreadable size), but this is the one residual gap in an otherwise excellent delete-safety chain. **Fix:** fail verification when the real size is unreadable.

### L15. `restoreHistoryItem` is dead code with misleading semantics
- **File:** `src/store/app-store.ts:487-492` — flips `restored: true` on a permanently-deleted entry; nothing can be restored; currently unreferenced. Remove before someone wires it to a "Restore" button.

### L16. iOS release-hygiene bundle (act before any iOS submission)
- Camera + microphone permissions declared but unused, with boilerplate strings (`Info.plist:58-63`; from `expo-image-picker` plugin defaults) — App Review rejection bait; set `cameraPermission: false` / `microphonePermission: false` in the plugin config.
- `UIBackgroundModes: audio` from `supportsPictureInPicture: true` (`Info.plist:74-77`) — drop if PiP isn't a real feature.
- `NSAllowsLocalNetworking: true` ships in release (`Info.plist:51-57`; ATS otherwise strict, `NSAllowsArbitraryLoads` false) — acceptable Expo default; strip via config plugin for hardening.
- `CFBundleShortVersionString` hardcoded `0.1.0` vs `MARKETING_VERSION 1.0` vs `app.json 1.0.0` — cosmetic mismatch.
- `aps-environment: development` entitlement — normally rewritten at signing; verify the archive.
- Dev-client pods/scheme (`exp+swipeclean-free`) compile into release — build store binaries without `expo-dev-client`.

### L17. Dead MPEG decoder (mpglib) compiled into the LAME library on both platforms
- **Files:** `modules/swipe-clean-audio-encode/android/CMakeLists.txt:10` + `lame/config.h:72` (`HAVE_MPGLIB 1`); `ios/SwipeCleanAudioEncode.podspec:37`
- The app only encodes, yet LAME's bundled decoder — historically the CVE-bearing part — is compiled in. Unreachable today; gratuitous attack surface and binary size. Vendored LAME is 3.100 (current; pre-3.100 CVEs fixed). **Fix:** drop the `mpglib` glob and `HAVE_MPGLIB`.

### L18. JitPack in dependency resolution
- **File:** `android/build.gradle:19` — mild supply-chain exposure; scope with `exclusiveContent` to the dependency that needs it.

---

## Dependencies (`npm audit`, 2026-07-11)

**1 High, 19 Moderate, 0 Critical — none in runtime app code.** The High (undici — HTTP header injection via Set-Cookie percent-decoding) and almost all moderates sit in the Expo CLI/build-tooling chain (`@expo/cli`, `@expo/config`, `expo-dev-launcher`, `xcode`, `uuid`, `postcss`, `js-yaml`); they affect the developer machine/build process, not the shipped bundle. Nearly all resolve via the Expo SDK 57 upgrade (`expo@57.0.4` et al.). `@expo/ngrok`'s uuid advisory has no fix — dev-only, and the tunnel workflow is already broken/unused. **Recommendation:** take the SDK 57 bump when convenient; no emergency.

Runtime deps are current-generation (RN 0.81.5, React 19.1, Expo SDK 54, Zustand 5, RevenueCat 10, react-native-google-mobile-ads 16) — nothing obviously stale or abandoned. `jpeg-js` (pure-JS decoder used in the perceptual-hash pipeline) has had past DoS advisories in old versions; 0.4.4 is the patched line.

---

## Verified clean (checked, not assumed)

- **Secrets & git hygiene:** no committed secrets anywhere in the tree **or git history** (`git log --all -S` on the real keys). `.env.local` (real RevenueCat public keys), `android/release.jks`, `android/keystore.properties` exist locally, are gitignored, never committed. Only RevenueCat *public* SDK keys are used (no `sk_` anywhere). Repo-root log files contain no tokens. Tracked `debug.keystore` is standard RN practice.
- **No Pro backdoors:** repo-wide greps for `forcePro`/`debugPremium`/`unlock`/`override`/`grantPro` etc. — the historical `EXPO_PUBLIC_FORCE_PRO` and `debugProOverride` are fully removed; the single entitlement source is RevenueCat `CustomerInfo`; unknown feature keys fail closed; `redeemCode` has no manual entitlement flip; rewarded grants only on `EARNED_REWARD`.
- **Android manifest:** `allowBackup="false"` (enforced with `tools:replace`); cleartext blocked in release (debug-only exception); exactly one exported component (launcher activity); minimal permissions (READ_MEDIA_* + Android-14 partial access, `READ_EXTERNAL_STORAGE` capped at SDK 32, no MANAGE_EXTERNAL_STORAGE/camera/location); foreground-service type matches its permission; stock Kotlin templates, no custom intent parsing; no FileProviders defined by the app; queries block scoped to https VIEW.
- **iOS:** ATS strict (`NSAllowsArbitraryLoads` false); accurate photo-library/Face ID strings; no debug flags in Release config; OTA updates disabled (`EXUpdatesEnabled=false`); PrivacyInfo.xcprivacy present and currently accurate; stock AppDelegate, no custom native code.
- **Delete flows (the crown jewels):** compress → verify smaller → save to library → only then offer delete; `deleteAssetsAsync === false` treated as failure; `permanentlyDeleteMarked` re-reads state after the OS-dialog await; Smart Clean has a last-line destructive guard (settled index, access-level match, ids-subset check); a native page-read failure can never truncate the media index. **No data-loss path found.**
- **No WebView, no eval/new Function/dynamic require, no http:// URLs** in `src/`+`app/`. Intent launcher constrained to `ACTION_VIEW` + FileProvider content URI + read-only grant.
- **Ad config (Android):** `__DEV__` always forces Google `TestIds` (protects the AdMob account); real IDs only in release; conservative interstitial frequency (task-end only, shared 3-min cooldown).
- **JNI glue (`lame_jni.c`):** channels/sample-rate validated, worst-case MP3 buffer sized per LAME docs, no over-reads in the chunk math, centralized cleanup on every path, no dangerous C functions.
- **Media pipeline OOM work:** downscale-on-decode thumbnails, concurrency semaphore, 8K guard, cache clearing on background — the documented S24 crash class is fixed at the source.

---

## Priority actions

**Before the next Android release:**
1. **H2** — consent fail-open + service-level consent gates (AdMob account risk, live today).
2. **M1** — `__DEV__`-gate the Test Store flag (one line; closes the free-Pro-for-everyone operator error).
3. **M2** — guard the cancelled-job `compressedMedia` write + native cancel.
4. **M9/M10** — enable R8; fail the build instead of debug-sign fallback.
5. **H1 (Android half)** — add the open-source licenses screen with LGPL attribution.

**Before any iOS release:** H1 (iOS LGPL linkage), M11 (real AdMob IDs + SKAdNetwork), L16 bundle.

**Opportunistic hardening:** M3–M5 (App Lock: hash, re-lock, backoff), M6–M8 (media-pipeline OOM/hang/OOB), M12 + L4 (cache/documents growth), the L-list, and the Expo SDK 57 bump for the dependency advisories.
