import { describe, expect, it } from "vitest";
import {
  getAvailableTargets,
  getSelectableTargets,
  isTargetAvailable,
  targetExtension,
  targetMimeForShare,
  targetOutputKind
} from "@/features/convert/convert-targets";

const image = { mediaType: "photo" as const };
const video = { mediaType: "video" as const };
const unknown = { mediaType: "unknown" as const };
const noAudio = { audioExtract: false };
const withAudio = { audioExtract: true };

describe("getAvailableTargets", () => {
  it("returns image formats for a photo", () => {
    expect(getAvailableTargets(image)).toEqual(["jpg", "png", "webp"]);
  });
  it("returns mp4 + m4a for a video", () => {
    expect(getAvailableTargets(video)).toEqual(["mp4", "m4a"]);
  });
  it("returns nothing for unknown media", () => {
    expect(getAvailableTargets(unknown)).toEqual([]);
  });
});

describe("getSelectableTargets", () => {
  it("image targets are always selectable", () => {
    expect(getSelectableTargets(image, noAudio)).toEqual(["jpg", "png", "webp"]);
  });
  it("video shows mp4 always; m4a only when the audio module is present", () => {
    expect(getSelectableTargets(video, noAudio)).toEqual(["mp4"]);
    expect(getSelectableTargets(video, withAudio)).toEqual(["mp4", "m4a"]);
  });
});

describe("isTargetAvailable", () => {
  it("m4a gates on audioExtract; everything else is always available", () => {
    expect(isTargetAvailable("m4a", noAudio)).toBe(false);
    expect(isTargetAvailable("m4a", withAudio)).toBe(true);
    expect(isTargetAvailable("mp4", noAudio)).toBe(true);
    expect(isTargetAvailable("jpg", noAudio)).toBe(true);
  });
});

describe("target metadata", () => {
  it("classifies output kinds", () => {
    expect(targetOutputKind("jpg")).toBe("image");
    expect(targetOutputKind("mp4")).toBe("video");
    expect(targetOutputKind("m4a")).toBe("audio");
  });
  it("extension equals the target", () => {
    expect(targetExtension("jpg")).toBe("jpg");
    expect(targetExtension("mp4")).toBe("mp4");
    expect(targetExtension("m4a")).toBe("m4a");
  });
  it("maps share mime types", () => {
    expect(targetMimeForShare("m4a")).toBe("audio/mp4");
    expect(targetMimeForShare("mp4")).toBe("video/mp4");
    expect(targetMimeForShare("jpg")).toBe("image/jpeg");
  });
});
