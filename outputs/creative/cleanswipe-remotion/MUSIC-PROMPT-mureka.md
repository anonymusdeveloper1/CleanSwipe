# Mureka prompts — SwipeClean 32s promo

The film is **32.000s, 120 BPM, 4/4, 16 bars**, and every cut already lands on
that grid. The track must be 120 BPM or the sync breaks.

---

## 1. STYLE PROMPT  (paste into Mureka's style field)

**822 characters** — inside the 1000 limit.

```
Male lead vocal, warm baritone-tenor, close-miked and dry, conversational not belted — a real person, not a choir. Slight rasp, no vibrato, no autotune.

Modern fintech-ad pop. 120 BPM, 4/4, bright major key. Muted electric piano or plucked synth, tight round sub-bass, finger snaps on 2 and 4, soft kick, crisp rim, one shaker. No guitars, no strings, no orchestral swell.

Sparse and near-spoken for the first 3 seconds over one plucked chord; then four ascending stabs; then a full-band drop. Steady groove from there, with a short lift in the last 4 seconds as the vocal takes the tagline. End hard on a downbeat — no fade, no ringing tail.

Punchy, not loud. Dry vocal, short slap delay only. Leave midrange space — the words sit under motion graphics with no narration and must stay intelligible. Exactly 32 seconds.
```

### Fallback, 453 characters

If the field is tighter than 1000, or Mureka
ignores long prompts, use this instead. It keeps tempo, length, voice, the
four stabs and the drop — the things sync depends on — and drops only the
production nuance.

```
Male lead vocal, warm baritone-tenor, dry and close-miked, conversational not belted. Modern fintech-ad pop, 120 BPM, 4/4, bright major. Muted electric piano, round sub-bass, finger snaps on 2 and 4, soft kick, one shaker. No guitars or strings. Near-spoken for 3 seconds, four ascending stabs, then a full-band drop; steady groove, short lift at the end for the tagline; hard stop on a downbeat. Punchy not loud, words intelligible. Exactly 32 seconds.
```

---

## 2. LYRICS PROMPT  (paste into Mureka's lyrics field)

Timestamps are for *your* reference when checking the render — strip them if
Mureka prefers plain lyrics.

Density is written to be singable, not crammed: at 120 BPM one beat comfortably
carries about two syllables, and every section below sits at or under that.
Syllable counts per section are noted after the block.

```
[0:00.0 — sparse, almost spoken, one plucked chord]
Your camera roll —
every shot you never chose

[0:03.27 — FOUR ASCENDING STABS, one syllable per stab, each louder and higher]
light-er, LIGHT-ER

[0:04.5 — FULL BAND DROP]
Swipe it left, let it fall,
swipe it right, that one stays.
Keep the nights you meant to keep,
lose the rest — one thumb, one day.

[0:11.0]
Or don't lift a finger,
let it find them for you:
the doubles, the blurs, the screens,
everything you never meant to keep.

[0:17.5]
Half the size, same sky,
same gold on the water,
nothing you'd notice,
nothing you'd miss.

[0:23.0]
Gigabytes back in your hand,
and the cleaning's done right where you stand.
Watch it climb.

[0:27.5 — lift, tagline]
SwipeClean.
Clean your gallery,
keep the memories.
SwipeClean.
```

**Density check** — beats available vs syllables written:

| Section | Beats | Syllables | Per beat |
|---|---|---|---|
| Intro (to the stabs) | 6.5 | 11 | 1.7 |
| Stabs | 4 | 4 | 1.0 |
| Swipe | 13 | 26 | 2.0 |
| Smart Clean | 13 | 28 | 2.2 |
| Compress | 11 | 20 | 1.8 |
| Stats | 9 | 17 | 1.9 |
| Endcard | 9 | 14 | 1.6 |

Smart Clean is the densest at 2.2 — it will read as talk-sung rather than
melodic. If it feels rushed, cut *"everything"* to *"all"* in the last line and
it drops to 1.9.

The brand name lands **twice** in the endcard, opening and closing it, so it is
the last thing heard.

---

## 3. THE HIT MAP — where the music must land

Give this to Mureka as extra guidance, or use it to check the render.

| Time | What happens on screen | What the music should do |
|---|---|---|
| 0:00.0 | Type builds word by word on black | Almost nothing — one chord, voice barely above spoken |
| **0:03.27** | **"lighter." jumps bigger — step 1** | **Stab 1** |
| **0:03.50** | **step 2** | **Stab 2, higher** |
| **0:03.73** | **step 3** | **Stab 3, higher** |
| **0:03.97** | **step 4, largest** | **Stab 4, highest — then a beat of air** |
| **0:04.5** | Paint pours down, cut to green; phone rises | **THE DROP.** Full band in |
| 0:06–0:10 | Photos fly out of the phone, KEEP / CLEAR | Groove holds, snaps drive it |
| **0:11.0** | Pour to orange — Smart Clean | Chord change, same groove |
| **0:17.5** | Pour to blue — Compress | Chord change |
| **0:23.0** | Pour to purple — Stats | Chord change, start the lift |
| **0:27.5** | Pour to black — logo slam | Lift resolves, vocal takes the tagline |
| 0:32.0 | End | Land on the downbeat, stop dead |

The four stabs are the signature moment. They are **7 frames apart (0.233s)**,
which is very close to an eighth note at 120 BPM (0.25s) — near enough that a
straight eighth-note figure locks to them. If Mureka lands them as clean
eighths and it drifts, tell me and I'll retime those four steps to exactly
0.25s each so they sit dead on the grid.

---

## 4. LYRIC CONSTRAINTS — do not let a regenerate break these

SwipeClean is live on Google Play, so the sung claims are held to the same bar
as the store listing. If you regenerate the lyrics, check the new ones against
this list.

**Never sing:**
- "nothing ever leaves your phone" / "we send nothing" — false. The free tier
  links AdMob and RevenueCat, which transmit device and advertising identifiers.
  The lyric above says *"the cleaning's done right where you stand"*, which is
  true: the analysis is local.
- "no quality loss" / "lossless" / "identical" — the approved wording is
  "without visibly losing quality". *"Nothing you'd notice"* is the sung form.
- "free" attached to Smart Clean, Convert, video compression or Compress All —
  all Pro.
- "AI" / "machine learning" — the detectors are MD5, perceptual dHash and
  variance-of-Laplacian. The meme detector is a metadata heuristic.
- Any superlative — "#1", "best", "fastest" — Play policy.
- Any competitor or OS-vendor name.
- Anything about iPhone or the App Store — Android only.

---

## 5. Decisions locked

**Tempo: 120 BPM.** Confirmed. The film is cut to it and nothing needs
re-rendering. For the record, the Moolah reference's own track measures
~102.5 BPM (autocorrelation of its onset envelope), so this is deliberately a
touch brisker than the reference.

**Vocal: sung hook**, as written above — melodic male topline, ad-jingle
shaped, not spoken.

## 6. Honest limitation

The tempo figure is measured. **The style description is not derived from
hearing the reference** — this environment has no audio playback, only audio
analysis. Genre, instrumentation and vocal character were inferred from the
film's visual language and the fintech-ad category.

If the Moolah track turns out to be something else entirely — lo-fi, a female
topline, guitar-led — the style prompt in section 1 is the part to rewrite. The
lyrics, the hit map and the claim constraints are all grounded in the film
itself and stay valid regardless.
