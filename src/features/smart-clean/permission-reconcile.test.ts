import { describe, expect, it } from "vitest";
import {
  createSmartCleanRescanIntent,
  mediaScopeFingerprint,
  orderedMediaIdsChanged
} from "@/features/smart-clean/permission-reconcile";

describe("Smart Clean permission reconciliation", () => {
  it("keeps a rescan pending across later queued passes", () => {
    const intent = createSmartCleanRescanIntent();

    intent.request(true);
    intent.request(false);

    expect(intent.isPending()).toBe(true);
    intent.clear();
    expect(intent.isPending()).toBe(false);
  });

  it("keeps the intent pending while indexing is unavailable for retry", () => {
    const intent = createSmartCleanRescanIntent();

    intent.request(true);
    // A failed/incomplete index pass deliberately does not call clear().
    expect(intent.isPending()).toBe(true);
    expect(intent.isPending()).toBe(true);
  });

  it("detects a limited-selection replacement with the same item count", () => {
    expect(orderedMediaIdsChanged(["a", "b"], ["a", "c"])).toBe(true);
    expect(orderedMediaIdsChanged(["a", "b"], ["a"])).toBe(true);
    expect(orderedMediaIdsChanged(["a", "b"], ["a", "b"])).toBe(false);
  });

  it("changes the scope fingerprint for full-to-limited and limited-to-full", () => {
    const full = mediaScopeFingerprint("full", ["a", "b", "c"]);
    const limited = mediaScopeFingerprint("limited", ["a", "b"]);

    expect(limited).not.toBe(full);
    expect(mediaScopeFingerprint("full", ["a", "b", "c"])).toBe(full);
    expect(mediaScopeFingerprint("limited", ["a", "c"])).not.toBe(limited);
    expect(mediaScopeFingerprint("full", ["a", "b"])).not.toBe(limited);
    expect(mediaScopeFingerprint("limited", ["a", "b"])).toBe(limited);
  });
});
