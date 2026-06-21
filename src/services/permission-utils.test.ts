import { describe, expect, it } from "vitest";
import { resolveAndroidVisualMediaPermission } from "@/services/permission-utils";

describe("Android visual-media permission resolution", () => {
  it("overrides a stale full report when only selected media is granted", () => {
    expect(
      resolveAndroidVisualMediaPermission(
        { status: "granted", canAskAgain: true },
        { images: false, videos: false, selected: true }
      ).status
    ).toBe("limited");
  });

  it("reports full only when both requested media grants are full", () => {
    expect(
      resolveAndroidVisualMediaPermission(
        { status: "limited", canAskAgain: true },
        { images: true, videos: true, selected: true }
      ).status
    ).toBe("granted");
  });

  it("treats a single media-type grant as limited readable access", () => {
    expect(
      resolveAndroidVisualMediaPermission(
        { status: "granted", canAskAgain: true },
        { images: true, videos: false, selected: false }
      ).status
    ).toBe("limited");
  });

  it("does not retain a stale readable status when every grant is gone", () => {
    expect(
      resolveAndroidVisualMediaPermission(
        { status: "granted", canAskAgain: false },
        { images: false, videos: false, selected: false }
      ).status
    ).toBe("denied");
  });
});
