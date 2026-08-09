# SwipeClean

An on-device photo & video **storage cleanup** app for Android and iOS. No
backend, no account, no cloud upload — every byte stays on the phone.

- **Swipe** — a card deck: right keeps, left marks for deletion. Marks queue up
  and are only deleted after an explicit confirmation step.
- **Compress** — re-encode heavy photos/videos at low/medium/high, verified so an
  original is never deleted for a copy that didn't actually shrink.
- **Smart Clean** *(Pro)* — 8 detectors find duplicates, near-duplicates, blurry
  shots, screenshots, memes, and oversized media.
- **Studio → Convert** *(Pro)* — on-device format conversion (image jpg/png/webp,
  video → mp4/webm/gif, audio extraction).
- Plus Stats, a Premium paywall, App Lock (PIN + biometric), and a 10-language UI.

**Stack:** Expo SDK 54 · React Native 0.81 · React 19 · TypeScript 5.9 (strict) ·
Expo Router 6 · Zustand 5 + persist · Hermes + New Architecture · i18next.

> **Naming:** the app ships as *SwipeClean*; the repo directory, git remote, npm
> slug, and RevenueCat entitlement each use a different historical name
> (`PhotoSweep`, `CleanSwipe`, `swipeclean-free`, `CleanSwipe Pro`). They refer to
> the same product. The application id is `com.cognitix.swipeclean`.

---

## Prerequisites

| | |
|---|---|
| Node | ≥ 20.19 (Vitest 4 requires it) |
| JDK | **17** for Android Gradle (JDK 25 is too new for Gradle 8.14) |
| Android SDK | `ANDROID_HOME` set; `adb` at `$ANDROID_HOME/platform-tools/adb` |
| Xcode | for iOS; deployment target 15.1, CocoaPods 1.16+ |

This is a **bare workflow** project: `android/` and `ios/` are committed and
authoritative. `app.json` documents prebuild parity but is not the shipped truth —
edit the native projects directly, or re-run `npx expo prebuild` deliberately.

## Run it

```bash
npm install
```

`postinstall` applies `patches/react-native-background-actions+4.1.0.patch`
(foreground-service notification latency, 10 s → 390 ms). Don't skip it.

The app uses **`expo-dev-client`**, so plain Expo Go will not work — you need a
dev build:

```bash
npm run android
```

```bash
npm run ios
```

After that, day-to-day you only need Metro:

```bash
npm start
```

On a **physical Android device**, Metro is reached over USB:

```bash
adb reverse tcp:8081 tcp:8081
```

Rebuild natively (`npm run android` / `npm run ios`) whenever you change
`modules/`, `android/`, `ios/`, or add a native dependency — otherwise the app
crashes with `Cannot find native module …`.

## Quality gates

All four must pass. There is no pre-commit hook; CI runs them on push/PR
(`.github/workflows/gates.yml`).

```bash
npm run typecheck && npm test && npm run i18n:check && npm run lint
```

- `typecheck` — `tsc --noEmit`, expected clean.
- `test` — Vitest. **Pure modules only**: `vitest.config.ts` scopes to
  `src/**/*.test.ts` in a `node` environment, so anything importing React,
  React Native, Expo, or `@/i18n` is out of scope by design. Stores, screens, and
  services are covered by the Maestro suite, not unit tests.
- `i18n:check` — key + `{{placeholder}}` parity of all 10 locales against
  `en.json`, plus advisory **orphan-key** detection. Add runtime-composed key
  prefixes to `DYNAMIC_KEY_PREFIXES` in `scripts/check-i18n.mjs`.
- `lint` — ESLint 9. Expect **0 errors** and a nonzero warning count; the
  React-Compiler rules are deliberately `warn` in `eslint.config.js`.

### UI / E2E

```bash
maestro test .maestro
```

Needs the app installed as `com.cognitix.swipeclean`, a Maestro CLI on PATH, and
(for a dev-client build) Metro running. Flows assume a **Free** user and never
tap the purchase CTA. See [`.maestro/README.md`](.maestro/README.md).

## Configuration & secrets

Two git-ignored inputs are required for a **release** build. Neither is in the
repo, and a clean clone fails without them.

**1. `.env.local`** — copy from [`.env.example`](.env.example) and fill in the
RevenueCat *public* SDK keys. Expo inlines `EXPO_PUBLIC_*` into the JS bundle at
**build** time, so these must be correct before you build, not after.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | Play billing (`goog_…`) |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | App Store billing (`appl_…`) |
| `EXPO_PUBLIC_REVENUECAT_USE_TEST_STORE` / `…_TEST_API_KEY` | Test Store, **dev only** (double-gated behind `__DEV__`) |
| `EXPO_PUBLIC_ADS_USE_TEST` | Force Google test ad units. **Must be empty for production** |
| `EXPO_PUBLIC_EXPO_GO_DEMO` | Set by `npm run start:demo`; stubs native modules for Expo Go |

Missing the iOS key does not fail the build — it makes the iOS paywall throw at
runtime (no purchase, no restore, no redemption).

`eas.json` has **no `env` block**, and `.env.local` is never uploaded, so an EAS
cloud build gets `undefined` for all of these unless they are configured as EAS
environment variables.

**2. Android release signing** — `android/keystore.properties`
(`storeFile` / `storePassword` / `keyAlias` / `keyPassword`) pointing at
`android/release.jks`. A release task without it throws a `GradleException`
rather than silently signing with the debug key.

## Release notes (Android)

```bash
cd android && ./gradlew :app:bundleRelease
```

- `assembleRelease` (APK, for device testing) and `bundleRelease` (AAB, for Play)
  are **separate tasks** — building the APK does not refresh the AAB.
- `versionCode` / `versionName` live in `android/app/build.gradle` only;
  `app.json` has no `versionCode`.
- A build made with `EXPO_PUBLIC_ADS_USE_TEST=1` serves Google test ads forever
  and earns nothing. It logs a loud warning at startup and **must not be promoted
  to production** — cut production separately with the flag unset and a higher
  `versionCode`.

## Where to look next

- [`AGENTS.md`](AGENTS.md) — working rules for AI agents on this repo.
- [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — the real documentation: §3 file
  map, §5 architecture and data flow, §7 business rules, §10 known issues, §11
  dated Feature History.
- `SECURITY_SCAN.md`, `APP_ANALYSIS.md`, `DESIGN-BRIEF.md`, `CONVERT_PLAN.md` —
  dated one-shot snapshots. Check the date before trusting them.
