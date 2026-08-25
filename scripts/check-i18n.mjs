#!/usr/bin/env node
// Validates that every locale in src/i18n/locales matches en.json:
//  - identical set of keys (no missing / no extra)
//  - identical interpolation placeholders ({{var}}) per key
//  - (advisory) no ORPHAN keys: en.json keys that no source file references
// Exits non-zero if any locale is out of parity. Run with: npm run i18n:check
//
// Orphan detection exists because parity alone is structurally blind to dead
// strings: a key deleted from the UI but left in en.json stays "in parity"
// forever and is re-translated into every locale on the next translation pass.
// Pass --strict-orphans (or set I18N_STRICT_ORPHANS=1) to make orphans fail the
// gate; by default they are reported and the exit code is unaffected, so a
// legitimately-dynamic key added tomorrow can't break the build before someone
// adds it to DYNAMIC_KEY_PREFIXES.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, "..", "src", "i18n", "locales");
const REFERENCE = "en";

// Source roots scanned for `t("…")` usage.
const SOURCE_ROOTS = [join(here, "..", "src"), join(here, "..", "app")];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

/**
 * Key namespaces built at RUNTIME from a variable, so a literal-string scan can
 * never see them. Anything under these prefixes is exempt from orphan reporting.
 * Add a prefix here (with the call site) when you introduce a new dynamic key.
 */
const DYNAMIC_KEY_PREFIXES = [
  "paywall.", // pro-upgrade-sheet.tsx      → t(`paywall.${featureKey}`)
  "convert.errors.", // convert-run-screen.tsx     → t(`convert.errors.${code}`)
  "stats.convert.", // convert-stats-section.tsx  → t(`stats.convert.${kind}`)
  "smartClean.cards.", // smart-clean-screen.tsx     → t(`smartClean.cards.${key}…`)
  "distribution.", // swipe-distribution-chart   → t(`distribution.${slice}`)
  "months.", // utils/date.ts              → t(`months.${index}`)
  "languages.", // settings-screen.tsx        → t(`languages.${code}`)
  "convert.note.", // convert-format-sheet.tsx   → t(`convert.note.${target}`)
  "convert.group." // convert-format-sheet.tsx   → t(`convert.group.${group.kind}`)
];

function flatten(obj, prefix = "", acc = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, path, acc);
    } else {
      acc[path] = value;
    }
  }
  return acc;
}

function placeholders(value) {
  const matches = String(value).match(/{{\s*[a-zA-Z0-9_]+\s*}}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\s/g, "")))].sort();
}

function load(code) {
  return JSON.parse(readFileSync(join(localesDir, `${code}.json`), "utf8"));
}

/** Every .ts/.tsx file under the source roots, concatenated. */
function readAllSources() {
  const chunks = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
        chunks.push(readFileSync(full, "utf8"));
      }
    }
  };
  for (const root of SOURCE_ROOTS) walk(root);
  return chunks.join("\n");
}

/**
 * i18next resolves a plural key by appending a CLDR category suffix to the base
 * key at RUNTIME: `t("a.b", { count })` reads `a.b_one` / `a.b_other` (and
 * _zero/_two/_few/_many in locales that have them). Source only ever mentions
 * the BASE key, so the suffixed variants must be matched against that base or
 * every correctly-pluralised string gets reported as dead.
 */
const PLURAL_SUFFIXES = ["_zero", "_one", "_two", "_few", "_many", "_other"];

function pluralBaseKey(key) {
  const suffix = PLURAL_SUFFIXES.find((candidate) => key.endsWith(candidate));
  return suffix ? key.slice(0, -suffix.length) : key;
}

function findOrphanKeys(keys, source) {
  return keys.filter((key) => {
    if (DYNAMIC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
    const lookup = pluralBaseKey(key);
    return !source.includes('"' + lookup + '"') && !source.includes("'" + lookup + "'") && !source.includes("`" + lookup + "`");
  });
}

const reference = flatten(load(REFERENCE));
const referenceKeys = Object.keys(reference);

const localeFiles = readdirSync(localesDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .filter((code) => code !== REFERENCE)
  .sort();

let totalProblems = 0;
const summary = [];

for (const code of localeFiles) {
  const locale = flatten(load(code));
  const keys = new Set(Object.keys(locale));
  const missing = referenceKeys.filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !reference[k] && !(k in reference));
  const placeholderMismatches = [];

  for (const key of referenceKeys) {
    if (!keys.has(key)) continue;
    const expected = placeholders(reference[key]).join("|");
    const actual = placeholders(locale[key]).join("|");
    // allow extra repeats of an existing placeholder (grammatical agreement),
    // but every placeholder in en must appear in the translation and vice-versa.
    const expectedSet = new Set(placeholders(reference[key]));
    const actualSet = new Set(placeholders(locale[key]));
    const sameSet = expectedSet.size === actualSet.size && [...expectedSet].every((p) => actualSet.has(p));
    if (!sameSet) placeholderMismatches.push(`${key}  en[${expected}] != ${code}[${actual}]`);
  }

  const problems = missing.length + extra.length + placeholderMismatches.length;
  totalProblems += problems;
  summary.push({ code, count: keys.size, missing, extra, placeholderMismatches });
}

console.log(`i18n parity check — reference: ${REFERENCE}.json (${referenceKeys.length} keys)\n`);
for (const s of summary) {
  const status = s.missing.length + s.extra.length + s.placeholderMismatches.length === 0 ? "OK" : "FAIL";
  console.log(`[${status}] ${s.code.padEnd(6)} ${s.count} keys`);
  if (s.missing.length) console.log(`   missing (${s.missing.length}): ${s.missing.slice(0, 10).join(", ")}${s.missing.length > 10 ? " …" : ""}`);
  if (s.extra.length) console.log(`   extra (${s.extra.length}): ${s.extra.slice(0, 10).join(", ")}${s.extra.length > 10 ? " …" : ""}`);
  for (const m of s.placeholderMismatches.slice(0, 10)) console.log(`   placeholder: ${m}`);
}

const strictOrphans = process.argv.includes("--strict-orphans") || process.env.I18N_STRICT_ORPHANS === "1";
const orphans = findOrphanKeys(referenceKeys, readAllSources());
if (orphans.length) {
  console.log(`\n${strictOrphans ? "[FAIL]" : "[WARN]"} ${orphans.length} orphan key(s) in ${REFERENCE}.json — no source reference:`);
  for (const key of orphans) console.log(`   ${key}`);
  console.log(
    `   Each orphan costs ${localeFiles.length + 1} translations. Delete it, or add its prefix to\n` +
      "   DYNAMIC_KEY_PREFIXES in this script if the key is composed at runtime."
  );
  if (strictOrphans) totalProblems += orphans.length;
} else {
  console.log(`\n✓ No orphan keys in ${REFERENCE}.json.`);
}

if (totalProblems > 0) {
  console.error(`\n✖ i18n check failed: ${totalProblems} problem(s) across ${localeFiles.length} locale(s).`);
  process.exit(1);
}
console.log(`\n✓ All ${localeFiles.length} locales are in parity with ${REFERENCE}.json.`);
