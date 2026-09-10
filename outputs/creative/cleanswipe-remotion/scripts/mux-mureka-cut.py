"""Mux the re-cut Mureka vocal onto both silent masters.

Two deliverables per aspect: music only, and music + the synthesised SFX layer
(a whoosh on each liquid wipe, three swipes in the deck scene, an impact on the
logo slam). Swipe level is 1.15 - measured earlier at 8-10x the music baseline,
where 0.45 was inaudible under the groove.
"""
import subprocess, os

R = "renders"
MUSIC = "public/music/mureka-A-cut32.wav"
SFX = {"whoosh": "public/audio/promo/whoosh.wav",
       "swipe":  "public/audio/promo/swipe.wav",
       "impact": "public/audio/promo/impact.wav"}
# beat = 0.5s at 120 BPM; the wipes sit on the scene boundaries
WIPES   = [4.5, 11.0, 17.5, 23.0, 27.5]
SWIPES  = [6.0, 7.25, 8.5]
IMPACTS = [27.5]

for size in ("1080x1920", "1920x1080"):
    src = "%s/SwipeClean-promo-%s.mp4" % (R, size)

    # --- music only
    dst = "%s/SwipeClean-promo-%s-mureka.mp4" % (R, size)
    subprocess.check_call([
        "ffmpeg", "-v", "error", "-y", "-i", src, "-i", MUSIC,
        "-filter_complex", "[1:a]apad,atrim=duration=32.0,asetpts=PTS-STARTPTS[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy",
        "-c:a", "aac", "-b:a", "224k", "-shortest", dst])
    print("wrote", dst)

    # --- music + SFX
    ins, chain, mix = ["-i", src, "-i", MUSIC], [], ["[m]"]
    chain.append("[1:a]apad,atrim=duration=32.0,asetpts=PTS-STARTPTS,volume=0.92[m]")
    idx = 2
    for name, times, vol in (("whoosh", WIPES, 0.85), ("swipe", SWIPES, 1.15), ("impact", IMPACTS, 0.9)):
        for t in times:
            ins += ["-i", SFX[name]]
            chain.append("[%d:a]adelay=%d|%d,volume=%.2f[x%d]" % (idx, int(t * 1000), int(t * 1000), vol, idx))
            mix.append("[x%d]" % idx)
            idx += 1
    chain.append("%samix=inputs=%d:normalize=0:duration=first,"
                 "alimiter=limit=0.97,atrim=duration=32.0[a]" % ("".join(mix), len(mix)))
    dst = "%s/SwipeClean-promo-%s-mureka-sfx.mp4" % (R, size)
    subprocess.check_call(["ffmpeg", "-v", "error", "-y"] + ins +
                          ["-filter_complex", ";".join(chain), "-map", "0:v", "-map", "[a]",
                           "-c:v", "copy", "-c:a", "aac", "-b:a", "224k", "-shortest", dst])
    print("wrote", dst)
