import { describe, expect, it } from "vitest";
import { isMeme, memeNeedsExifCheck, memeScore, MemeScoreInput } from "@/features/smart-clean/detectors/meme-classifier";

const base: MemeScoreInput = {
  filename: "IMG_0001.JPG",
  longEdge: 800,
  sizeBytes: 100 * 1024,
  inMemeAlbum: false,
  lacksCameraExif: false
};

describe("memeScore / isMeme", () => {
  it("does NOT flag a small, EXIF-less image with no meme name or album (the iOS over-match)", () => {
    // This is exactly the shape that over-matched ~27/32 on iOS: small + no
    // camera EXIF, but an IMG_#### name and no meme album. Must stay below the
    // threshold even though lacksCameraExif is true.
    expect(isMeme({ ...base, filename: "IMG_0027.JPG", lacksCameraExif: true })).toBe(false);
    expect(memeScore({ ...base, filename: "IMG_0027.JPG", lacksCameraExif: true })).toBeLessThan(0.5);
  });

  it("does NOT flag a large regular photo with no signals", () => {
    expect(isMeme({ ...base, longEdge: 4032, sizeBytes: 5_000_000, lacksCameraExif: true })).toBe(false);
  });

  it("flags a meme source-album member (strong signal)", () => {
    // Album alone (large, no other signal) already reaches the threshold.
    expect(isMeme({ ...base, longEdge: 4000, sizeBytes: 5_000_000, inMemeAlbum: true })).toBe(true);
  });

  it("flags a WhatsApp-named small EXIF-less image", () => {
    expect(isMeme({ ...base, filename: "IMG-20240101-WA0001.jpg", lacksCameraExif: true })).toBe(true);
  });

  it("flags a meme-keyword filename that is also small", () => {
    expect(isMeme({ ...base, filename: "download-9gag.jpg", lacksCameraExif: false })).toBe(true);
  });

  it("does NOT flag a meme-named image that is large and has camera EXIF (weak signals absent)", () => {
    // Name gives +1 only; without a corroborating weak signal it stays below 0.5.
    expect(isMeme({ ...base, filename: "meme.jpg", longEdge: 4000, sizeBytes: 5_000_000, lacksCameraExif: false })).toBe(false);
  });
});

describe("memeNeedsExifCheck (lazy EXIF gate)", () => {
  it("skips the EXIF lookup for a plain photo name", () => {
    expect(memeNeedsExifCheck("IMG_0001.JPG", false)).toBe(false);
  });
  it("runs the EXIF lookup only for a meme-named, non-album asset", () => {
    expect(memeNeedsExifCheck("meme.jpg", false)).toBe(true);
    expect(memeNeedsExifCheck("meme.jpg", true)).toBe(false); // album already confirms
  });
});
