import { describe, expect, it } from "vitest";
import {
  dHashFromGray,
  downscaleGray,
  groupByHamming,
  hammingHex,
  laplacianVariance,
  rgbaToGrayMatrix
} from "@/features/smart-clean/detectors/hash-utils";

// An 8-row x 9-col grayscale matrix produces a 64-bit (16 hex char) dHash.
const strictlyIncreasingRow = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const strictlyDecreasingRow = [8, 7, 6, 5, 4, 3, 2, 1, 0];
const grid = (row: number[]) => Array.from({ length: 8 }, () => [...row]);

describe("dHashFromGray", () => {
  it("emits all 1-bits when every pixel is brighter than its right neighbor", () => {
    expect(dHashFromGray(grid(strictlyIncreasingRow))).toBe("ffffffffffffffff");
  });

  it("emits all 0-bits when every pixel is darker than its right neighbor", () => {
    expect(dHashFromGray(grid(strictlyDecreasingRow))).toBe("0000000000000000");
  });

  it("always produces 16 hex characters (64 bits)", () => {
    expect(dHashFromGray(grid(strictlyIncreasingRow))).toHaveLength(16);
  });
});

describe("hammingHex", () => {
  it("is 0 for identical hashes", () => {
    expect(hammingHex("ffffffffffffffff", "ffffffffffffffff")).toBe(0);
  });

  it("counts every differing bit", () => {
    expect(hammingHex("0000000000000000", "ffffffffffffffff")).toBe(64);
    expect(hammingHex("0000000000000000", "0000000000000001")).toBe(1);
  });
});

describe("laplacianVariance", () => {
  it("is 0 for a perfectly flat image", () => {
    const flat = Array.from({ length: 5 }, () => new Array(5).fill(128));
    expect(laplacianVariance(flat)).toBe(0);
  });

  it("returns +Infinity (not blurry) when the matrix is too small to judge", () => {
    expect(laplacianVariance([[1, 2]])).toBe(Number.POSITIVE_INFINITY);
  });

  it("is positive for a high-contrast (sharp) pattern", () => {
    const checker = Array.from({ length: 5 }, (_r, y) =>
      Array.from({ length: 5 }, (_c, x) => ((x + y) % 2 === 0 ? 0 : 255))
    );
    expect(laplacianVariance(checker)).toBeGreaterThan(0);
  });
});

describe("groupByHamming", () => {
  it("groups near-duplicate hashes and drops singletons", () => {
    const hashes = ["0000000000000000", "0000000000000001", "ffffffffffffffff"];
    const groups = groupByHamming(hashes, 6);
    expect(groups).toEqual([[0, 1]]);
  });

  it("returns no groups when nothing is within distance", () => {
    expect(groupByHamming(["0000000000000000", "ffffffffffffffff"], 6)).toEqual([]);
  });
});

describe("rgbaToGrayMatrix", () => {
  it("produces a matrix of the requested dimensions", () => {
    // 2x2 image, 4 RGBA bytes per pixel.
    const data = new Array(2 * 2 * 4).fill(255);
    const gray = rgbaToGrayMatrix(data, 2, 2);
    expect(gray).toHaveLength(2);
    expect(gray[0]).toHaveLength(2);
  });
});

describe("downscaleGray (single-decode dHash derivation)", () => {
  // The 64x64 blur grid is average-pooled to the 9x8 dHash grid so both come
  // from one decode. These guard that derivation against accidental breakage.
  it("downscales to the requested dimensions (9x8 dHash grid)", () => {
    const big = Array.from({ length: 64 }, () => new Array(64).fill(100));
    const small = downscaleGray(big, 9, 8);
    expect(small).toHaveLength(8);
    expect(small[0]).toHaveLength(9);
  });

  it("preserves a left→right gradient → dHash of all 1-bits", () => {
    // Each row increases across columns; pooling to 9 cols stays increasing.
    const gradient = Array.from({ length: 64 }, () => Array.from({ length: 64 }, (_c, x) => x));
    expect(dHashFromGray(downscaleGray(gradient, 9, 8))).toBe("ffffffffffffffff");
  });

  it("yields all 0-bits for a flat image (no adjacent increase)", () => {
    const flat = Array.from({ length: 64 }, () => new Array(64).fill(128));
    expect(dHashFromGray(downscaleGray(flat, 9, 8))).toBe("0000000000000000");
  });

  it("returns [] for an empty matrix", () => {
    expect(downscaleGray([], 9, 8)).toEqual([]);
  });
});
