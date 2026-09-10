import type { Caption } from "@remotion/captions";

export type ScreenKind =
  | "storage"
  | "smart"
  | "review"
  | "swipe"
  | "stats"
  | "compress"
  | "compare"
  | "convert"
  | "message"
  | "end";

export type Scene = {
  start: number;
  end: number;
  caption: string;
  screen: ScreenKind;
  kicker?: string;
};

export type AdConfig = {
  id: string;
  title: string;
  duration: number;
  brandName?: string;
  background: string;
  audio: string;
  voiceover: string;
  visualStyle: "panic" | "routine" | "trust" | "travel" | "studio";
  accent: string;
  captions: Caption[];
  scenes: Scene[];
};

const cap = (text: string, start: number, end: number): Caption => ({
  text,
  startMs: start * 1000,
  endMs: end * 1000,
  timestampMs: start * 1000,
  confidence: 1,
});

export const ads: AdConfig[] = [
  {
    id: "StorageFullMoment",
    title: "Storage Full At The Worst Moment",
    duration: 27,
    background: "images/storage-full-moment.png",
    audio: "audio/urgent-bed.wav",
    voiceover: "voiceover/elevenlabs/storage-full-moment.mp3",
    visualStyle: "panic",
    accent: "#075ec8",
    captions: [
      cap("Storage full again?", 0, 3),
      cap("CleanSwipe finds the obvious clutter", 3, 8),
      cap("Duplicates, blurry shots, screenshots, big videos", 8, 13),
      cap("Review before deleting", 13, 19),
      cap("Make room for the next memory", 19, 27),
    ],
    scenes: [
      { start: 0, end: 3, caption: "Storage Full?", screen: "storage", kicker: "Right when you need the camera" },
      { start: 3, end: 8, caption: "Find obvious clutter", screen: "smart", kicker: "Open CleanSwipe" },
      { start: 8, end: 14, caption: "Review first", screen: "review", kicker: "You stay in control" },
      { start: 14, end: 22, caption: "Back to filming", screen: "stats", kicker: "Ready for the moment" },
      { start: 22, end: 27, caption: "Scan your camera roll", screen: "end", kicker: "Try CleanSwipe" },
    ],
  },
  {
    id: "CameraRollReset",
    title: "The 10-Minute Camera Roll Reset",
    duration: 30,
    background: "images/camera-roll-reset.png",
    audio: "audio/calm-bed.wav",
    voiceover: "voiceover/elevenlabs/camera-roll-reset.mp3",
    visualStyle: "routine",
    accent: "#10b981",
    captions: [
      cap("Don't clean everything tonight", 0, 5),
      cap("Pick one month", 5, 8),
      cap("Swipe to keep or delete", 8, 16),
      cap("Review the delete list", 16, 22),
      cap("Repeat weekly", 22, 30),
    ],
    scenes: [
      { start: 0, end: 5, caption: "Start smaller", screen: "message", kicker: "Your whole camera roll can wait" },
      { start: 5, end: 8, caption: "Pick a month", screen: "swipe", kicker: "One small reset" },
      { start: 8, end: 16, caption: "Swipe to decide", screen: "swipe", kicker: "Keep right. Delete left." },
      { start: 16, end: 22, caption: "Review before delete", screen: "review", kicker: "Nothing disappears automatically" },
      { start: 22, end: 30, caption: "10-minute reset", screen: "end", kicker: "Try CleanSwipe weekly" },
    ],
  },
  {
    id: "SmartCleanFirstPass",
    title: "Smart Clean Does The Boring First Pass",
    duration: 29,
    background: "images/smart-clean-trust.png",
    audio: "audio/trust-bed.wav",
    voiceover: "voiceover/elevenlabs/smart-clean-first-pass.mp3",
    visualStyle: "trust",
    accent: "#075ec8",
    captions: [
      cap("I don't trust auto-delete apps", 0, 4),
      cap("Finds clutter. Doesn't decide for you.", 4, 9),
      cap("Duplicates, similar, blurry, screenshots", 9, 15),
      cap("Review the results", 15, 22),
      cap("You choose what goes", 22, 29),
    ],
    scenes: [
      { start: 0, end: 4, caption: "No auto-delete", screen: "message", kicker: "Your memories need review" },
      { start: 4, end: 12, caption: "Find clutter first", screen: "smart", kicker: "Duplicates. Similar. Blurry." },
      { start: 12, end: 18, caption: "Review results", screen: "review", kicker: "Keep what matters" },
      { start: 18, end: 24, caption: "You decide", screen: "review", kicker: "Final choice is yours" },
      { start: 24, end: 29, caption: "Do the first pass", screen: "end", kicker: "Try Smart Clean" },
    ],
  },
  {
    id: "BigVideoFlight",
    title: "Big Videos Before The Flight",
    duration: 28,
    background: "images/big-video-flight.png",
    audio: "audio/travel-bed.wav",
    voiceover: "voiceover/elevenlabs/big-video-flight.mp3",
    visualStyle: "travel",
    accent: "#0f766e",
    captions: [
      cap("Check big videos before you travel", 0, 5),
      cap("Find heavy files", 5, 9),
      cap("Compress first", 9, 15),
      cap("Compare original vs compressed", 15, 22),
      cap("Make room before you leave", 22, 28),
    ],
    scenes: [
      { start: 0, end: 5, caption: "Before a trip...", screen: "storage", kicker: "Big videos eat storage" },
      { start: 5, end: 9, caption: "Find heavy files", screen: "compress", kicker: "Videos first" },
      { start: 9, end: 15, caption: "Compress first", screen: "compress", kicker: "Original -> smaller copy" },
      { start: 15, end: 22, caption: "Compare before deciding", screen: "compare", kicker: "Compressed / Original" },
      { start: 22, end: 28, caption: "Make room before you go", screen: "end", kicker: "Try CleanSwipe Compress" },
    ],
  },
  {
    id: "ConvertBeforeSend",
    title: "Convert It Before You Send It",
    duration: 26,
    background: "images/convert-before-send.png",
    audio: "audio/productivity-bed.wav",
    voiceover: "voiceover/elevenlabs/convert-before-send.mp3",
    visualStyle: "studio",
    accent: "#8b5cf6",
    captions: [
      cap("Wrong file format?", 0, 4),
      cap("Don't upload to a random site", 4, 8),
      cap("Convert on your phone", 8, 16),
      cap("Save or share", 16, 22),
      cap("CleanSwipe Studio", 22, 26),
    ],
    scenes: [
      { start: 0, end: 5, caption: "Wrong format?", screen: "message", kicker: "Can you send it as MP4?" },
      { start: 5, end: 9, caption: "Open Studio", screen: "convert", kicker: "Clean -> Convert" },
      { start: 9, end: 16, caption: "Choose format", screen: "convert", kicker: "Available formats only" },
      { start: 16, end: 22, caption: "Convert and share", screen: "compare", kicker: "Done on your phone" },
      { start: 22, end: 26, caption: "Try CleanSwipe Studio", screen: "end", kicker: "Cleanup + media tools" },
    ],
  },
];
