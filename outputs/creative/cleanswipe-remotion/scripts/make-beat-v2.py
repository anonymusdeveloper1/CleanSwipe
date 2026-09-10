"""
beat-A.py  --  "SwipeClean" 32.000s promo beat, VARIANT A: closest to the reference.

Brief: follow the measured 16-step onset table almost literally, including the
relative band energies.  Deep sine sub, tight synthesised kick, layered clap,
crisp closed hats.  120 BPM, bar = 2.0s, 16th = 0.125s.

Everything is synthesised from scratch (no samples on this machine).
Output: beat-FINAL.wav  --  48000 Hz, 16-bit stereo, exactly 32.000 s.
"""

import os
import wave
import numpy as np
from scipy import signal

SR = 48000
DUR = 32.0
N = int(round(SR * DUR))              # 1_536_000 samples exactly
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "beat-FINAL.wav")

rng = np.random.default_rng(20260908)

# --------------------------------------------------------------------------
# THE MEASURED GROOVE TABLE  (normalised mean onset energy per 16th, per band)
# index 0..15  ==  16ths 1..16 of the bar
# --------------------------------------------------------------------------
SUB_T  = np.array([1.00,.06,.33,.25, .53,.11,.17,.10, 1.00,.20,.36,.38, .32,.10,.25,.10])
LOW_T  = np.array([ .94,.05,.38,.27, .76,.07,.32,.17, 1.00,.09,.24,.44, .22,.12,.52,.13])
MID_T  = np.array([ .37,.13,.65,.12, 1.00,.13,.39,.15, .46,.16,.11,.82, .11,.08,.92,.20])
HIGH_T = np.array([ .26,.08,.82,.10, 1.00,.06,.40,.09, .28,.08,.10,.92, .10,.04,.93,.13])

# Instrument maps read straight off the table (0-indexed steps).
# KICK: 16ths 1 and 9 are the two halves of the bar, lighter push on 5.
# Ghosts on 3 / 12 / 15 account for the LOW energy the clap body cannot supply.
KICK_MAP = {0: 1.00, 2: 0.32, 4: 0.62, 8: 1.00, 11: 0.42, 14: 0.38}
# CLAP/SNARE: 5, and syncopated on 12 and 15 (MID/HIGH .82/.92 and .92/.93)
CLAP_MAP = {4: 1.00, 11: 0.86, 14: 0.95}
# RIM / stick: the MID energy on 3, 7, 10, 16 that is not hat and not clap
RIM_MAP  = {2: 0.88, 6: 0.40, 9: 0.24, 15: 0.30}
# SURDO (tamborzao low tom) on 3 and 11
TOM_MAP  = {2: 0.58, 10: 0.20}
# mid-band slap, the MID row's .65 on 16th 3 and .39 on 16th 7
SLAP_MAP = {2: 0.78, 6: 0.88, 11: 0.45, 12: 0.20, 14: 0.58}
# HATS: literally the HIGH row, all sixteen steps.
# SUB note starts: the SUB row's real onsets.  (step -> (amp, duration))
SUB_STEPS = {0: (1.00, 0.245), 2: (0.33, 0.20), 4: (0.53, 0.30),
             8: (1.00, 0.245), 10: (0.36, 0.13), 11: (0.38, 0.13),
             12: (0.42, 0.22), 14: (0.25, 0.20)}
# scale degrees (semitones off the section root) for those sub notes
SUB_DEG = {0: 0, 2: 0, 4: 0, 8: 0, 10: 3, 11: 5, 12: 0, 14: -2}

BAR0 = 4.5          # the DROP is bar 1 beat 1 of the groove grid
BARLEN = 2.0
STEP = 0.125
CUT = 27.5          # hard stop, on the frame the logo slams in
SWING = 0.005       # +5 ms on the 16th offbeats only; 8ths stay dead on grid


def step_time(bar, s):
    t = BAR0 + bar * BARLEN + s * STEP
    if s % 2 == 1:              # 16th offbeat -> tiny push
        t += SWING
    return t


# --------------------------------------------------------------------------
# buses
# --------------------------------------------------------------------------
def zbuf():
    return np.zeros((N, 2), dtype=np.float64)


B = {k: zbuf() for k in
     ("kick", "sub", "light", "drum", "perc", "tone", "fx", "send",
      "outro", "slam", "sendlong")}

# the master high-pass, defined here so the "lighter." hits can be
# pre-compensated for it and keep their exact 1 : 1.45 : 1.95 : 2.50 ratio
HP_FC = 22.0
SOS_HP = signal.butter(2, HP_FC / (SR / 2), "high", output="sos")

KICK_EVENTS = []     # (time, depth) for the sidechain


def place(bus, t, sig, gain=1.0, pan=0.0):
    """Mix a mono or stereo signal into a bus at time t (seconds)."""
    if gain == 0.0:
        return
    i = int(round(t * SR))
    if sig.ndim == 1:
        l = np.cos((pan + 1.0) * np.pi / 4.0)
        r = np.sin((pan + 1.0) * np.pi / 4.0)
        st = np.stack([sig * l, sig * r], axis=1)
    else:
        st = sig
    if i >= N:
        return
    if i < 0:
        st = st[-i:]
        i = 0
    n = min(st.shape[0], N - i)
    if n <= 0:
        return
    bus[i:i + n] += st[:n] * gain


