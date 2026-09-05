# Agent instructions — SwipeClean

**Read [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) before making any change.** It is
the single source of truth for this repo: architecture, business rules, known
issues, and a dated Feature History going back to the first commit.

This file exists only so you find those rules. The rules themselves live in
`PROJECT_CONTEXT.md` **§12 "AI Agent Rules"** — they are reproduced here because
§12 sits ~1,400 lines into a ~400 KB file and an agent that doesn't already know
to look there will never find it.

---

## The rules (PROJECT_CONTEXT.md §12)

- Always read `PROJECT_CONTEXT.md` before making changes.
- After every implemented feature, update `PROJECT_CONTEXT.md`.
- When updating the context file, add a new entry under **§11 Feature History**.
- Do not remove previous history unless it is clearly wrong.
- Keep the context file accurate and concise.
- Document new files, changed architecture, new dependencies, new commands, and
  new business rules.
- If a feature is partially implemented, clearly mark it as partial.
- If assumptions are made, document them.
- Follow the existing project architecture unless there is a strong reason to
  refactor.
- Do not introduce unnecessary dependencies.
- Prefer small, maintainable changes over large rewrites.
- **Preserve user/unrelated work in the git tree. Do not revert dirty files
  unless explicitly asked.**
- Keep native deletion and compression changes conservative, test them
  carefully, and maintain clear user confirmation for destructive actions.

## Feature History entry format

**Prepend** to **§11** — the recent convention is newest-first at the top of the
section. (The oldest ~40 entries run chronologically ascending; that block is
historical, don't reorder it.) Use the established shape:

```markdown
### YYYY-MM-DD - Short title
- What changed: …
- Files: `path/one.ts`, `path/two.tsx`
- Verification: typecheck green; npm test green (N tests); i18n:check green (N keys); lint green (0 errors, N warnings)
- Assumptions: … (omit if none)
```

Quote **real** gate numbers. Every entry in this file is auditable by re-running
the gates, and that property is worth preserving.

## Gates — run all four before you claim done

```bash
npm run typecheck && npm test && npm run i18n:check && npm run lint
```

There is **no CI enforcing this locally** beyond `.github/workflows/gates.yml`
(added 2026-08-01), and no pre-commit hook. `npm run lint` is expected to report
0 errors and a nonzero number of advisory warnings — the React-Compiler rules are
deliberately set to `warn` in `eslint.config.js`.

`npm run i18n:check` also reports **orphan keys** (strings in `en.json` that no
source file references). Orphans are advisory by default; pass
`--strict-orphans` to fail on them. If you add a key composed at runtime
(`` t(`ns.${x}`) ``), add its prefix to `DYNAMIC_KEY_PREFIXES` in
`scripts/check-i18n.mjs` or it will be reported as dead.

## Disk: everything goes on D:, never C:

**Hard rule. `C:` is nearly full (it hit 8.6 GB free on 2026-09-05); `D:` has
~500 GB.** Any build, cache, temp file, emulator image, or scratch artifact you
create must land on `D:`. Never write a new cache to `C:\Users\marti\`.

Caches were relocated to `D:\DevCache\` on 2026-09-05:

| What | Now lives at | Pinned by |
|---|---|---|
| Gradle home (was 11.7 GB on C:) | `D:\DevCache\gradle` | `GRADLE_USER_HOME` |
| npm cache (was 7.8 GB) | `D:\DevCache\npm-cache` | `npm_config_cache` |
| Android AVDs / emulator (was 9.9 GB) | `D:\DevCache\android` | `ANDROID_AVD_HOME`, `ANDROID_EMULATOR_HOME`, `ANDROID_SDK_HOME` |
| Temp (Metro's cache uses `os.tmpdir()`) | `D:\DevCache\tmp` | `TMP`, `TEMP`, `TMPDIR` |

These are set in **`.claude/settings.json`** (every Claude Code session in this
repo inherits them) **and** as Windows *user* environment variables, so plain
terminals and Android Studio get them too. If you add a tool with its own cache,
point it at `D:\DevCache\` and add a row here.

Verify before a big build:

```bash
powershell -NoProfile -Command "Get-PSDrive C,D | Select-Object Name,@{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}}"
```

## Device / native work

- The **user runs on-device testing**. Make changes compile and rely on Fast
  Refresh, then hand off — don't assume a device is attached.
- Anything touching `modules/`, `android/`, `ios/`, or a new native dependency
  needs a native rebuild (`npx expo run:android` / `run:ios`); Metro-only reloads
  into an older binary fail with "Cannot find native module …".
- Deletion and compression are the high-risk paths. All library deletions go
  through `PhotoLibraryService.deletePhotos` (which treats
  `deleteAssetsAsync === false` as failure); review-queue deletions additionally
  go through `useAppStore.permanentlyDeleteMarked`. Do not add a new direct
  `MediaLibrary.deleteAssetsAsync` call site.

## Orientation

- `README.md` — how to run the app, prerequisites, the secrets a build needs.
- `PROJECT_CONTEXT.md` §3 — file/directory map. §5 — architecture and data flow.
  §7 — business rules. §10 — current known issues.
- `SECURITY_SCAN.md`, `APP_ANALYSIS.md`, `DESIGN-BRIEF.md`, `CONVERT_PLAN.md` are
  **dated snapshots**, not living documents. Check their date line against
  `PROJECT_CONTEXT.md` §11 before trusting them.
