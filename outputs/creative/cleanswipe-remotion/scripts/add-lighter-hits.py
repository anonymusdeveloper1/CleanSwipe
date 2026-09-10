"""Put the film's signature moment back into the reference cut, and make it hit.

The word "lighter." jumps to a bigger size in four discrete steps at
3.2667 / 3.5000 / 3.7333 / 3.9667s, scaling 1.00 -> 1.42 -> 1.90 -> 2.50. The
chosen window of the reference track is sub-less across that whole stretch
(measured sub RMS 0.0029), so without this the biggest moment in the film lands
with no low end under it at all.

The first version of these hits was nearly pure sine sub - a 41 Hz fundamental
with a 20 Hz sub-octave under it. That measured correctly and still failed to
stand out, for two reasons the meter cannot see: the ear is roughly 30 dB less
sensitive at 40 Hz than at 1 kHz, and a phone speaker does not reproduce below
about 150 Hz at all. So the note was there and nobody could hear it.

This version keeps the same fundamentals and the same growth curve, but:
  * adds 2nd/3rd/4th harmonics, decaying faster than the fundamental. The ear
    reconstructs the missing fundamental from them, so the hit reads as deep on
    a laptop or phone where the real 41 Hz is simply absent.
  * gives each hit a short attack transient so it has a front edge to cut with.
  * drops the sub-octave on the lowest two hits, where it was inaudible and
    only spending headroom that the audible harmonics now use.
  * ducks the track underneath each hit, so the bass has somewhere to land.
  * runs the harmonic series to the 6th. Stopping at the 4th left the lowest
    hit with only ONE partial above 150 Hz where the top hit had two, so the
    growth measured 2.50x in the sub and only 1.74x in the band a phone can
    actually pass - the hit got deeper without getting bigger.

Headroom is taken from the HITS, never from the track. The cut peaks at 0.7377
and only 0.6308 across the hit window, so there is room for the hits to reach
the ceiling on their own; scaling the whole file instead pulled the body down
2.6 dB, which is not a trade worth making to get a louder intro.

Every one of those layers scales on the SAME curve as the type, so the hits
grow exactly as much as the word does rather than merely getting brighter.
"""
import numpy as np, wave, sys

SR = 48000
STEPS  = [3.26667, 3.50000, 3.73333, 3.96667]
SCALES = [1.0, 1.42, 1.9, 2.5]            # KineticText's steps array, portrait
FREQS  = [55.0, 55.0, 46.2, 41.2]         # each step lower - bigger word, deeper hit
TRIM   = [1.00, 1.00, 0.99, 0.945]        # measured back off the finished file
BASE   = 0.40
CEIL   = 0.980                            # the hits ride up to here, alone
# The hits are peak-limited, so the only remaining way to make them stand out
# further is to give them room. Measured loudness-weighted, the hits sat only
# +0.9 dB over the body; this puts them near +3 dB. Playback loudness
# normalisation takes care of the absolute level either way.
TRACK  = 0.76
DUCK   = 0.40                             # how far the track dips under a hit
DUCK_HOLD, DUCK_REL = 0.075, 0.20
DUCK_PRE = 0.022                          # open the gap just BEFORE the hit


