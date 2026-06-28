# UI / E2E tests (Maestro)

End-to-end UI flows for SwipeClean, driven by [Maestro](https://maestro.mobile.dev).
They run against the built Android app on a connected device or emulator.

## Flows

| File | What it covers |
| --- | --- |
| `01_smoke.yaml` | App boots; brand header + all four bottom tabs render. |
| `02_navigation.yaml` | Navigates Compress / Stats / Premium / Swipe; asserts a screen-unique element on each. |
| `03_settings.yaml` | Opens Settings; asserts Account & Security / Appearance / Language / Permissions; toggles Dark Mode (and back). |
| `04_premium.yaml` | Free-user Premium upsell: Pro feature list, plan selection (no checkout), Restore. |
| `05_swipe.yaml` | Swipe scope label + month-selector sheet (media-type tabs + month list). Pill opened conditionally (needs media access). |
| `06_compress.yaml` | Compress Filter sheet (Both/Photos/Videos + months) and the Estimated-savings control. No compression is started. |
| `07_stats.yaml` | Stats cards + Swipe Distribution chart + Free Advanced Stats locked card → paywall sheet → dismiss. |
| `08_settings_full.yaml` | Settings deep: Language picker modal, Notifications section, Compression "After compression" policy row. |
| `09_swipe_interaction.yaml` | Conditional left-swipe (mark for deletion) then Undo; fully guarded so it passes on an empty library. |

## Prerequisites

1. **App installed** on the device/emulator (`com.swipeclean.free`).
2. **JS available:**
   - Dev-client (debug) build → **Metro must be running**: `npm run start`, then launch the app once so it connects.
   - Standalone release build (embedded JS) → no Metro needed.
3. **Maestro CLI** installed (`maestro` on PATH), with Java available.

## Run

```bash
# all flows
maestro test .maestro

# a single flow
maestro test .maestro/01_smoke.yaml
```

## Notes / limitations

- Selectors use stable on-screen text and accessibility labels (e.g. `Open Settings`,
  the tab labels via anchored regex `^Compress$` so they don't match `Compress All`).
- Flows do **not** `clearState`, so the app keeps its granted media permission and
  avoids the first-run native permission dialog. They also never tap the purchase CTA
  (that would start a real RevenueCat checkout).
- The original 4 flows were verified passing on an `emulator-5554`
  (`sdk_gphone16k_x86_64`) Android image against the dev-client build + Metro.
  `02_navigation.yaml` was corrected 2026-06-21 (the removed "Largest Photos"
  Stats section was still being asserted). Flows 05–09 were added 2026-06-21 and
  should be run on a physical device with real media for full coverage.
- Media-dependent flows (`05`, `06`, `09`) guard their media-specific steps with
  `runFlow: when: visible:` / `optional: true`, so they pass regardless of how
  much media is present. `07` and the upsell flows assume a **Free** user.
- This emulator image has historically hung `expo-media-library`; the flows are
  designed to pass regardless of how much media is present.
