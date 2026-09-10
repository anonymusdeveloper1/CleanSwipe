"""Mux a 32s audio bed onto both silent masters.

Both aspect ratios get byte-identical audio, so the two cuts start and finish
together - the client asked explicitly that the ending be the same on both.
"""
import subprocess, sys, os

R = "renders"
SFX = {"whoosh": "public/audio/promo/whoosh.wav",
       "swipe":  "public/audio/promo/swipe.wav",
       "impact": "public/audio/promo/impact.wav"}
WIPES   = [4.5, 11.0, 17.5, 23.0, 27.5]     # the five liquid transitions
SWIPES  = [6.0, 7.25, 8.5]                  # cards flicked out of the phone
IMPACTS = [27.5]                            # the logo slam

def mux(audio, tag, with_sfx):
    for size in ("1080x1920", "1920x1080"):
        src = "%s/SwipeClean-promo-%s.mp4" % (R, size)
        dst = "%s/SwipeClean-promo-%s-%s%s.mp4" % (R, size, tag, "-sfx" if with_sfx else "")
        if not with_sfx:
            fc = "[1:a]apad,atrim=duration=32.0,asetpts=PTS-STARTPTS[a]"
            ins = ["-i", src, "-i", audio]
        else:
            ins = ["-i", src, "-i", audio]
            chain = ["[1:a]apad,atrim=duration=32.0,asetpts=PTS-STARTPTS,volume=0.92[m]"]
            mix, idx = ["[m]"], 2
            for name, times, vol in (("whoosh", WIPES, 0.85), ("swipe", SWIPES, 1.15), ("impact", IMPACTS, 0.9)):
                for t in times:
                    ins += ["-i", SFX[name]]
                    chain.append("[%d:a]adelay=%d|%d,volume=%.2f[x%d]"
                                 % (idx, int(t * 1000), int(t * 1000), vol, idx))
                    mix.append("[x%d]" % idx); idx += 1
            chain.append("%samix=inputs=%d:normalize=0:duration=first,"
                         "alimiter=limit=0.97,atrim=duration=32.0[a]" % ("".join(mix), len(mix)))
            fc = ";".join(chain)
        subprocess.check_call(["ffmpeg", "-v", "error", "-y"] + ins +
                              ["-filter_complex", fc, "-map", "0:v", "-map", "[a]",
                               "-c:v", "copy", "-c:a", "aac", "-b:a", "224k", "-shortest", dst])
        d = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
                                     "format=duration", "-of", "default=nw=1:nk=1", dst]).decode().strip()
        print("  %-52s %ss  %.1f MB" % (os.path.basename(dst), d, os.path.getsize(dst) / 1e6))

if __name__ == "__main__":
    audio, tag = sys.argv[1], sys.argv[2]
    print(tag)
    mux(audio, tag, False)
    mux(audio, tag, True)
