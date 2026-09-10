import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "voiceover", "elevenlabs");
mkdirSync(outDir, { recursive: true });

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  throw new Error("ELEVENLABS_API_KEY is not available in this process.");
}

const scripts = [
  {
    id: "storage-full-moment",
    text:
      "Storage full, right when you need the camera? Open CleanSwipe. It finds duplicates, blurry shots, screenshots, and giant videos. You review before deleting, then get back to filming the moment that matters.",
  },
  {
    id: "camera-roll-reset",
    text:
      "Don't clean your whole camera roll tonight. Pick one month in CleanSwipe. Swipe right to keep, left to delete, review the delete list, and make camera-roll cleanup a ten-minute weekly reset.",
  },
  {
    id: "smart-clean-first-pass",
    text:
      "I don't want an app deleting memories for me. I want it to find the mess, then let me decide. CleanSwipe flags duplicates, similar shots, blurry photos, screenshots, memes, and large files. You review. You choose.",
  },
  {
    id: "big-video-flight",
    text:
      "Before a trip, check the giant videos. CleanSwipe shows heavy files, lets you compress a video, compare the result, and decide what to do with the original. More room before you leave.",
  },
  {
    id: "convert-before-send",
    text:
      "Wrong file format? Skip the random converter site. Open CleanSwipe Studio, pick your media, choose an available format, convert on your phone, then save or share.",
  },
];

const voiceId = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";
console.log(`Selected ElevenLabs male voice ID: ${voiceId}`);

for (const script of scripts) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: script.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.38,
        similarity_boost: 0.78,
        style: 0.45,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voiceover generation failed for ${script.id}: ${response.status} ${response.statusText} ${body}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const outPath = join(outDir, `${script.id}.mp3`);
  writeFileSync(outPath, audioBuffer);
  console.log(`Wrote public/voiceover/elevenlabs/${script.id}.mp3`);
}
