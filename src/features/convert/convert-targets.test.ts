import { describe, expect, it } from "vitest";
import {
  convertedFileName,
  getAvailableTargets,
  getSelectableTargets,
  isTargetAvailable,
  sourceFormat,
  sourceFormatLabel,
  targetExtension,
  targetLabel,
  targetMimeForShare,
  targetOutputKind
} from "@/features/convert/convert-targets";
import { ConvertCapabilities } from "@/features/convert/convert.types";

const photo = (filename?: string, uri = "file:///x") => ({ mediaType: "photo" as const, filename, uri });
const video = (filename?: string, uri = "file:///x") => ({ mediaType: "video" as const, filename, uri });
const unknown = { mediaType: "unknown" as const, filename: undefined, uri: "file:///x" };

const none: ConvertCapabilities = { audioM4a: false, audioWav: false, webm: false, gif: false };
const all: ConvertCapabilities = { audioM4a: true, audioWav: true, webm: true, gif: true };

describe("sourceFormat", () => {
  it("normalizes extensions and aliases", () => {
    expect(sourceFormat("IMG.JPG")).toBe("jpg");
    expect(sourceFormat("a.jpeg")).toBe("jpg");
    expect(sourceFormat("a.HEIF")).toBe("heic");
    expect(sourceFormat("clip.MOV")).toBe("mov");
    expect(sourceFormat("file:///x/a.png?cache=1")).toBe("png");
  });
  it("returns undefined when there is no usable extension", () => {
    expect(sourceFormat(undefined)).toBeUndefined();
    expect(sourceFormat("noext")).toBeUndefined();
  });
});

describe("sourceFormatLabel", () => {
  it("uses the file format, falling back to a kind label", () => {
    expect(sourceFormatLabel(photo("a.png"))).toBe("PNG");
    expect(sourceFormatLabel(video("clip.mov"))).toBe("MOV");
    expect(sourceFormatLabel(photo(undefined, "file:///noext"))).toBe("PHOTO");
    expect(sourceFormatLabel(video(undefined, "file:///noext"))).toBe("VIDEO");
  });
});

describe("getAvailableTargets — same-format exclusion", () => {
  it("never offers the image's own format back", () => {
    expect(getAvailableTargets(photo("a.png"))).toEqual(["jpg", "webp"]);
    expect(getAvailableTargets(photo("a.jpg"))).toEqual(["png", "webp"]);
    expect(getAvailableTargets(photo("a.webp"))).toEqual(["jpg", "png"]);
  });
  it("offers all three when the source format is unknown", () => {
    expect(getAvailableTargets(photo(undefined, "file:///noext"))).toEqual(["jpg", "png", "webp"]);
  });
  it("treats a HEIC source as a normal image (all three targets)", () => {
    expect(getAvailableTargets(photo("a.heic"))).toEqual(["jpg", "png", "webp"]);
  });
  it("gives a GIF source the still-image targets (gif→still via image engine)", () => {
    expect(getAvailableTargets(photo("loop.gif"))).toEqual(["jpg", "png", "webp"]);
  });
  it("excludes mp4 for an mp4 video, keeping webm/gif + audio", () => {
    expect(getAvailableTargets(video("v.mp4"))).toEqual(["webm", "gif", "m4a", "wav"]);
  });
  it("keeps mp4 for a mov video and drops nothing else", () => {
    expect(getAvailableTargets(video("v.mov"))).toEqual(["mp4", "webm", "gif", "m4a", "wav"]);
  });
  it("returns nothing for unknown media", () => {
    expect(getAvailableTargets(unknown)).toEqual([]);
  });
});

describe("getSelectableTargets — capability gating", () => {
  it("images are always selectable regardless of caps", () => {
    expect(getSelectableTargets(photo("a.png"), none)).toEqual(["jpg", "webp"]);
  });
  it("an mp4 video shows nothing extra until native engines ship", () => {
    expect(getSelectableTargets(video("v.mp4"), none)).toEqual([]);
  });
  it("an mp4 video shows every webm/gif/audio target once engines are present", () => {
    expect(getSelectableTargets(video("v.mp4"), all)).toEqual(["webm", "gif", "m4a", "wav"]);
  });
  it("a mov video always shows mp4 even with no native engines", () => {
    expect(getSelectableTargets(video("v.mov"), none)).toEqual(["mp4"]);
  });
  it("a gif source always shows the still-image targets", () => {
    expect(getSelectableTargets(photo("loop.gif"), none)).toEqual(["jpg", "png", "webp"]);
    expect(getSelectableTargets(photo("loop.gif"), all)).toEqual(["jpg", "png", "webp"]);
  });
});

describe("isTargetAvailable", () => {
  it("image + mp4 are always available", () => {
    expect(isTargetAvailable("jpg", none)).toBe(true);
    expect(isTargetAvailable("png", none)).toBe(true);
    expect(isTargetAvailable("webp", none)).toBe(true);
    expect(isTargetAvailable("mp4", none)).toBe(true);
  });
  it("native targets gate on their capability flag", () => {
    expect(isTargetAvailable("webm", none)).toBe(false);
    expect(isTargetAvailable("webm", all)).toBe(true);
    expect(isTargetAvailable("gif", all)).toBe(true);
    expect(isTargetAvailable("m4a", all)).toBe(true);
    expect(isTargetAvailable("wav", all)).toBe(true);
  });
});

describe("target metadata", () => {
  it("classifies output kinds", () => {
    expect(targetOutputKind("jpg")).toBe("image");
    expect(targetOutputKind("gif")).toBe("image");
    expect(targetOutputKind("mp4")).toBe("video");
    expect(targetOutputKind("webm")).toBe("video");
    expect(targetOutputKind("m4a")).toBe("audio");
    expect(targetOutputKind("wav")).toBe("audio");
  });
  it("extension equals the target", () => {
    expect(targetExtension("jpg")).toBe("jpg");
    expect(targetExtension("webm")).toBe("webm");
  });
  it("maps share mime types", () => {
    expect(targetMimeForShare("m4a")).toBe("audio/mp4");
    expect(targetMimeForShare("wav")).toBe("audio/wav");
    expect(targetMimeForShare("webm")).toBe("video/webm");
    expect(targetMimeForShare("gif")).toBe("image/gif");
    expect(targetMimeForShare("jpg")).toBe("image/jpeg");
  });
  it("prettifies display labels", () => {
    expect(targetLabel("jpg")).toBe("JPG");
    expect(targetLabel("webp")).toBe("WEBP");
    expect(targetLabel("webm")).toBe("WebM");
  });
});

describe("convertedFileName", () => {
  it("replaces the source extension with the target's", () => {
    expect(convertedFileName("1000011248.mp4", "webm")).toBe("1000011248.webm");
    expect(convertedFileName("clip.MOV", "mp4")).toBe("clip.mp4");
    expect(convertedFileName("song.mp4", "m4a")).toBe("song.m4a");
    expect(convertedFileName("photo.HEIC", "jpg")).toBe("photo.jpg");
  });
  it("appends when there is no source extension, and strips any path", () => {
    expect(convertedFileName("noext", "wav")).toBe("noext.wav");
    expect(convertedFileName("file:///a/b/clip.mp4", "webm")).toBe("clip.webm");
  });
  it("falls back to 'converted' when the basename is empty/undefined", () => {
    expect(convertedFileName(undefined, "wav")).toBe("converted.wav");
    expect(convertedFileName("", "m4a")).toBe("converted.m4a");
  });
});
