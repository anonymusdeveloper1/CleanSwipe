import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "audio");
mkdirSync(outDir, { recursive: true });

const sampleRate = 44100;

const writeWav = (name, seconds, render) => {
  const frames = Math.floor(sampleRate * seconds);
  const data = new Int16Array(frames);

  for (let i = 0; i < frames; i += 1) {
    const t = i / sampleRate;
    const value = Math.max(-1, Math.min(1, render(t, seconds)));
    data[i] = Math.round(value * 32767);
  }

  const buffer = Buffer.alloc(44 + data.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + data.length * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(data.length * 2, 40);

  for (let i = 0; i < data.length; i += 1) {
    buffer.writeInt16LE(data[i], 44 + i * 2);
  }

  writeFileSync(join(outDir, name), buffer);
};

const envelope = (t, total) => {
  const fadeIn = Math.min(1, t / 0.45);
  const fadeOut = Math.min(1, (total - t) / 0.8);
  return Math.max(0, Math.min(fadeIn, fadeOut));
};

const bed = (tempo, root, brightness) => (t, total) => {
  const beat = Math.floor(t * tempo);
  const pulse = Math.exp(-((t * tempo) % 1) * 6);
  const bass = Math.sin(2 * Math.PI * root * t) * 0.12;
  const chord =
    Math.sin(2 * Math.PI * root * 2 * t) * 0.045 +
    Math.sin(2 * Math.PI * root * 2.5 * t) * 0.035 +
    Math.sin(2 * Math.PI * root * 3 * t) * 0.025;
  const tick = beat % 4 === 0 ? pulse * brightness : pulse * brightness * 0.35;
  return (bass + chord + tick * Math.sin(2 * Math.PI * 880 * t)) * envelope(t, total);
};

writeWav("urgent-bed.wav", 30, bed(3.8, 82, 0.1));
writeWav("calm-bed.wav", 32, bed(2.4, 74, 0.055));
writeWav("trust-bed.wav", 31, bed(2.1, 66, 0.045));
writeWav("travel-bed.wav", 30, bed(3.1, 92, 0.075));
writeWav("productivity-bed.wav", 28, bed(3.4, 98, 0.08));

writeWav("tap.wav", 0.12, (t, total) => Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 38) * envelope(t, total));
writeWav("ding.wav", 0.5, (t, total) => {
  const tone = Math.sin(2 * Math.PI * 880 * t) + Math.sin(2 * Math.PI * 1320 * t) * 0.55;
  return tone * Math.exp(-t * 5) * 0.18 * envelope(t, total);
});
writeWav("warning.wav", 0.42, (t, total) => {
  const wobble = Math.sin(2 * Math.PI * (280 + Math.sin(t * 70) * 22) * t);
  return wobble * Math.exp(-t * 4.5) * 0.22 * envelope(t, total);
});