def ades(n, atk=0.002, tau=0.10, rel=0.010):
    """attack / exp-decay / short release envelope"""
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    a = max(1, min(int(atk * SR), n // 2))
    e[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    r = max(1, min(int(rel * SR), n // 3))
    e[-r:] *= np.linspace(1.0, 0.0, r)
    return e


def bp(x, lo, hi, order=4):
    lo = float(np.clip(lo, 20.0, SR * 0.45))
    hi = float(np.clip(hi, lo * 1.05, SR * 0.47))
    sos = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band", output="sos")
    return signal.sosfilt(sos, x)


def hpf(x, fc, order=2):
    sos = signal.butter(order, float(np.clip(fc, 10, SR * 0.45)) / (SR / 2),
                        "high", output="sos")
    return signal.sosfilt(sos, x)


def lpf(x, fc, order=2):
    sos = signal.butter(order, float(np.clip(fc, 20, SR * 0.45)) / (SR / 2),
                        "low", output="sos")
    return signal.sosfilt(sos, x)


def sweep_bp(x, f0, f1, q=1.8, order=2, nblocks=200):
    """Time-varying bandpass, block-processed with carried filter state.
    Cutoff is always clamped well under Nyquist -- no hand-rolled SVF, no NaN."""
    n = len(x)
    out = np.zeros(n)
    bs = max(64, n // nblocks)
    zi = None
    idx = 0
    while idx < n:
        seg = x[idx:idx + bs]
        frac = idx / max(1, n - 1)
        fc = f0 * (f1 / f0) ** frac
        lo = float(np.clip(fc / q, 25.0, SR * 0.40))
        hi = float(np.clip(fc * q, lo * 1.08, SR * 0.44))
        sos = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band", output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y, zi = signal.sosfilt(sos, seg, zi=zi)
        out[idx:idx + len(seg)] = y
        idx += bs
    return out


# --------------------------------------------------------------------------
# synths
# --------------------------------------------------------------------------
def mk_kick(amp=1.0, dur=0.42, f0=124.0, f1=45.0, ptau=0.028, tau=0.155, click=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / ptau)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * ades(n, atk=0.0026, tau=tau, rel=0.012)
    cn = int(0.011 * SR)
    cl = rng.standard_normal(cn) * np.exp(-np.arange(cn) / SR / 0.0016)
    cl = hpf(cl, 2400)
    body[:cn] += cl * 0.17 * click
    tn = int(0.004 * SR)
    body[:tn] += np.sin(2 * np.pi * 700 * t[:tn]) * np.exp(-t[:tn] / 0.0012) * 0.05 * click
    body = np.tanh(body * 1.08) / np.tanh(1.08)      # harmonics for small speakers
    kb = lpf(body, 900, order=2)                     # keep the midrange clear
    body = kb + (body - kb) * 0.34
    return body * amp


def mk_sub(freq, dur, amp=1.0, tau=None, harm=0.16, glide=1.35, gtau=0.018):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1.0 + (glide - 1.0) * np.exp(-t / gtau))
    ph = 2 * np.pi * np.cumsum(f) / SR
    if tau is None:
        tau = dur * 0.50
    e = ades(n, atk=0.0045, tau=tau, rel=0.012)
    x = np.sin(ph) + harm * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    return x * e * (amp / (1.0 + harm + 0.05))


def mk_clap(amp=1.0):
    dur = 0.26
    n = int(dur * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    for off, g in ((0.000, 0.62), (0.0085, 0.86), (0.0175, 1.00), (0.0275, 0.70)):
        i = int(off * SR)
        ln = int(0.030 * SR)
        for ch in (L, R):
            nz = rng.standard_normal(ln) * np.exp(-np.arange(ln) / SR / 0.0055)
            ch[i:i + ln] += bp(nz, 900, 3800) * g
    i = int(0.028 * SR)
    ln = n - i
    for ch in (L, R):
        tail = rng.standard_normal(ln) * np.exp(-np.arange(ln) / SR / 0.036)
        ch[i:i + ln] += bp(tail, 1300, 5400) * 0.52
    t = np.arange(n) / SR
    tone = (np.sin(2 * np.pi * 188 * t) + 0.65 * np.sin(2 * np.pi * 332 * t)) * np.exp(-t / 0.042)
    L += tone * 0.24
    R += tone * 0.24
    st = np.stack([L, R], axis=1)
    st /= max(1e-9, np.max(np.abs(st)))
    return st * amp


def mk_hat(amp=1.0, tau=0.028, openh=False):
    dur = 0.32 if openh else 0.11
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 6200, 14500, order=4)
    for f, g in ((7300, 0.22), (9450, 0.17), (11900, 0.13)):
        x += g * np.sin(2 * np.pi * f * t) * 0.30
    e = np.exp(-t / (0.11 if openh else tau))
    a = int(0.0007 * SR)
    e[:a] *= np.linspace(0, 1, a)
    r = int(0.004 * SR)
    e[-r:] *= np.linspace(1, 0, r)
    x = x * e
    x /= max(1e-9, np.max(np.abs(x)))
    return x * amp


def mk_slap(amp=1.0, dur=0.13, lo=340.0, hi=1700.0, tau=0.020):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), lo, hi) * np.exp(-t / tau)
    x += np.sin(2 * np.pi * 320 * t) * np.exp(-t / (tau * 0.7)) * 0.35
    x += np.sin(2 * np.pi * 540 * t) * np.exp(-t / (tau * 0.5)) * 0.25
    x /= max(1e-9, np.max(np.abs(x)))
    return x * amp


def mk_rim(amp=1.0):
    n = int(0.055 * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 1500, 3400) * np.exp(-t / 0.0055)
    x += np.sin(2 * np.pi * 430 * t) * np.exp(-t / 0.011) * 0.55
    x += np.sin(2 * np.pi * 1780 * t) * np.exp(-t / 0.0035) * 0.45
    x /= max(1e-9, np.max(np.abs(x)))
    return x * amp


def mk_tom(amp=1.0, f0=170.0, f1=92.0, dur=0.26, tau=0.085):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * ades(n, atk=0.0015, tau=tau, rel=0.010)
    x += bp(rng.standard_normal(n), 300, 2000) * np.exp(-t / 0.010) * 0.18
    x /= max(1e-9, np.max(np.abs(x)))
    return x * amp


def mk_crash(amp=1.0, dur=2.1, hp=3000.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ch = []
    for _ in range(2):
        x = hpf(rng.standard_normal(n), hp)
        e = np.exp(-t / (dur * 0.26))
        e[:int(0.0012 * SR)] *= np.linspace(0, 1, int(0.0012 * SR))
        e[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
        ch.append(x * e)
    st = np.stack(ch, axis=1)
    st /= max(1e-9, np.max(np.abs(st)))
    return st * amp


def mk_riser(dur=0.9, amp=1.0, f0=260.0, f1=5200.0, tone=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ch = [sweep_bp(rng.standard_normal(n), f0, f1, q=2.2) for _ in range(2)]
    st = np.stack(ch, axis=1)
    st /= max(1e-9, np.max(np.abs(st)))
    st *= ((t / dur) ** 2.3)[:, None]
    if tone:
        fs = 180.0 * (900.0 / 180.0) ** (t / dur)
        ph = 2 * np.pi * np.cumsum(fs) / SR
        sn = np.sin(ph) * (t / dur) ** 3.0 * 0.35
        st += sn[:, None]
    st /= max(1e-9, np.max(np.abs(st)))
    fo = int(0.004 * SR)
    st[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return st * amp


def mk_revswell(dur=0.7, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ch = [hpf(rng.standard_normal(n), 2600) * (t / dur) ** 3.2 for _ in range(2)]
    st = np.stack(ch, axis=1)
    st /= max(1e-9, np.max(np.abs(st)))
    fo = int(0.003 * SR)
    st[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return st * amp


def mk_ping(amp=1.0, f=2450.0, dur=0.20):
    """bright percussive accent for the flicked photo cards"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, g in ((1.0, 1.0), (1.51, 0.55), (2.34, 0.32), (3.61, 0.18)):
        x += g * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (0.045 / k ** 0.5))
    x += bp(rng.standard_normal(n), 3500, 11000) * np.exp(-t / 0.006) * 0.6
    x /= max(1e-9, np.max(np.abs(x)))
    return x * amp


def mk_swish(amp=1.0, dur=0.20, up=False):
    n = int(dur * SR)
    t = np.arange(n) / SR
    a, b = (900.0, 7000.0) if up else (7000.0, 900.0)
    ch = [sweep_bp(rng.standard_normal(n), a, b, q=2.6) for _ in range(2)]
    st = np.stack(ch, axis=1)
    st /= max(1e-9, np.max(np.abs(st)))
    e = ((t / dur) ** 2) if up else np.exp(-t / (dur * 0.35))
    st *= e[:, None]
    fo = int(0.003 * SR)
    st[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return st * amp


def mk_pluck(freq, amp=1.0, dur=0.45, cut=1400.0):
    """short filtered saw stab -- the only 'colour' voice"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for det, g in ((0.997, 0.5), (1.0, 1.0), (1.004, 0.5)):
        x += g * signal.sawtooth(2 * np.pi * freq * det * t)
    x = lpf(x, cut, order=4)
    x *= ades(n, atk=0.003, tau=dur * 0.22, rel=0.02)
    x /= max(1e-9, np.max(np.abs(x)))
    return x * amp


def mk_pad(freqs, dur, amp=1.0, cut=950.0, atk=0.6, rel=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ch = []
    for c in range(2):
        x = np.zeros(n)
        for i, f in enumerate(freqs):
            for det in (0.9965 + 0.001 * c, 1.0, 1.0035 - 0.001 * c):
                lfo = 1.0 + 0.0016 * np.sin(2 * np.pi * (0.13 + 0.07 * i + 0.05 * c) * t)
                x += signal.sawtooth(2 * np.pi * f * det * np.cumsum(lfo) / SR) / len(freqs)
        x = lpf(hpf(x, 130, order=2), cut, order=4)
        ch.append(x)
    st = np.stack(ch, axis=1)
    st /= max(1e-9, np.max(np.abs(st)))
    e = np.ones(n)
    a = max(1, int(atk * SR))
    r = max(1, int(rel * SR))
    e[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    e[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return st * e[:, None] * amp


# --------------------------------------------------------------------------
# 0.00 - 3.27  INTRO.  Dark stage, type builds word by word.  Almost no drums.
# --------------------------------------------------------------------------
FMIN = [174.61, 207.65, 261.63]            # F minor triad, mid register, quiet
place(B["tone"], 0.10, mk_pad(FMIN, 4.30, amp=0.150, cut=780, atk=1.1, rel=0.45))

# air bed
na = int(4.6 * SR)
air = np.stack([lpf(hpf(rng.standard_normal(na), 900), 5200) for _ in range(2)], axis=1)
air /= max(1e-9, np.max(np.abs(air)))
aenv = np.linspace(0.25, 1.0, na) ** 2
place(B["tone"], 0.0, air * aenv[:, None] * 0.032)

# distant sub pulses on the two bar downbeats of the intro
place(B["sub"], 0.00, mk_sub(43.65, 1.0, amp=0.185, tau=0.30, harm=0.05, glide=1.0))
place(B["sub"], 2.00, mk_sub(43.65, 1.0, amp=0.215, tau=0.30, harm=0.05, glide=1.0))

# clock ticks -- one per word as the type builds
for k, tt in enumerate((0.50, 1.00, 1.50, 2.00, 2.50, 3.00)):
    g = 0.050 + 0.018 * k
    place(B["perc"], tt, mk_rim(1.0), gain=g, pan=(-0.35 if k % 2 else 0.35))
    place(B["perc"], tt, mk_hat(1.0, tau=0.016), gain=g * 0.7, pan=(0.3 if k % 2 else -0.3))

# short reverse swell into the first "lighter." step -- it ENDS before the
# hit so it cannot inflate hit 1 and flatten the 1 -> 2.5 growth
place(B["fx"], 2.60, mk_revswell(0.60, amp=0.090))

# --------------------------------------------------------------------------
# 3.2667 / 3.5000 / 3.7333 / 3.9667  THE SIGNATURE MOMENT
# Four discrete bass hits, one per scale step of the word "lighter."
# Each LOUDER and LOWER than the last; the 4th carries 2.5x the weight of the 1st.
# --------------------------------------------------------------------------
LIGHTER_T = [3.2667, 3.5000, 3.7333, 3.9667]
LIGHTER_R = [1.00, 1.45, 1.95, 2.50]           # the required weight curve
LIGHTER_BASE = 0.180                           # target peak of hit 1
# per-hit trim, measured back off the finished mix so the printed in-mix peak
# ratio lands on 1 : 1.45 : 1.95 : 2.50 (see the report at the bottom)
LIGHTER_TRIM = [1.000, 1.010, 0.950, 0.960]
LIGHTER_F = [62.0, 51.0, 43.0, 34.0]           # each step LOWER
# identical decay on all four, so the growth is amplitude + pitch only, and so
# the fourth is out of the way before the word settles huge at 4.00
LIGHTER_D = [0.250, 0.250, 0.260, 0.280]
LIGHTER_TAU = [0.082, 0.082, 0.082, 0.082]
LIGHTER_A = [LIGHTER_BASE * r * c for r, c in zip(LIGHTER_R, LIGHTER_TRIM)]

# magnitude of the master high-pass at each hit's fundamental, divided out so
# the 34 Hz step is not quietly shaved relative to the 62 Hz one
_w = np.array(LIGHTER_F) * 2 * np.pi / SR
_hp_mag = np.abs(signal.sosfreqz(SOS_HP, worN=_w)[1])

for k in range(4):
    tt, a, f = LIGHTER_T[k], LIGHTER_A[k], LIGHTER_F[k]
    d, tau, r = LIGHTER_D[k], LIGHTER_TAU[k], LIGHTER_R[k]
    sg = mk_sub(f, d, amp=1.0, tau=tau, harm=0.18, glide=1.55, gtau=0.022)
    sg = sg / max(1e-9, np.max(np.abs(sg)))            # unit peak, exactly
    place(B["light"], tt, sg * (a / _hp_mag[k]))
    # soft low thud transient, growing with the word in the same proportion
    n = int(0.07 * SR)
    thud = lpf(rng.standard_normal(n), 220, order=4) * np.exp(-np.arange(n) / SR / 0.012)
    thud /= max(1e-9, np.max(np.abs(thud)))
    place(B["light"], tt, thud * (0.022 * r))
    # a breath of air so each step still reads on a laptop speaker
    n2 = int(0.10 * SR)
    tick = bp(rng.standard_normal(n2), 1800, 6500) * np.exp(-np.arange(n2) / SR / 0.010)
    tick /= max(1e-9, np.max(np.abs(tick)))
    place(B["light"], tt, tick * (0.013 * r))

# keep the stage almost empty around the four steps: duck the intro pad/air
# hard from just before hit 1 until the drop, so the growth is the only motion
_d0, _d1 = int(3.10 * SR), int(4.46 * SR)
_rampd = np.linspace(1.0, 0.16, int(0.12 * SR))
B["tone"][_d0:_d0 + len(_rampd)] *= _rampd[:, None]
B["tone"][_d0 + len(_rampd):_d1] *= 0.16
_rampu = np.linspace(0.16, 1.0, int(0.06 * SR))
B["tone"][_d1:_d1 + len(_rampu)] *= _rampu[:, None]

# --------------------------------------------------------------------------
# 4.00 - 4.50  the word holds huge.  near-silent.  the gap makes the drop land.
# only a whisper of a riser under the last 0.4 s of the liquid wipe.
# --------------------------------------------------------------------------
place(B["fx"], 4.08, mk_riser(0.42, amp=0.075, f0=500, f1=4200, tone=False))

# --------------------------------------------------------------------------
# 4.50 - 27.50  THE GROOVE.  Table-literal.
# --------------------------------------------------------------------------
G_KICK, G_SUB, G_CLAP, G_HAT = 0.98, 0.86, 0.46, 0.215
G_RIM, G_TOM, G_MIDB, G_SLAP = 0.16, 0.20, 0.44, 0.30

ROOTS = [(4.5, 11.0, 43.65),     # F1  -- green / drop
         (11.0, 17.5, 51.91),    # Ab1 -- orange / Smart Clean
         (17.5, 23.0, 38.89),    # Eb1 -- blue / Compress
         (23.0, 26.5, 58.27),    # Bb1 -- purple / Stats
         (26.5, 32.0, 43.65)]    # F1  -- final slam run-up

# The reference's signature arrangement move: the sub-bass drops out completely
# for whole stretches while mids and hats keep going, then SLAMS back in.
SUB_ON = [(4.5, 11.0), (17.5, 24.5), (26.5, 27.5)]
# -> sub OUT 11.00-17.50 (the whole orange scene) and 24.50-26.50.


def root_at(t):
    for a, b, f in ROOTS:
        if a <= t < b:
            return f
    return 43.65


def sub_on(t):
    return any(a <= t < b for a, b in SUB_ON)


def semi(f, s):
    return f * (2.0 ** (s / 12.0))


for bar in range(12):                       # bars at 4.5 .. 28.5
    for s in range(16):
        t = step_time(bar, s)
        if t >= CUT:
            continue
        root = root_at(t)
        on = sub_on(t)

        # ---- hats: literally the HIGH row, every one of the sixteen steps
        h = HIGH_T[s]
        if h > 0.02:
            openh = (s == 6 and bar % 4 == 3)
            place(B["drum"], t, mk_hat(1.0, tau=0.022 + 0.016 * h, openh=openh),
                  gain=G_HAT * h * (1.25 if openh else 1.0),
                  pan=(-0.22 if s % 2 == 0 else 0.26))

        # ---- kick
        if s in KICK_MAP:
            a = KICK_MAP[s]
            hard = a >= 0.55
            if on:
                dk, f0k, f1k, tk = ((0.42, 126, 45, 0.150) if hard
                                    else (0.24, 108, 50, 0.080))
            else:
                # sub is OUT: the kick tunes up and tightens so the bottom
                # octave really empties -- the hole has to be audible
                dk, f0k, f1k, tk = ((0.22, 134, 68, 0.062) if hard
                                    else (0.16, 116, 74, 0.042))
            place(B["kick"], t,
                  mk_kick(a, dur=dk, f0=f0k, f1=f1k, tau=tk,
                          click=1.0 if hard else 0.6),
                  gain=G_KICK * (1.0 if on else 0.86))
            KICK_EVENTS.append((t, 0.42 if hard else 0.16))

        # ---- clap / snare
        if s in CLAP_MAP:
            a = CLAP_MAP[s]
            place(B["drum"], t, mk_clap(a), gain=G_CLAP)
            place(B["send"], t, mk_clap(a), gain=G_CLAP * 0.30)

        # ---- rim / stick
        if s in RIM_MAP:
            place(B["drum"], t, mk_rim(RIM_MAP[s]), gain=G_RIM,
                  pan=0.42 if s in (2, 9) else -0.40)

        # ---- mid slap (the MID row's .65 on 16th 3 and .39 on 16th 7)
        if s in SLAP_MAP:
            place(B["drum"], t, mk_slap(SLAP_MAP[s]), gain=G_SLAP,
                  pan=(0.30 if s in (2, 11) else -0.34))

        # ---- surdo
        if s in TOM_MAP:
            place(B["drum"], t, mk_tom(TOM_MAP[s]), gain=G_TOM, pan=-0.12)

        # ---- while the sub is out: a dry 16th shaker keeps the top moving
        if not on:
            sn_ = int(0.05 * SR)
            sh = bp(rng.standard_normal(sn_), 4200, 9500) *                 np.exp(-np.arange(sn_) / SR / 0.009)
            sh /= max(1e-9, np.max(np.abs(sh)))
            place(B["drum"], t, sh * (0.055 if s % 2 else 0.032),
                  pan=0.38 if s % 2 else -0.36)

        # ---- ghost fills: every remaining 16th of the SUB and LOW rows
        if on and s not in SUB_STEPS and SUB_T[s] > 0.03:
            place(B["sub"], t, mk_sub(root, 0.085, amp=SUB_T[s] * 0.62,
                                      tau=0.030, harm=0.10, glide=1.2),
                  gain=G_SUB)
        if LOW_T[s] > 0.03 and s not in KICK_MAP:
            gn = int(0.085 * SR)
            gh = np.sin(2 * np.pi * 112 * np.arange(gn) / SR) *                 np.exp(-np.arange(gn) / SR / 0.020)
            gh += bp(rng.standard_normal(gn), 90, 260) *                 np.exp(-np.arange(gn) / SR / 0.014) * 0.5
            gh /= max(1e-9, np.max(np.abs(gh)))
            place(B["drum"], t, gh * (LOW_T[s] * 0.30))

        # ---- sub / mid-bass
        if s in SUB_STEPS:
            a, d = SUB_STEPS[s]
            f = semi(root, SUB_DEG[s])
            if on:
                place(B["sub"], t, mk_sub(f, d, amp=a, tau=d * 0.52), gain=G_SUB)
            else:
                # sub is OUT -- a thin plucked mid-bass an octave up keeps the
                # motion so the hole is obvious but the bar is not empty
                place(B["tone"], t, mk_pluck(f * 2.0, amp=a, dur=min(d * 1.4, 0.30),
                                             cut=760), gain=G_MIDB)


# --- fills into each scene cut ----------------------------------------------
def add_fill(tcut, nsteps=3, g=0.30):
    for k in range(nsteps, 0, -1):
        t = tcut - k * STEP
        if t < BAR0:
            continue
        a = 0.30 + 0.70 * (nsteps - k + 1) / nsteps
        place(B["drum"], t, mk_clap(a * 0.65), gain=G_CLAP * g)
        place(B["drum"], t + STEP / 2, mk_hat(a * 0.5, tau=0.014), gain=G_HAT * 1.1,
              pan=0.3 if k % 2 else -0.3)


for tc, ns, gg in ((11.0, 3, 0.30), (17.5, 3, 0.30), (23.0, 3, 0.32), (27.5, 4, 0.42)):
    add_fill(tc, ns, gg)

# --- crashes + bass moves on the liquid-wipe cuts ---------------------------
for tc, cg in ((4.50, 0.34), (11.00, 0.30), (17.50, 0.30), (23.00, 0.30)):
    place(B["perc"], tc, mk_crash(cg, dur=2.2))
    place(B["send"], tc, mk_crash(cg * 0.5, dur=2.2))
    r = root_at(tc + 0.01)
    # bass move: a low->root swoop under the colour change
    place(B["fx"], tc, mk_sub(r, 0.75, amp=0.34, tau=0.26, harm=0.10,
                              glide=2.1, gtau=0.055))
    # a single plucked stab for colour (not a tune -- root + fifth, one hit)
    place(B["tone"], tc, mk_pluck(r * 4.0, amp=0.16, dur=0.55, cut=1500), pan=0.18)
    place(B["tone"], tc + 0.125, mk_pluck(r * 6.0, amp=0.09, dur=0.40, cut=1500), pan=-0.22)

# extra weight on the drop itself
place(B["sub"], 4.50, mk_sub(43.65, 1.05, amp=0.62, tau=0.38, harm=0.14,
                             glide=1.9, gtau=0.045), gain=G_SUB)
place(B["perc"], 4.50, mk_swish(0.30, dur=0.55, up=False))

# --- risers into every cut --------------------------------------------------
for tc, dd, aa in ((11.0, 0.95, 0.20), (17.5, 0.95, 0.20),
                   (23.0, 0.95, 0.21), (27.5, 1.05, 0.26)):
    place(B["fx"], tc - dd, mk_riser(dd, amp=aa))
    place(B["fx"], tc - 0.55, mk_revswell(0.55, amp=aa * 0.55))

# --- 6.00 / 7.25 / 8.50  photo card flies out and is flicked away -----------
for k, tc in enumerate((6.00, 7.25, 8.50)):
    pan = (-0.45, 0.48, -0.30)[k]
    fw = (1.75, 1.30, 1.00)[k]          # busiest step first
    place(B["perc"], tc, mk_ping(0.88 * fw, f=2350 + 260 * k, dur=0.22), pan=pan)
    place(B["perc"], tc, mk_swish(0.52 * fw, dur=0.22, up=False))
    place(B["perc"], tc, mk_rim(1.0), gain=0.30 * fw, pan=pan * 0.6)
    place(B["send"], tc, mk_ping(0.34, f=2350 + 260 * k, dur=0.22), pan=pan)
    place(B["perc"], tc + 0.06, mk_swish(0.22, dur=0.16, up=True))

# --- sparse atmospheric pad under the scenes (kept low + lowpassed) ---------
CHORDS = {11.0: ([207.65, 261.63, 311.13], 6.4),     # Ab
          17.5: ([155.56, 233.08, 311.13], 5.4),     # Eb
          23.0: ([233.08, 293.66, 349.23], 4.4)}     # Bb
for tt, (fr, dd) in CHORDS.items():
    place(B["tone"], tt, mk_pad(fr, dd, amp=0.055, cut=880, atk=0.35, rel=0.6))

# --------------------------------------------------------------------------
# 27.50  HARD CUT.  The logo slams in.  Everything above stops on this frame.
# --------------------------------------------------------------------------
place(B["slam"], CUT, mk_kick(1.0, dur=0.55, f0=150, f1=41, ptau=0.055,
                              tau=0.20, click=1.0), gain=0.62)
place(B["slam"], CUT, mk_sub(43.65, 1.10, amp=0.72, tau=0.30, harm=0.12,
                             glide=2.4, gtau=0.070))
nslam = int(0.30 * SR)
sl = np.stack([bp(rng.standard_normal(nslam), 220, 6500) *
               np.exp(-np.arange(nslam) / SR / 0.030) for _ in range(2)], axis=1)
sl /= max(1e-9, np.max(np.abs(sl)))
place(B["slam"], CUT, sl * 0.26)
place(B["sendlong"], CUT, sl * 0.30)
place(B["sendlong"], CUT, mk_crash(0.22, dur=1.6))

# --------------------------------------------------------------------------
# 27.50 - 32.00  ENDCARD.  Not silent: a soft hat pattern, a distant sub pulse
# and the tail of the slam keep moving quietly under the tagline + Play badge.
# --------------------------------------------------------------------------
k = int(round((CUT - BAR0) / STEP))          # 27.5 sits exactly on the 16th grid
while True:
    s = k % 16
    bar = k // 16
    t = step_time(bar, s)
    if t > 31.94:
        break
    duckin = float(np.clip((t - CUT) / 0.35, 0.0, 1.0))   # let the slam breathe first
    h = HIGH_T[s]
    if h > 0.05:
        place(B["outro"], t, mk_hat(1.0, tau=0.018 + 0.010 * h),
              gain=0.190 * h * duckin, pan=(-0.30 if s % 2 == 0 else 0.34))
    if s in (0, 8):
        # distant sub pulse, heavily lowpassed so it reads as "far away"
        p = mk_sub(43.65, 0.55, amp=1.0, tau=0.14, harm=0.02, glide=1.0)
        place(B["outro"], t, lpf(p, 95, order=4) * (0.185 * duckin))
    if s == 2:
        place(B["outro"], t, mk_rim(1.0), gain=0.060 * duckin, pan=0.4)
    k += 1

# endcard air
nb = int(4.6 * SR)
oair = np.stack([lpf(hpf(rng.standard_normal(nb), 1200), 6000) for _ in range(2)], axis=1)
oair /= max(1e-9, np.max(np.abs(oair)))
oe = np.clip((np.arange(nb) / SR) / 0.5, 0, 1) * 0.038
place(B["outro"], CUT, oair * oe[:, None])

# a soft chime as the Google Play badge lands
place(B["outro"], 30.00, mk_ping(0.130, f=1046.5, dur=0.55), pan=0.15)
place(B["outro"], 30.00, mk_ping(0.072, f=1568.0, dur=0.45), pan=-0.20)
place(B["sendlong"], 30.00, mk_ping(0.030, f=1046.5, dur=0.55), pan=0.15)


# --------------------------------------------------------------------------
# processing
# --------------------------------------------------------------------------
def make_ir(dur=1.15, seed=11, lo=380.0, hi=6200.0, pre=0.014, decay=0.26):
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    ch = []
    for _ in range(2):
        x = r.standard_normal(n) * np.exp(-t / (dur * decay))
        x = bp(x, lo, hi, order=2)
        p = int(pre * SR)
        x[:p] *= np.linspace(0, 1, p) ** 3
        ch.append(x)
    ir = np.stack(ch, axis=1)
    ir /= max(1e-9, np.max(np.abs(ir)))
    return ir * 0.55


def conv(bus, ir):
    out = np.zeros_like(bus)
    for c in range(2):
        out[:, c] = signal.fftconvolve(bus[:, c], ir[:, c])[:N]
    return out


VERB_SHORT = conv(B["send"], make_ir(1.05, seed=11, decay=0.24))
VERB_LONG = conv(B["sendlong"], make_ir(2.10, seed=23, lo=300, hi=5200, decay=0.30))

# sidechain duck from the kick pattern
duck = np.ones(N)
for tk, depth in KICK_EVENTS:
    i = int(round(tk * SR))
    if i >= N:
        continue
    L = min(int(0.24 * SR), N - i)
    tt = np.arange(L) / SR
    curve = 1.0 - depth * np.exp(-tt / 0.055) * (1.0 - np.exp(-tt / 0.0035))
    duck[i:i + L] = np.minimum(duck[i:i + L], curve)
duck = signal.lfilter([0.02], [1, -0.98], duck)      # smooth the corners
duck = np.clip(duck / max(1e-9, np.max(duck)), 0, 1)

B["sub"] *= duck[:, None]
B["tone"] *= 0.55 + 0.45 * duck[:, None]


def comp(x, thresh=0.32, ratio=3.2, atk_ms=6.0, rel_ms=110.0, mkup=1.0):
    m = np.max(np.abs(x), axis=1)
    ar = np.exp(-1.0 / (rel_ms * 1e-3 * SR))
    env = signal.lfilter([1 - ar], [1, -ar], m)
    g = np.ones_like(env)
    over = env > thresh
    g[over] = (thresh + (env[over] - thresh) / ratio) / env[over]
    aa = np.exp(-1.0 / (atk_ms * 1e-3 * SR))
    g = signal.lfilter([1 - aa], [1, -aa], g)
    g = np.clip(g, 0.05, 1.0)
    return x * g[:, None] * mkup


B["drum"] = comp(B["drum"], thresh=0.30, ratio=3.0, mkup=1.18)
B["kick"] = comp(B["kick"], thresh=0.55, ratio=2.2, atk_ms=3.0, rel_ms=90.0, mkup=1.05)

# gated (pre-cut) master
MG = (B["kick"] + B["sub"] + B["light"] + B["drum"] + B["perc"] * 0.85 +
      B["tone"] + B["fx"] * 0.9 + VERB_SHORT * 0.55)

# the hard stop: a 4 ms gate on the frame the logo hits.  no fade.
gate = np.ones(N)
gi = int(round(CUT * SR))
gl = int(0.004 * SR)
gate[gi:gi + gl] = np.linspace(1, 0, gl)
gate[gi + gl:] = 0.0
MG *= gate[:, None]

# ungated (post-cut) master
MU = B["slam"] + B["outro"] * 0.55 + VERB_LONG * 0.26

MASTER = MG + MU
MASTER = signal.sosfilt(SOS_HP, MASTER, axis=0)  # kill subsonics / DC
MASTER = comp(MASTER, thresh=0.62, ratio=2.4, atk_ms=8.0, rel_ms=150.0, mkup=1.0)


def softclip(x, th=0.72):
    a = np.abs(x)
    s = np.sign(x)
    out = x.copy()
    m = a > th
    out[m] = s[m] * (th + (1 - th) * np.tanh((a[m] - th) / (1 - th)))
    return out


MASTER = softclip(MASTER, 0.72)

pk = float(np.max(np.abs(MASTER)))
MASTER *= 0.94 / max(1e-9, pk)

# clean finish exactly at 32.000 s -- short safety fade only
tp = int(0.50 * SR)
MASTER[-tp:] *= np.linspace(1.0, 0.55, tp)[:, None]
fl = int(0.110 * SR)
MASTER[-fl:] *= (np.cos(np.linspace(0, np.pi / 2, fl)) ** 2)[:, None]
fi = int(0.002 * SR)
MASTER[:fi] *= np.linspace(0, 1, fi)[:, None]

assert MASTER.shape == (N, 2), MASTER.shape
assert np.all(np.isfinite(MASTER)), "non-finite samples"

# --------------------------------------------------------------------------
# write
# --------------------------------------------------------------------------
i16 = (np.clip(MASTER, -1.0, 1.0) * 32767.0).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(i16.tobytes())

# --------------------------------------------------------------------------
# report
# --------------------------------------------------------------------------
mono = MASTER.mean(axis=1)
print("samples:", MASTER.shape[0], " seconds:", MASTER.shape[0] / SR)
print("peak:", round(float(np.max(np.abs(MASTER))), 4),
      " rms:", round(float(np.sqrt(np.mean(mono ** 2))), 4))

print("\n-- 'lighter.' four steps --")
p1 = r1 = None
for i, tt in enumerate(LIGHTER_T):
    a = int(tt * SR)
    b = int((tt + 0.16) * SR)
    seg = mono[a:b]
    pk_ = float(np.max(np.abs(seg)))
    rms_ = float(np.sqrt(np.mean(seg ** 2)))
    if p1 is None:
        p1, r1 = pk_, rms_
    print("  hit%d t=%.4f f=%5.1fHz  peak=%.4f (%.2fx)  rms=%.4f (%.2fx)"
          % (i + 1, tt, LIGHTER_F[i], pk_, pk_ / p1, rms_, rms_ / r1))

print("  isolated (light bus, pre-master):")
_lp = None
for i, tt in enumerate(LIGHTER_T):
    a = int(tt * SR)
    b = int((tt + 0.16) * SR)
    v = float(np.max(np.abs(B["light"][a:b])))
    if _lp is None:
        _lp = v
    print("    hit%d peak=%.4f (%.3fx)" % (i + 1, v, v / _lp))
print("  floor just before hit1 (3.05-3.25): peak=%.4f"
      % float(np.max(np.abs(mono[int(3.05 * SR):int(3.25 * SR)]))))

for lo, hi in ((4.00, 4.50), (4.15, 4.50), (4.30, 4.50)):
    seg = mono[int(lo * SR):int(hi * SR)]
    print("-- gap %.2f-%.2f  peak=%.4f  rms=%.4f" %
          (lo, hi, float(np.max(np.abs(seg))), float(np.sqrt(np.mean(seg ** 2)))))

print("\n-- hard cut --")
for tt in (27.40, 27.49, 27.52, 27.9, 28.5, 30.0, 31.5, 31.95):
    a = int(tt * SR)
    b = a + int(0.03 * SR)
    print("  t=%5.2f  rms=%.4f" % (tt, float(np.sqrt(np.mean(mono[a:b] ** 2)))))

print("\n-- section rms (1.0 s windows, every 1.0 s) --")
for i in range(32):
    a = int(i * SR)
    b = int((i + 1) * SR)
    r = float(np.sqrt(np.mean(mono[a:b] ** 2)))
    print("  %5.1fs  %.4f  %s" % (i, r, "#" * int(r * 220)))

print("")
print("pre-normalisation master peak:", round(pk, 4))
print("")
print("wrote", OUT)
