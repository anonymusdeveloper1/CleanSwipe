/**
 * Pure perceptual-hash + grouping utilities. No native, no React — unit-testable.
 *
 * dHash: from a (W x H) grayscale matrix where W = H+1, each row contributes H
 * "is pixel[c] < pixel[c+1]" bits → H*H = 64 bits for a 9x8 grid. Stored as a
 * 16-char hex string (JSON-safe; bigint is not serializable).
 *
 * Changing DHASH_RESIZE/BLUR_RESIZE invalidates the tunable thresholds, which
 * now live in ./thresholds.ts (re-exported here for existing importers).
 */
export const DHASH_RESIZE = { width: 9, height: 8 };
export const BLUR_RESIZE = { width: 64, height: 64 };

// Tunable Hamming/variance thresholds are centralized in ./thresholds.ts.
export { DHASH_SIMILAR_MAX, DHASH_DUP_MAX, BLUR_VARIANCE_THRESHOLD } from "@/features/smart-clean/detectors/thresholds";

/** Build a 64-bit dHash (hex string) from a row-major grayscale matrix (8 rows x 9 cols). */
export function dHashFromGray(gray: number[][]): string {
  let bits = "";
  for (let r = 0; r < gray.length; r++) {
    const row = gray[r];
    for (let c = 0; c + 1 < row.length; c++) {
      bits += row[c] < row[c + 1] ? "1" : "0";
    }
  }
  // 64 bits -> 16 hex chars.
  const value = bits.length > 0 ? BigInt(`0b${bits}`) : 0n;
  return value.toString(16).padStart(16, "0");
}

function popcount(n: bigint): number {
  let count = 0;
  let v = n;
  while (v > 0n) {
    v &= v - 1n;
    count += 1;
  }
  return count;
}

export function hammingHex(a: string, b: string): number {
  return popcount(BigInt(`0x${a}`) ^ BigInt(`0x${b}`));
}

/** Variance of the discrete Laplacian over the interior of a grayscale matrix. */
export function laplacianVariance(gray: number[][]): number {
  const height = gray.length;
  const width = height > 0 ? gray[0].length : 0;
  if (height < 3 || width < 3) return Number.POSITIVE_INFINITY; // too small to judge ⇒ not blurry
  const values: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const lap = gray[y - 1][x] + gray[y + 1][x] + gray[y][x - 1] + gray[y][x + 1] - 4 * gray[y][x];
      values.push(lap);
    }
  }
  const n = values.length;
  if (n === 0) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / n;
  let varSum = 0;
  for (const v of values) varSum += (v - mean) * (v - mean);
  return varSum / n;
}

/**
 * Group indices whose pairwise Hamming distance is within `maxDistance` using
 * union-find. Returns arrays of indices for groups of size >= 2.
 */
export function groupByHamming(hashes: string[], maxDistance: number): number[][] {
  const parent = hashes.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== root) {
      const next = parent[i];
      parent[i] = root;
      i = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < hashes.length; i++) {
    for (let j = i + 1; j < hashes.length; j++) {
      if (hammingHex(hashes[i], hashes[j]) <= maxDistance) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < hashes.length; i++) {
    const root = find(i);
    const list = groups.get(root);
    if (list) list.push(i);
    else groups.set(root, [i]);
  }
  return [...groups.values()].filter((group) => group.length >= 2);
}

/**
 * Average-pool a grayscale matrix down to (outWidth x outHeight). Used to derive
 * the tiny 9x8 dHash grid from the larger 64x64 blur grid so BOTH features come
 * from a SINGLE decode (see image-pipeline.computeGrayFeatures). Box-averaging is
 * deterministic and smoother than a re-resize, so duplicates hash more stably.
 */
export function downscaleGray(gray: number[][], outWidth: number, outHeight: number): number[][] {
  const inHeight = gray.length;
  const inWidth = inHeight > 0 ? gray[0].length : 0;
  if (inWidth === 0 || inHeight === 0) return [];
  const out: number[][] = [];
  for (let oy = 0; oy < outHeight; oy++) {
    const y0 = Math.floor((oy * inHeight) / outHeight);
    const y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * inHeight) / outHeight));
    const row: number[] = new Array(outWidth);
    for (let ox = 0; ox < outWidth; ox++) {
      const x0 = Math.floor((ox * inWidth) / outWidth);
      const x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * inWidth) / outWidth));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += gray[y][x];
          count += 1;
        }
      }
      row[ox] = count > 0 ? Math.round(sum / count) : 0;
    }
    out.push(row);
  }
  return out;
}

/** Convert decoded RGBA bytes (length w*h*4) to a row-major grayscale matrix. */
export function rgbaToGrayMatrix(data: ArrayLike<number>, width: number, height: number): number[][] {
  const gray: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = new Array(width);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // ITU-R BT.601 luma, integer approximation.
      row[x] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    }
    gray.push(row);
  }
  return gray;
}