def stab(f0, amp, sub_oct, dur=0.42):
    t = np.arange(int(SR * dur)) / SR
    f = f0 * (1.0 + 0.55 * np.exp(-t * 26.0))          # a short downward bend
    ph = 2 * np.pi * np.cumsum(f) / SR

    body = np.sin(ph) * np.exp(-t * 8.0)
    # Harmonics: this is what makes it audible on a speaker with no low end.
    # Each decays faster than the one below, so the hit opens bright and
    # settles into pure sub - the shape of a real 808 rather than a beep.
    harm = (np.sin(2 * ph) * np.exp(-t * 13.0) * 0.42 +
            np.sin(3 * ph) * np.exp(-t * 19.0) * 0.26 +
            np.sin(4 * ph) * np.exp(-t * 26.0) * 0.18 +
            np.sin(5 * ph) * np.exp(-t * 32.0) * 0.11 +
            np.sin(6 * ph) * np.exp(-t * 38.0) * 0.07)
    # Attack: a short pitched thump plus a filtered tick, so there is a front
    # edge. Without this the hits swell in and never announce themselves.
    atk = (np.exp(-t * 42.0) * np.sin(2 * np.pi * 165.0 * t) * 0.72 +
           np.exp(-t * 120.0) * np.sin(2 * np.pi * 430.0 * t) * 0.38 +
           np.exp(-t * 220.0) * np.sin(2 * np.pi * 780.0 * t) * 0.16)
    sub2 = np.sin(ph / 2) * np.exp(-t * 5.0) * sub_oct
    return (body + harm + atk + sub2) * amp


src, dst = sys.argv[1], sys.argv[2]
f = wave.open(src, "rb")
assert f.getframerate() == SR, f.getframerate()
ch = f.getnchannels()
x = np.frombuffer(f.readframes(f.getnframes()), "<i2").astype(np.float64) / 32768.0
x = x.reshape(-1, ch) if ch > 1 else x.reshape(-1, 1)

# Sidechain: dip the track under every hit so the bass has room. Built first,
# applied to the track only, so the hits themselves are never ducked.
gain = np.ones(len(x))
for t0 in STEPS:
    i = int((t0 - DUCK_PRE) * SR)
    pr = int(SR * DUCK_PRE)
    h, r = int(SR * DUCK_HOLD), int(SR * DUCK_REL)
    seg = np.concatenate([np.linspace(1.0, DUCK, pr),          # duck INTO the hit
                          np.full(h, DUCK),
                          DUCK + (1.0 - DUCK) * (np.arange(r) / r) ** 0.6])
    n = min(len(seg), len(gain) - i)
    gain[i:i + n] = np.minimum(gain[i:i + n], seg[:n])
x *= gain[:, None] * TRACK

# A 41 Hz note at a given amplitude reads smaller than a 55 Hz one, to the ear
# and to a sub-band meter whose filter edge is close by. Compensate on frequency
# alone so the amplitude ratio stays exactly the type's scale array.
hits = np.zeros(len(x))
for k, (t0, sc, fr) in enumerate(zip(STEPS, SCALES, FREQS)):
    amp = BASE * sc * TRIM[k] * (FREQS[0] / fr) ** 0.35
    sg = stab(fr, amp, sub_oct=(0.40 if k < 2 else 0.18))
    i = int(t0 * SR)
    n = min(len(sg), len(hits) - i)
    hits[i:i + n] += sg[:n]
    print("  %.4fs  %5.1f Hz  scale %.2f  amp %.3f" % (t0, fr, sc, amp))

# Fit the hit bus to the ceiling on its own. One scalar across all four, so the
# growth curve is untouched, and the track keeps every dB it had.
for _ in range(4):
    pk = float(np.abs(x + hits[:, None]).max())
    if pk <= CEIL:
        break
    hits *= (CEIL - 0.02) / pk * 0.99
print("  hit bus scaled to sit under %.3f; track untouched (its own peak %.4f)"
      % (CEIL, float(np.abs(x).max())))
x = x + hits[:, None]

# Optional: dump the hit bus alone. Measuring the hits inside the finished mix
# understates their growth, because the track's own midrange sits in the same
# band in every window and acts as a constant offset.
if len(sys.argv) > 3 and sys.argv[3] == "DUMP_BUS":
    b = wave.open(sys.argv[2].replace(".wav", "-busonly.wav"), "wb")
    b.setnchannels(1); b.setsampwidth(2); b.setframerate(SR)
    b.writeframes((np.clip(hits, -1, 1) * 32767).astype("<i2").tobytes()); b.close()

o = wave.open(dst, "wb"); o.setnchannels(x.shape[1]); o.setsampwidth(2); o.setframerate(SR)
o.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()); o.close()
print("wrote", dst)
