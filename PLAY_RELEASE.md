# SwipeClean Android release handoff

Updated: 2026-08-22

This is the operational handoff for the first public Google Play release. The
full implementation history remains in `PROJECT_CONTEXT.md` §11.


## CURRENT PRODUCTION ARTIFACT — build 7 (2026-08-22)

**UPLOADED AND LIVE** as the Play beta (confirmed 2026-08-22). Build 6 below is superseded; it predates the green rebrand,
the new logo, and several fixes.

| Purpose | Artifact | Version | SHA-256 |
|---|---|---|---|
| **Production upload to Google Play** | `dist-android/SwipeClean-v1.0.0-vc7-production.aab` | 1.0.0 (7) | `381CE9F2C15150D4B6B81593575234777C98C9B5288A61612361878AB74DE1FA` |

Verified before handoff:
- `jarsigner -verify` → **jar verified**; signer `CN=Cognitix, O=Cognitix, C=US`,
  SHA-256 `B9:0F:F3:2A:…:8D:1F` (the upload key Play expects).
- `versionCode` **7**, `versionName` 1.0.0 — read out of the AAB's protobuf
  manifest and cross-checked against the vc6 artifact, which reads 6.
- Embedded JS contains all three **production** AdMob unit IDs (banner
  3772562348, interstitial 2274476985, rewarded 4491543800) — i.e. this is NOT a
  forced-test-ads build.
- Contains this cycle's changes: media-sync fix (`getLibrarySignature`), swipe
  "new media" pill, delete progress. Confirms the removed surfaces stay removed:
  no Open-Source Licenses, Redeem Code, or "Upgrade to Premium" strings.

**Why 7 and not 6:** versionCode 6 was already prepared for upload and may have
been submitted; Play rejects a duplicate code, and this build's contents differ
from 6 regardless. versionCodes need not be contiguous — bumping is always safe.

### Before submitting for production review
- **Play listing icon is uploaded separately from the AAB.** The listing will
  still show the old blue card-stack mark until the new green ring icon is
  uploaded in Play Console (1024x1024 supplied; 512x512 also available).
- **LGPL attribution is absent by explicit product decision.** The Open-Source
  Licenses screen was removed while LAME still ships in the binary twice
  (`libswipecleanlame.so` plus `libandroidlame.so` via react-native-compressor).
  See PROJECT_CONTEXT §10 and §11 (2026-08-06 c). Production review is a higher
  risk bar than closed testing; this is a conscious choice, not an oversight.

---

## Superseded artifacts (build 6, 2026-08-17)
## Release artifacts

| Purpose | Artifact | Version | SHA-256 |
|---|---|---|---|
| Upload to Google Play | `dist-android/SwipeClean-v1.0.0-vc6-production.aab` | 1.0.0 (6) | `655EC6F650BA15706F78EF048FE71AB415B0ADB125F176C3AD9270CC225F39E8` |
| Direct device installation only | `dist-android/SwipeClean-standalone-v1.0.0-vc6-release.apk` | 1.0.0 (6) | `4E78645B0C4D1385E07570152EB5CCB97CD872FEAD61B202B914809F34EAC0C9` |
| Side-by-side tablet QA only | `dist-android/SwipeClean-tablet-qa-v1.0.0-vc6.apk` | 1.0.0-tabletqa (6) | `70605838C9998790075CB7D9D04B71E98D774AB033D7D7A88E70D87EBE81BD7A` |

Only the `.aab` belongs in Play Console. The application ID is
`com.cognitix.swipeclean`; `versionCode` is 6 and `versionName` is 1.0.0.

The earlier closed-testing artifact, `SwipeClean-closedtest-testads-v5.aab`,
contains forced Google test ads. Never promote build 5 to production.

## Production configuration confirmed

- Release signing uses the Cognitix upload certificate, SHA-256
  `B9:0F:F3:2A:8E:1F:20:80:DC:84:D6:81:66:39:91:8A:C3:72:7E:A5:A0:12:1B:B2:7C:35:0E:2F:EF:F9:8D:1F`.
