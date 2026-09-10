"""Cut the client-supplied reference track to the film's 32.000s.

The track runs at 130.011 BPM with its downbeat at 0.8706s; the film is cut to
120 BPM. Rather than splice, one continuous 16-bar window is taken and stretched
120/130, which lands the track exactly on the film's grid with no edits at all.

The window is chosen by the track's own arrangement, measured beat by beat:

  source 13.790s  the sub-bass slams back in after a four-bar drop-out
                  -> placed at film 4.500s, the liquid wipe to green where the
                     phone rises. So the film's drop IS the track's drop.
  source  9.643s  = 13.790 - 4.500 x (130/120), one beat before bar 6, inside
                  the sub-less stretch -> the film's sparse intro plays over the
                  track's own sub-less bars.
  source 37.790s  the sub drops out again -> lands at film 30.5s, thinning the
                  last bar and a half on its own.

Outro, as asked for: at 27.500s - the frame the logo slams in - the level is cut
hard over 80ms to 18% rather than faded or silenced, so the beat stops dead but
keeps moving quietly underneath the endcard, then closes cleanly on 32.000.
Both aspect ratios get this identical audio.
"""
import subprocess, os

SRC = "public/music/reference-source.mp3"
OUT = "public/music/reference-cut32.wav"

START, LEN = 9.6425, 29.53846          # 16 bars at 130.011 BPM
TEMPO = 120.0 / 130.011                # -> exactly 32.000s at 120 BPM
CUT, CUT_MS, FLOOR = 27.5, 0.08, 0.18  # the outro: hard duck, not a fade

fc = ("[0:a]atrim=start=%.5f:duration=%.5f,asetpts=PTS-STARTPTS,"
      "atempo=%.6f,"
      "volume=volume='1-%.3f*clip((t-%.3f)/%.3f,0,1)':eval=frame,"
      "atrim=duration=32.0,"
      "afade=t=in:st=0:d=0.06,afade=t=out:st=31.80:d=0.20,"
      "aresample=48000[out]"
      % (START, LEN, TEMPO, 1.0 - FLOOR, CUT, CUT_MS))

subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", SRC,
                       "-filter_complex", fc, "-map", "[out]",
                       "-c:a", "pcm_s16le", OUT])
print("window %.3f-%.3fs of source, atempo %.6f (130.011 -> 120.000 BPM)"
      % (START, START + LEN, TEMPO))
print("wrote", OUT, os.path.getsize(OUT), "bytes")
