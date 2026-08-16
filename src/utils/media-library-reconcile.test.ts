import { describe, expect, it } from "vitest";
import { findMissingMediaIds } from "@/utils/media-library-reconcile";

describe("findMissingMediaIds", () => {
  it("returns indexed assets absent from the live library", () => {
    expect(findMissingMediaIds(["photo-1", "video-1", "photo-2"], ["photo-1", "photo-2"]))
      .toEqual(["video-1"]);
  });

  it("does not remove anything when the device snapshot contains every indexed ID", () => {
    expect(findMissingMediaIds(["photo-1", "video-1"], new Set(["video-1", "photo-1", "new-photo"])))
      .toEqual([]);
  });

  it("removes every stale ID when the device library is empty", () => {
    expect(findMissingMediaIds(["photo-1", "video-1"], [])).toEqual(["photo-1", "video-1"]);
  });

  it("preserves duplicate-free indexed order", () => {
    expect(findMissingMediaIds(["photo-3", "photo-1", "photo-2"], ["photo-2"]))
      .toEqual(["photo-3", "photo-1"]);
  });
});