- RevenueCat uses the real Android `goog_…` public SDK key. The Test Store flag
  was removed from the build environment.
- `EXPO_PUBLIC_ADS_USE_TEST` and `EXPO_PUBLIC_EXPO_GO_DEMO` were removed from
  the build environment.
- Android AdMob App ID: `ca-app-pub-5256708773143000~5412947073`.
- Android banner: `ca-app-pub-5256708773143000/3772562348`.
- Android interstitial: `ca-app-pub-5256708773143000/2274476985`.
- Android rewarded: `ca-app-pub-5256708773143000/4491543800`.
- The AAB's embedded JavaScript contains all three production unit IDs and does
  not contain the app's forced-test-ads release-warning branch. Google's test
  IDs still exist inside the bundled ads dependency as constants; their mere
  presence is not evidence that the app selected them.

Do not tap live ads from developer-owned test devices. Self-clicks can be
classified as invalid traffic.

## Changes included after closed-test build 5

- Android Pro subscription disclosures now name Google Play, explain renewal
  and cancellation in Android terms, and open Google Play Terms. iOS keeps its
  Apple-specific disclosure and EULA.
- Feedback and bug-report emails fetch fresh RevenueCat `CustomerInfo`, use
  `originalAppUserId` as the primary Support ID, and include the installation's
  Device alias when it differs.
- Media removed in the system gallery is now pruned from SwipeClean promptly.
  The app uses a stable, ID-only library snapshot, aborts rather than pruning if
  the library changes mid-read, and removes confirmed missing items from the
  grid, review state, deletion queue, and Smart Clean feature cache without
  counting an external deletion in SwipeClean's cleanup statistics.
- Android `versionCode` advanced from 5 to 6 so Play accepts the new artifact.

## Verification record

- `npm run typecheck`: green.
- `npm test`: 14 files / 123 tests green.
- `npm run i18n:check`: 495 keys, all 9 translated locales in parity, 0
  orphan keys.
- `npm run lint`: 0 errors, 92 existing advisory warnings.
- `bundleRelease`: green with R8/resource shrinking enabled.
- AAB signature: `jarsigner` verified; Cognitix upload certificate confirmed.
- Packaged manifest: application ID `com.cognitix.swipeclean`, version 1.0.0
  (6), target SDK 36, AdMob App ID present, CAMERA absent, media permissions
  present, and the Smart Clean service declares `dataSync`.
- Native compatibility: all 26 ARM64 libraries have `LOAD` alignment `0x4000`
  (16 KB).
- R8 mapping and native debug symbols are embedded in the AAB metadata.
- APK signature and 16 KB zip alignment both pass.
- The AAB and APK contain byte-identical production JavaScript bundles; the
  external-deletion reconciliation symbols and all three real Android ad unit
  IDs are present, while the forced-test-ads warning branch is absent.
- SM-X400 device regression: a side-by-side build was installed as
  `com.cognitix.swipeclean.tabletqa`; temporary MediaStore assets appeared, four
  test-only rows were deleted externally, and the Swipe total returned from 26
  to the original 23 within 10 seconds with no ghost tile or crash. All temporary
  media was removed and the QA build remains launched.

## Put build 6 on the tablet through Google Play

The tablet currently has Play-signed build 5. Android rejected the locally
signed build-6 APK with `INSTALL_FAILED_UPDATE_INCOMPATIBLE` because a Play App
Signing certificate and the local upload certificate are intentionally
different. No tablet data was deleted; build 5 remains installed and running.

Use this safe update path:

1. Open Play Console and select SwipeClean.
2. Go to **Test and release → Testing → Closed testing** and open the existing
   closed track.
3. Choose **Create new release** and upload
   `SwipeClean-v1.0.0-vc6-production.aab`.
