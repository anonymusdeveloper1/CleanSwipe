import { describe, expect, it } from "vitest";
import {
  getJobByMediaId,
  isActiveConversionJob,
  isMediaConverted,
  isMediaConverting,
  selectBatchProgress,
  selectJobsByBatch,
  selectRecentConvertedJobs
} from "@/features/convert/convert.selectors";
import { ConversionJob } from "@/features/convert/convert.types";

function job(partial: Partial<ConversionJob> & Pick<ConversionJob, "id" | "mediaId" | "createdAt" | "status">): ConversionJob {
  return {
    uri: "file://x",
    fileName: "x",
    inputKind: "image",
    target: "png",
    outputKind: "image",
    progress: 0,
    ...partial
  } as ConversionJob;
}

describe("getJobByMediaId", () => {
  const jobs = {
    a: job({ id: "a", mediaId: "m1", createdAt: 1, status: "completed" }),
    b: job({ id: "b", mediaId: "m1", createdAt: 5, status: "converting" }),
    c: job({ id: "c", mediaId: "m2", createdAt: 3, status: "queued" })
  };

  it("returns the latest job for a media id", () => {
    expect(getJobByMediaId(jobs, "m1")?.id).toBe("b");
    expect(getJobByMediaId(jobs, "m2")?.id).toBe("c");
  });
  it("returns undefined for an unknown or missing id", () => {
    expect(getJobByMediaId(jobs, "nope")).toBeUndefined();
    expect(getJobByMediaId(jobs, undefined)).toBeUndefined();
  });
});

describe("status helpers", () => {
  const jobs = {
    a: job({ id: "a", mediaId: "m1", createdAt: 1, status: "converting" }),
    b: job({ id: "b", mediaId: "m2", createdAt: 1, status: "completed" }),
    c: job({ id: "c", mediaId: "m3", createdAt: 1, status: "failed" })
  };

  it("detects active jobs (queued/preparing/converting)", () => {
    expect(isActiveConversionJob(jobs.a)).toBe(true);
    expect(isActiveConversionJob(jobs.b)).toBe(false);
    expect(isActiveConversionJob(jobs.c)).toBe(false);
    expect(isActiveConversionJob(undefined)).toBe(false);
  });
  it("detects converting / converted media", () => {
    expect(isMediaConverting(jobs, "m1")).toBe(true);
    expect(isMediaConverted(jobs, "m2")).toBe(true);
    expect(isMediaConverting(jobs, "m2")).toBe(false);
    expect(isMediaConverted(jobs, "m1")).toBe(false);
  });
});

describe("selectJobsByBatch", () => {
  const jobs = {
    a: job({ id: "a", mediaId: "m1", createdAt: 3, status: "completed", batchId: "b1" }),
    b: job({ id: "b", mediaId: "m2", createdAt: 1, status: "converting", batchId: "b1" }),
    c: job({ id: "c", mediaId: "m3", createdAt: 2, status: "queued", batchId: "b2" })
  };

  it("returns a batch's jobs oldest-first", () => {
    expect(selectJobsByBatch(jobs, "b1").map((j) => j.id)).toEqual(["b", "a"]);
    expect(selectJobsByBatch(jobs, "b2").map((j) => j.id)).toEqual(["c"]);
  });
  it("returns [] for an unknown or missing batchId", () => {
    expect(selectJobsByBatch(jobs, "nope")).toEqual([]);
    expect(selectJobsByBatch(jobs, undefined)).toEqual([]);
  });
});

describe("selectBatchProgress", () => {
  it("counts done + failed (incl. cancelled) and flags finished", () => {
    const jobs = {
      a: job({ id: "a", mediaId: "m1", createdAt: 1, status: "completed", batchId: "b1" }),
      b: job({ id: "b", mediaId: "m2", createdAt: 2, status: "failed", batchId: "b1" }),
      c: job({ id: "c", mediaId: "m3", createdAt: 3, status: "cancelled", batchId: "b1" })
    };
    const p = selectBatchProgress(jobs, "b1");
    expect(p.total).toBe(3);
    expect(p.done).toBe(1);
    expect(p.failed).toBe(2);
    expect(p.finished).toBe(true);
  });
  it("averages progress and is not finished mid-run", () => {
    const jobs = {
      a: job({ id: "a", mediaId: "m1", createdAt: 1, status: "completed", batchId: "b1", progress: 1 }),
      b: job({ id: "b", mediaId: "m2", createdAt: 2, status: "converting", batchId: "b1", progress: 0.5 })
    };
    const p = selectBatchProgress(jobs, "b1");
    expect(p.fraction).toBeCloseTo(0.75);
    expect(p.finished).toBe(false);
  });
  it("an empty / unknown batch is not finished", () => {
    expect(selectBatchProgress({}, "none").finished).toBe(false);
  });
});

describe("selectRecentConvertedJobs", () => {
  const jobs = {
    a: job({ id: "a", mediaId: "m1", createdAt: 1, status: "completed", completedAt: 10 }),
    b: job({ id: "b", mediaId: "m2", createdAt: 2, status: "completed", completedAt: 30 }),
    c: job({ id: "c", mediaId: "m3", createdAt: 3, status: "failed", completedAt: 20 }),
    d: job({ id: "d", mediaId: "m4", createdAt: 4, status: "converting" })
  };

  it("returns completed jobs only, newest-first by completedAt", () => {
    expect(selectRecentConvertedJobs(jobs).map((j) => j.id)).toEqual(["b", "a"]);
  });
  it("honors the limit", () => {
    expect(selectRecentConvertedJobs(jobs, 1).map((j) => j.id)).toEqual(["b"]);
  });
});
