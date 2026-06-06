import { PhotoAsset } from "@/models/photo";
import { getMonthKey } from "@/utils/date";

const now = new Date("2026-06-12T12:00:00Z").getTime();

export const samplePhotos: PhotoAsset[] = [
  {
    id: "demo-1",
    uri: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80",
    filename: "Lake_Tahoe_Expedition.jpg",
    width: 4032,
    height: 3024,
    creationTime: now,
    mediaType: "photo",
    sizeBytes: 4_200_000,
    monthKey: getMonthKey(now)
  },
  {
    id: "demo-2",
    uri: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80",
    filename: "Forest_4K.jpg",
    width: 3840,
    height: 2160,
    creationTime: new Date("2026-05-18").getTime(),
    mediaType: "photo",
    sizeBytes: 32_400_000,
    monthKey: "2026-05"
  },
  {
    id: "demo-3",
    uri: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    filename: "Sunrise_RAW.jpg",
    width: 5472,
    height: 3648,
    creationTime: new Date("2026-04-21").getTime(),
    mediaType: "photo",
    sizeBytes: 28_100_000,
    monthKey: "2026-04"
  },
  {
    id: "demo-4",
    uri: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    filename: "Mountain_Panoramic.jpg",
    width: 6000,
    height: 2000,
    creationTime: new Date("2026-03-09").getTime(),
    mediaType: "photo",
    sizeBytes: 19_800_000,
    monthKey: "2026-03"
  },
  {
    id: "demo-5",
    uri: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
    filename: "Night_Sky.jpg",
    width: 4096,
    height: 2160,
    creationTime: new Date("2025-12-02").getTime(),
    mediaType: "photo",
    sizeBytes: 24_500_000,
    monthKey: "2025-12"
  },
  {
    id: "demo-6",
    uri: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=1200&q=80",
    filename: "Portrait_Test.jpg",
    width: 3024,
    height: 3024,
    creationTime: new Date("2026-06-01").getTime(),
    mediaType: "photo",
    sizeBytes: 8_500_000,
    monthKey: "2026-06"
  },
  {
    id: "demo-7",
    uri: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80",
    filename: "Mossy_Path.jpg",
    width: 4032,
    height: 3024,
    creationTime: new Date("2026-06-03").getTime(),
    mediaType: "photo",
    sizeBytes: 12_300_000,
    monthKey: "2026-06"
  },
  {
    id: "demo-8",
    uri: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
    filename: "Desert_Ridge.jpg",
    width: 4032,
    height: 3024,
    creationTime: new Date("2026-02-02").getTime(),
    mediaType: "photo",
    sizeBytes: 11_100_000,
    monthKey: "2026-02"
  }
];
