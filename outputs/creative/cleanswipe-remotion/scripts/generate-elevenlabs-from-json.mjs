import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  throw new Error("ELEVENLABS_API_KEY is not available in this process.");
}

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error("Usage: node scripts/generate-elevenlabs-from-json.mjs <voiceover-plan.json>");
}

const plan = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
if (!Array.isArray(plan.items)) {
  throw new Error("Voiceover plan must contain an items array.");
}

const defaultVoiceId = plan.voiceId || process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";
const modelId = plan.modelId || "eleven_multilingual_v2";
const voiceSettings = {
  stability: 0.38,
  similarity_boost: 0.78,
  style: 0.45,
  use_speaker_boost: true,
  ...(plan.voiceSettings || {}),
};

console.log(`Selected ElevenLabs voice ID: ${defaultVoiceId}`);

for (const item of plan.items) {
  if (!item.text || !item.output) {
    throw new Error("Each voiceover item must include text and output.");
  }

  const outPath = resolve(item.output);
  mkdirSync(dirname(outPath), { recursive: true });

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${item.voiceId || defaultVoiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: item.text,
      model_id: item.modelId || modelId,
      voice_settings: { ...voiceSettings, ...(item.voiceSettings || {}) },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voiceover generation failed for ${item.output}: ${response.status} ${response.statusText} ${body}`);
  }

  writeFileSync(outPath, Buffer.from(await response.arrayBuffer()));
  console.log(`Wrote ${outPath}`);
}
