#!/usr/bin/env node
// Validates that every locale in src/i18n/locales matches en.json:
//  - identical set of keys (no missing / no extra)
//  - identical interpolation placeholders ({{var}}) per key
// Exits non-zero if any locale is out of parity. Run with: npm run i18n:check
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, "..", "src", "i18n", "locales");
const REFERENCE = "en";

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

if (totalProblems > 0) {
  console.error(`\n✖ i18n check failed: ${totalProblems} problem(s) across ${localeFiles.length} locale(s).`);
  process.exit(1);
}
console.log(`\n✓ All ${localeFiles.length} locales are in parity with ${REFERENCE}.json.`);