4. Add release notes, review the release, and roll it out to the closed track.
5. On the tablet, open Google Play with its tester account and update
   SwipeClean. Google Play will sign build 6 with the same app-signing key as
   the installed build, so the update preserves app data.

The destructive alternative is uninstalling build 5 and installing the local
APK, which clears local SwipeClean data and should only be done with explicit
approval.

For local QA without touching the Play app, build with
`assembleRelease -PswipecleanTabletQa=true`. This installs side-by-side as
`com.cognitix.swipeclean.tabletqa`; it is not a Play artifact and must never be
uploaded in place of the production AAB.

## Apply for production access

> **Current status — 2026-08-17:** The production-access application has been
> submitted in Google Play Console and is awaiting Google's decision. Production
> access is not yet approved, and no public production release has been submitted
> or published. After approval, continue with **Create the public production
> release** below.

For a personal Play developer account created after 2023-11-13, Google requires
at least 12 opted-in closed testers for 14 continuous days. Once the Dashboard
shows the requirement as met:

1. Open **Dashboard → Apply for production**.
2. Answer the sections about the closed test, the app, tester engagement and
   feedback, changes made from feedback, and why the app is production-ready.
3. Submit the access application. This step requests permission to use the
   production track; it does not itself publish an AAB.

## Create the public production release

After Google grants production access:

1. Go to **Test and release → Production → Create new release**.
2. If build 6 was already uploaded to closed testing, choose **Add from
   library** and select version 1.0.0 (6). Do not upload the same version code a
   second time, and do not select build 5.
3. If build 6 was never uploaded elsewhere, upload
   `SwipeClean-v1.0.0-vc6-production.aab` directly.
4. Use a private release name such as `1.0.0 (6) - Production` and add the
   public release notes below.
5. Select **Next**, resolve every error shown by Play's pre-review checks, and
   verify countries/regions, pricing, app content, Data safety, ads,
   subscriptions, media-access declarations, and the foreground-service
   declaration.
6. Choose **Start rollout to production** / **Send for review**. A staged
   rollout is safer than immediately selecting 100% when Play offers that
   choice.

If Play Console offers **Promote release** for the build-6 closed release, that
is equivalent to adding build 6 from the artifact library. Either route is
correct; the essential rule is that production must use build 6, not build 5.

## Suggested Google Play release notes

```text
What's new
• Updated subscription information and Google Play terms on Android.
• Improved support emails so customer identifiers are easier to match.
• Fixed removed gallery items remaining visible in SwipeClean.
• General stability and release-readiness improvements.
```

## Release-owner confirmations before public rollout

- The current app distributes two LAME-based LGPL native libraries, while the
  in-app licenses/source-offer screen was removed on 2026-08-06. This remains a
  documented legal/compliance risk (`PROJECT_CONTEXT.md` §10 and
  `SECURITY_SCAN.md` H1). The AAB is technically valid, but that risk is not
  cured by building or uploading it.
- Confirm the Play Console `FOREGROUND_SERVICE_DATA_SYNC` declaration is
  submitted with its Smart Clean background-scan demo video. The context says a
  video was recorded on 2026-07-16, but the file is not in this workspace and a
  later pending note is contradictory, so the console is the source of truth.
- Confirm the current Data safety and Ads declarations match on-device media
  processing, RevenueCat purchases, AdMob/UMP consent, and the privacy policy.
- Confirm the `swipeclean_pro` monthly and yearly base plans are active in Play
  Console and still mapped to RevenueCat's `CleanSwipe Pro` entitlement and
  default offering.

---

## Next upload

Build 7 is live on the Play beta track, so the **next upload must use
`versionCode` 8 or higher** — Play rejects a duplicate code. Bump it in
`android/app/build.gradle` (the single source; `app.json` has no `versionCode`).

The store listing's screenshots and icon are uploaded in Play Console
**separately from the AAB**. The stale in-repo copies under
`store-listing-generated/` were deleted on 2026-08-22; only `LISTING.md`
remains. Play Console holds the authoritative assets.
