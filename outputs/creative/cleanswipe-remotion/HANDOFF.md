# CleanSwipe Remotion Ad Drafts

Created: 2026-07-04

This folder contains five 9:16 Remotion video drafts based on the CleanSwipe short-video script pack.

## Current V2 MP4 Drafts

These are the latest review files. They use ElevenLabs male voiceover and separate dynamic visual treatments per concept.

- `renders/v2-storage-full-moment.mp4` - 27s - Storage Full At The Worst Moment - panic alert / floating clutter tiles
- `renders/v2-camera-roll-reset.mp4` - 30s - The 10-Minute Camera Roll Reset - weekly routine / checklist / filmstrip
- `renders/v2-smart-clean-first-pass.mp4` - 29s - Smart Clean Does The Boring First Pass - review-first trust / proof cards
- `renders/v2-big-video-flight.mp4` - 28s - Big Videos Before The Flight - travel prep / compression meter
- `renders/v2-convert-before-send.mp4` - 26s - Convert It Before You Send It - studio / format orbit / chat prompt

All five v2 files are 1080x1920 H.264 MP4 files with AAC audio.

## Original MP4 Drafts

- `renders/storage-full-moment.mp4` - 27s - Storage Full At The Worst Moment
- `renders/camera-roll-reset.mp4` - 30s - The 10-Minute Camera Roll Reset
- `renders/smart-clean-first-pass.mp4` - 29s - Smart Clean Does The Boring First Pass
- `renders/big-video-flight.mp4` - 28s - Big Videos Before The Flight
- `renders/convert-before-send.mp4` - 26s - Convert It Before You Send It

These originals use Windows SAPI placeholder narration and are superseded by the v2 files above.

## Included Assets

- Generated lifestyle/key-scene images: `public/images/`
- Local music/effect placeholder WAVs: `public/audio/*-bed.wav`, `tap.wav`, `warning.wav`
- ElevenLabs male narration MP3s: `public/voiceover/elevenlabs/`
- Original generated narration WAVs: `public/audio/voice-*.wav`
- Preview stills: `renders/stills/`
- V2 preview stills: `renders/stills-v2/`

## Build Notes

- Source data: `src/ad-data.ts`
- Main renderer: `src/AdVideo.tsx`
- Composition registry: `src/Root.tsx`
- Audio bed generator: `scripts/make-audio.mjs`
- Voiceover generator: `scripts/make-voiceovers.ps1`
- ElevenLabs voiceover generator: `scripts/generate-elevenlabs-voiceovers.mjs`

The v2 voiceovers were generated through ElevenLabs using a male voice. The music beds and UI sound effects are still production placeholders.

## Commands

```bash
npm run dev
npm run lint
npm run make-audio
npm run render:storage
npm run render:reset
npm run render:smart
npm run render:flight
npm run render:convert
```
