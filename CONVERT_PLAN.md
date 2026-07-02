# Convert feature — cross-platform plan & status

The media-format **Convert** tool ("Studio" tab) must reach **feature parity on iOS
and Android**, all conversions **free + on-device** (no cloud, no paid SDKs). Work
may be sequenced (Android first, iOS after) but a format isn't "done" until it runs
on both platforms.

## Architecture

- **One JS engine seam** (`src/features/convert/engine/conversion-engine.ts`):
  callers only ever call `convertMedia(input, target, options)`.
- **Source-format-aware targets** (`convert-targets.ts`): the target list is a
  function of the source's actual format, and **never offers the file's own
  format back** (no PNG→PNG, MP4→MP4). Pure + unit-tested.
- **Capability gating**: `getConvertCapabilities()` probes each native module via
  `requireOptionalNativeModule`. A target chip is hidden until its engine ships on
  the current platform — so an Android-only format (WebM, until iOS lands) simply
  doesn't appear on iOS. This is the parity-gap escape hatch.
- **Cross-platform native modules** under `modules/` (Swift + Kotlin behind one JS
  API), mirroring `swipe-clean-audio-extract`.

## Format matrix (free, on-device)

| Conversion | Android | iOS | Engine |
|---|---|---|---|
| JPG ↔ PNG ↔ WEBP (minus same) | ✅ | ✅ | expo-image-manipulator (pure JS) |
| HEIC/HEIF → JPG/PNG | ✅ | ✅ | expo-image-manipulator (decodes HEIC) |
| GIF → static JPG/PNG/WEBP | ✅ | ✅ | expo-image-manipulator (first frame) |
| Video → MP4 (H.264) | ✅ | ✅ | react-native-compressor |
| Video → M4A (AAC) | ✅ | ✅ | `SwipeCleanAudioExtract` / `…Encode` |
| Video → **WAV** | ✅ | ✅ | `SwipeCleanAudioEncode` (PCM + RIFF) |
| Video → **MP3** | ⏳ LAME | ⏳ LAME | `SwipeCleanAudioEncode` + bundled LAME |
| Video → **WebM** (VP8/VP9) | ⏳ native | ⏳ libvpx | `SwipeCleanWebm` |
| Video → **GIF** / GIF → MP4 | ⏳ native | ⏳ ImageIO | `SwipeCleanGif` |

## Phase status

- **Phase 1 — UX overhaul + format system — DONE & VERIFIED** (typecheck, lint,
  91 unit tests, i18n parity, Metro bundle). Redesigned Convert screen (animated
  browse→staging, per-item type badges + "from→to" format pill, format bottom
  sheet, same-format exclusion, type-grouped sections, Clear/Cancel), audio saved
  to the device Music library so it actually plays. Pure JS/TS — no rebuild.
- **Phase 2 — image inputs — DONE (live via Phase 1)**: HEIC→JPG/PNG and
  GIF→static already work through the existing image engine; the new target model
  just surfaces them.
- **Phase 3 — audio encode module — WAV + M4A VERIFIED on BOTH platforms**:
  `modules/swipe-clean-audio-encode` (Swift + Kotlin). Android: built + confirmed
  on the S24 (WAV in the format sheet). iOS: `libSwipeCleanAudioEncode.a` compiled
  + linked, Build Succeeded on iPhone 17 Pro sim (iOS 26.5). MP3 path wired but
  `supportsMp3()`/`available` stay false until LAME is vendored (see below).
- **iOS GIF — `SwipeCleanGif`** (`modules/swipe-clean-gif`, apple-only): video→GIF
  via AVAssetImageGenerator + ImageIO (native, NO vendoring). CODE FINISHED +
  compile-reviewed (caps output to first 15s @ 10fps, ≤150 frames, ≤480px; errors
  on no-video-track). Pod-installed. Not yet compile-confirmed on a build (user
  builds/tests). Android GIF still needs a vendored encoder (blocked).
- **iOS status (2026-06-29):** everything doable WITHOUT vendoring is CODE-COMPLETE
  — audio WAV/M4A (verified compiling earlier), GIF (above), images (JS). The only
  iOS features left are MP3 (LAME) and WebM (libvpx) — both BLOCKED on vendoring
  approval, same as Android MP3.
