import { beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoLibraryService } from "@/services/photo-library-service";

const mediaLibrary = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  getAssetsAsync: vi.fn()
}));

vi.mock("expo-media-library", () => ({
  MediaType: { photo: "photo", video: "video" },
  SortBy: { creationTime: "creationTime", modificationTime: "modificationTime" },
  getPermissionsAsync: mediaLibrary.getPermissionsAsync,
  getAssetsAsync: mediaLibrary.getAssetsAsync,
  requestPermissionsAsync: vi.fn(),
  getAssetInfoAsync: vi.fn(),
  deleteAssetsAsync: vi.fn()
}));

// The snapshot path never maps asset metadata, so keep the test native-/i18n-
// free by replacing the unrelated mapAsset date dependency.
vi.mock("@/utils/date", () => ({
  resolveMediaDate: vi.fn(() => ({ time: undefined, monthKey: "unknown" }))
}));

const newest = { id: "asset-3", modificationTime: 300 };

describe("PhotoLibraryService.getLibraryAssetIdSnapshot", () => {
  beforeEach(() => {
    mediaLibrary.getPermissionsAsync.mockReset();
    mediaLibrary.getAssetsAsync.mockReset();
    mediaLibrary.getPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
  });

  it("returns every ID after a complete, stable paginated read", async () => {
    mediaLibrary.getAssetsAsync
      .mockResolvedValueOnce({
        assets: [newest, { id: "asset-2", modificationTime: 200 }],
        totalCount: 3,
        hasNextPage: true,
        endCursor: "cursor-2"
      })
      .mockResolvedValueOnce({
        assets: [{ id: "asset-1", modificationTime: 100 }],
        totalCount: 3,
        hasNextPage: false,
        endCursor: "cursor-3"
      })
      .mockResolvedValueOnce({
        assets: [newest],
        totalCount: 3,
        hasNextPage: true,
        endCursor: "cursor-1"
      });

    await expect(PhotoLibraryService.getLibraryAssetIdSnapshot()).resolves.toEqual({
      assetIds: ["asset-3", "asset-2", "asset-1"],
      signature: { totalCount: 3, newestId: "asset-3", newestModificationTime: 300 }
    });
  });

  it("refuses to prune from a snapshot whose final signature changed", async () => {
    mediaLibrary.getAssetsAsync
      .mockResolvedValueOnce({
        assets: [newest],
        totalCount: 1,
        hasNextPage: false,
        endCursor: "cursor-1"
      })
      .mockResolvedValueOnce({
        assets: [{ id: "asset-4", modificationTime: 400 }],
        totalCount: 2,
        hasNextPage: true,
        endCursor: "cursor-1"
      });

    await expect(PhotoLibraryService.getLibraryAssetIdSnapshot()).resolves.toBeUndefined();
  });

  it("refuses to prune when native pagination cannot advance", async () => {
    mediaLibrary.getAssetsAsync.mockResolvedValueOnce({
      assets: [newest],
      totalCount: 2,
      hasNextPage: true,
      endCursor: undefined
    });

    await expect(PhotoLibraryService.getLibraryAssetIdSnapshot()).resolves.toBeUndefined();
  });

  it("does not read IDs without media permission", async () => {
    mediaLibrary.getPermissionsAsync.mockResolvedValueOnce({ granted: false, status: "denied" });

    await expect(PhotoLibraryService.getLibraryAssetIdSnapshot()).resolves.toBeUndefined();
    expect(mediaLibrary.getAssetsAsync).not.toHaveBeenCalled();
  });
});
