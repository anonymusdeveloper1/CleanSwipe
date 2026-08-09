import { describe, expect, it } from "vitest";
import { librarySignatureChanged, LibrarySignature } from "@/utils/library-signature";

const base: LibrarySignature = { totalCount: 100, newestId: "asset-1", newestModificationTime: 1000 };

describe("librarySignatureChanged", () => {
  it("does not report a change when there is no baseline yet", () => {
    // The first probe after attaching only seeds the baseline — reporting a
    // change here would fire a redundant reconcile right after launch.
    expect(librarySignatureChanged(undefined, base)).toBe(false);
  });

  it("reports no change for an identical signature", () => {
    expect(librarySignatureChanged(base, { ...base })).toBe(false);
  });

  it("detects a new asset (count grew)", () => {
    expect(librarySignatureChanged(base, { ...base, totalCount: 101, newestId: "asset-2" })).toBe(true);
  });

  it("detects a deletion (count shrank)", () => {
    expect(librarySignatureChanged(base, { ...base, totalCount: 99 })).toBe(true);
  });

  it("detects a same-count swap — one added and one removed between probes", () => {
    // This is the case the Android native observer misses entirely: it only
    // emits when the total count changes.
    expect(librarySignatureChanged(base, { ...base, newestId: "asset-2" })).toBe(true);
  });

  it("detects an in-place edit of the newest asset (crop/markup)", () => {
    expect(librarySignatureChanged(base, { ...base, newestModificationTime: 2000 })).toBe(true);
  });

  it("handles an empty library on both sides without false positives", () => {
    const empty: LibrarySignature = { totalCount: 0 };
    expect(librarySignatureChanged(empty, { totalCount: 0 })).toBe(false);
    expect(librarySignatureChanged(empty, { totalCount: 1, newestId: "asset-1" })).toBe(true);
  });
});