- **Phase 5 — `SwipeCleanWebm` (Android) — WRITTEN & COMPILE-VERIFIED on device**:
  `modules/swipe-clean-webm` — video→VP8 via MediaCodec decode→encode over an EGL
  surface bridge (`InputSurface`/`OutputSurface`/`TextureRender`/`VideoTranscoder`)
  + `MUXER_OUTPUT_WEBM`. Compiled into the S24 build (BUILD SUCCESSFUL). **v1 is
  video-only** — Opus audio is a follow-up (WebM can't carry the source AAC track).
  Runtime transcode correctness pending on-device QA. iOS WebM (libvpx) not started.
- **Phase 4 — `SwipeCleanGif`** (video→animated GIF) — JS engine + probe in place
  (gif→mp4 dropped from scope; a GIF source converts to a still image via the image
  engine). **Native module BLOCKED on vendoring approval** — Android has no native
  GIF encoder, so it needs a vendored encoder (e.g. AnimatedGifEncoder).
- **Phase 3 MP3 / LAME — CODE-COMPLETE both platforms (2026-06-29), needs user build**:
  user approved vendoring. Official **LAME 3.100** (LGPL) vendored at
  `modules/swipe-clean-audio-encode/lame/` (libmp3lame + mpglib + vector + a
  hand-written `config.h`; `HAVE_CONFIG_H=1`, no SSE on ARM). Android: `CMakeLists.txt`
  compiles it + `src/main/cpp/lame_jni.c` → `libswipecleanlame.so`; `LameBridge`
  (Kotlin) `System.loadLibrary` + JNI `nativeEncode` on the MediaCodec-decoded PCM;
  `build.gradle` has externalNativeBuild + 4 ABIs. iOS: podspec compiles the LAME C
  (`../lame/**`, header search paths) + `SCLameEncoder.m` (AVAssetReader→PCM→LAME);
  Swift calls it; `LameBridge.available = true`. **BUILDS VERIFIED on both platforms
  (2026-06-29)** — Android app built + installed on emulator (LAME NDK, 4 ABIs); iOS
  app built + installed on iPhone 17 Pro sim (Build Succeeded). Fixed 3 config bugs:
  (1) `ieee754_float32_t` typedef missing → add to config.h; (2) `#define HAVE_NASM 0`
  pulled in x86 asm → leave HAVE_NASM undefined; (3) CocoaPods `../lame` shifted the
  pod base dir and broke `public_header_files` → made the pod SELF-CONTAINED with a
  copy of `lame/` under `ios/`. Runtime MP3 correctness pending user QA. See
  memory `lame-mp3-vendoring`. libvpx/WebM-iOS still NOT approved/started.
  NOTE: `android/gradle.properties reactNativeArchitectures` was set to `arm64-v8a`
  only (dev/disk); restore the full ABI list before a release build.

## Native vendoring TODO (the not-free-of-effort bits)

- **MP3 / LAME** (LGPL 2.1): build LAME 3.100 — Android via CMake/NDK
  (`externalNativeBuild`) into `SwipeCleanAudioEncode`, iOS as a **dynamic**
  xcframework (LGPL → link dynamically, ship license + relink capability). Flip
  `LameBridge.AVAILABLE`/`available` to true and implement `encodeMp3` (feed the
  decoded PCM to `lame_encode_buffer_interleaved` → `lame_encode_flush`).
- **WebM / libvpx** (BSD-3) + **libwebm** (BSD): Android = MediaCodec VP8/VP9 +
  `MUXER_OUTPUT_WEBM` (no vendoring). iOS = compile libvpx for arm64 device + sim
  into an xcframework (the official `iosbuild.sh` predates arm64-sim/xcframework —
  must patch).
- **GIF**: iOS = ImageIO `CGImageDestination` + `UTType.gif` (native). Android =
  bundle a GIF encoder over decoded frames.

## Build / verify loop

Native modules activate only after a **dev-client rebuild**:
`__UNSAFE_EXPO_HOME_DIRECTORY=/tmp/expo-home JAVA_HOME=…openjdk@17 npx expo run:android`
(or `run:ios`). Until rebuilt, the capability probes return false and the new
chips stay hidden — the app keeps working. Unit tests run under **Node 22**
(`~/.nvm/versions/node/v22.15.0`); Node 20.17 is too old for vitest 4.
