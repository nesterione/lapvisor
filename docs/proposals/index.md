# Report-builder proposals

Product feedback captured on 2026-06-30 right after building three karting
reports on top of the lapvisor SDK: two per-session race recaps (lap-time based)
and one deep telemetry deep-dive ("where do I lose time, and where did I improve
when I set a new personal best") with a track map, a delta-t curve, speed
traces, mini-sector bars, and an ideal-lap panel.

These are written from the seat of a **report builder**: someone consuming the
SDK to produce visual, insight-dense HTML. The goal is to make that consumer's
life easy without bloating the core. Each proposal is grounded in concrete
friction hit during that session, not speculation.

## What already worked well (keep it)

Credit first, because the foundation is genuinely good and these proposals build
on it rather than replace it.

- **`buildMiniSectors({ count })`** is exactly the right primitive. Proportional
  equal-distance bins gave the "scientific sectors" the user asked for and
  sidestepped the classic trap where track-defined sectors hide a gain in one
  corner behind a loss in the next linkage.
- **`resampleByDistance({ count, maxDistanceM })`** is the clean common-axis
  foundation. Overlaying two laps of different duration on distance just worked.
- **`computeDeltaT`** is the heart of the "where am I losing" view. The continuous
  cumulative curve is the single most useful artifact in the whole report.
- **`bestMiniSectorsAcrossSession`** (ideal lap) is a gold concept. "Stitch your
  own best mini-sectors into one lap" landed as the emotional punchline of the
  report.
- **The `RichSample` shape** (`d`, `t`, `v`, `lat`, `lng`, `heading`, plus G) is
  everything a distance-axis analysis needs in one record.
- **Versioned bundle producers** with published schemas are the right
  architecture. They made the data contract obvious.

## Proposals at a glance

1. Corner detection that works on kart tracks out of the box, and never silently empties downstream reports.
2. A track-geometry model: ordered centerline + named corners, so zones get real labels.
3. Lap-delta reconciliation: make the delta-t endpoint match the headline lap-time delta.
4. Viz-ready geometry: planar projection and a pre-colored comparison line.
5. Lap classification: clean-lap / out-lap / in-lap / incident flags instead of magic time windows.
6. Progression aggregation across sessions: personal-best timeline as a first-class report.
7. A stitched ideal-lap telemetry trace, so the ideal lap can be drawn, not just summed.
8. Synthetic G from GPS when no accelerometer, plus per-corner phase metrics.
9. Session speed envelope for telemetry-level consistency.
10. A report cookbook / facade so builders stop re-gluing the same pipeline.

---

## 1. Corner detection that survives a real kart lap

**What happened.** `detectCorners(bestLapSamples)` returned **zero corners** on a
clean 43.630 s plytinė lap with default options. The track has at least six
obvious corners (a 33 km/h hairpin among them). I fell back to hand-rolling
speed-minima detection with a sliding window just to label the map.

The knock-on cost is worse than the missing labels: `buildImprovementReport`
and `compareCorners` both depend on corner detection, so they silently produce
nothing on the same data. A report builder gets an empty result with no
explanation and assumes the lap is featureless.

**Proposal.**
- Make the default corner prominence **relative to the lap's own speed range**
  rather than an absolute km/h drop, so a 30 to 70 km/h kart lap and a 80 to
  240 km/h circuit lap both detect sensibly out of the box.
- When detection finds nothing, return a diagnostic (the speed range seen, the
  threshold used, the largest drop found) instead of an empty array, so callers
  can tell "no corners" from "threshold too high".
- Give `buildImprovementReport` a documented **fallback to mini-sectors** when no
  corners are detected, so the "where can I find time" report always returns
  something actionable.

**Payoff.** Corner-anchored narratives ("you lose most through Turn 4 exit")
become reliable instead of a coin flip, and the improvement report stops failing
quietly on exactly the short tracks this library targets.

---

## 2. A track-geometry model with named corners

**What happened.** I wanted to say "mini-sector 15 is the Turn 4 to Turn 5
linkage". I couldn't: the only track geometry available was the `kart-track/v1`
gate set, and the track file's `LineString` carried just two points (the
start/finish gate). There is no centerline and no corner registry. I invented
`T1..T6` from speed minima per report, which means the same corner can get a
different number in a different report.

**Proposal.** A track-geometry layer (a `kart-track/v2`, or a sibling geometry
doc) that carries:
- an ordered **centerline polyline** with cumulative track distance,
- a **corner / segment registry**: named entries with distance ranges
  (`{ name: "T4", dEntry, dApex, dExit }`),
- a `projectOntoTrack(samples, track)` helper returning **track distance** for
  each sample (distance along the canonical centerline, not just raw GPS
  cumulative distance).

**Payoff.** Stable, human zone labels shared across every report and every
driver. It also unlocks **distance-anchored** alignment (see proposal 3): two
drivers taking different lines through a hairpin get compared at the same
physical point on track, not just the same proportional fraction of their own
driven distance.

---

## 3. Reconcile delta-t with the lap-time delta

**What happened.** This was the single most confusing thing to explain in the
report. The headline numbers from lap timing were: new PB 0.236 s faster than
old PB, and 0.711 s behind Vladimir. But `computeDeltaT(...).totalMs` came back
as **-549 ms** and **+812 ms** for those same two comparisons, because the laps
have slightly different driven distances and the delta is read at the shared
overlap distance, not at a full normalized lap. I had to write a footnote
explaining why the curve's endpoint disagrees with the headline, and lean on
mini-sector sums for the "true" delta instead.

**Proposal.**
- Add a **normalization mode** to `computeDeltaT` / `compareLaps` so the curve
  can be expressed on a normalized 0..1 lap position (or on track distance via
  proposal 2), making the endpoint equal the actual lap-time delta.
- Until then, return **both** `endpointDeltaMs` and `lapTimeDeltaMs` in the
  result, and document the difference in one place. Report builders need the
  curve and the headline to agree, or to know precisely why they don't.

**Payoff.** The flagship "where am I losing" curve becomes self-consistent with
the scoreboard. No footnotes, no second-guessing which number is real.

---

## 4. Viz-ready geometry: projection and a pre-colored comparison line

**What happened.** To draw the track map I hand-rolled an equirectangular
projection (`lng * cos(lat0)`, fit to a viewBox) and then computed the local
slope of the delta-t curve per segment to color the racing line red (losing) or
green (gaining). Every report builder targeting a map will rewrite this exact
math.

**Proposal.**
- `projectToLocalXY(samples)` returning stable, north-up **metre-based XY**
  coordinates suitable for any renderer (SVG, canvas, Leaflet overlay).
- A comparison helper (or a `lapvisor-lap-compare/v2` field) that returns the
  candidate path already annotated with **per-point delta and local loss-rate**,
  so the consumer can color segments directly without touching the delta curve's
  derivative.

**Payoff.** A map view drops from "project, align, differentiate, color" to
"draw the path, read the color". This is the biggest single lever for getting
more people building visual reports.

---

## 5. Lap classification instead of magic time windows

**What happened.** To pick clean flying laps I filtered
`durationMs > 40000 && durationMs < 60000`. That window is hardcoded to this
track and silently drops the out-lap, the in-lap, and any incident lap (one
driver had a spin at 75.9 s). It is fragile and it does not travel to another
venue.

**Proposal.** Tag each detected lap with a classification:
`outLap | inLap | flyer | incident | outlier`, where the outlier test is
**relative to the session median** (for example, slower than median by more than
some multiple). Expose it on the lap detection result.

**Payoff.** Report code asks for "flyers" and gets the right laps on any track,
at any temperature, for any driver, without a per-report magic constant.

---

## 6. Progression aggregation across sessions

**What happened.** The user's actual question was "where did I improve when I set
a new personal best?". Answering it meant finding the PB and the *previous* PB.
To do that I scanned roughly sixteen of one driver's VBO files plus the rival's
files, ran `detectLaps` on each, took the minimum valid lap per file, and
reasoned about dates by hand to order them. That is a lot of glue for a question
the library is perfectly positioned to answer.

**Proposal.** `buildProgressionReport(sessions[])` returning:
- best valid lap per session,
- the personal-best timeline (when each new best was set, and by how much),
- rolling improvement, and the all-time best with the session that set it.

**Payoff.** "Personal best over time" and "where did I improve" become a single
call instead of a bespoke scan. This is a headline report type, not a niche one.

---

## 7. A stitched ideal-lap telemetry trace

**What happened.** `bestMiniSectorsAcrossSession` gave me the ideal total
(42.975 s) and the source lap for each mini-sector, which made a great bar and a
great one-liner. But it returns no continuous sample path, so I could not draw
the ideal lap as a **ghost speed trace** or a ghost racing line next to the real
PB. The ideal lap stayed an abstract number rather than a visible target.

**Proposal.** Emit a stitched `RichSample[]` for the ideal lap: concatenate the
samples of each winning mini-sector and re-time them into one continuous trace
(with a clear note that it is synthetic and may have small seams at boundaries).

**Payoff.** "Here is the lap you have already proven you can drive" becomes a
line you can overlay on the speed chart and the map, not just a stat. It is the
most motivating artifact in a coaching report.

---

## 8. Synthetic G from GPS, and per-corner phase metrics

**What happened.** The rival's only telemetry is RaceChrono, whose VBO carried
`latG` and `longG` as zero. So any braking-load or cornering-load comparison
between the two drivers was impossible, even though both have full GPS speed and
heading. I also wanted to say "you brake too early into Turn 5" or "you carry
less apex speed", but those phase points are not first-class.

**Proposal.**
- Derive **longitudinal G** from `dv/dt` and **lateral G** from `v^2 * curvature`
  (curvature from heading rate) when the accelerometer channel is absent, flagged
  `synthetic: true` so consumers know the provenance.
- Add **per-corner phase metrics**: brake-point distance, entry speed, apex
  (minimum) speed, exit speed, and time spent in each phase. Optionally a
  friction-circle / G-G envelope aggregate.

**Payoff.** Cross-device driver comparisons work even when one source has no
accelerometer, and the report can make specific, coachable claims ("brake 8 m
later, you are already slower at the apex") instead of only showing a speed gap.

---

## 9. Session speed envelope for consistency

**What happened.** For lap-time consistency I used the coefficient of variation
of lap times, which is fine. But at the telemetry level there is no primitive for
"where on track are you inconsistent". A min/median/max speed band across all
laps of a session would answer that directly.

**Proposal.** `resampleSession(session, { count })` returning a laps-by-grid
matrix on a common distance axis, plus a per-mini-sector consistency metric, so a
report can draw a speed envelope (band between fastest and slowest lap) and
highlight the zones with the widest spread.

**Payoff.** A whole new report type ("your speed is repeatable here, scattered
there"), which is often more actionable for an improving driver than chasing the
single fastest lap.

---

## 10. A report cookbook and a thin facade

**What happened.** I rebuilt pipelines that partly already exist:
`buildLapComparisonBundle` and `buildSessionImprovementBundle` were sitting right
there, and I hand-wired `detectLaps` to `extractLap` to `compareLaps` to
`buildMiniSectors` instead. The primitives are excellent; the path from "I have
three VBO files" to "comparison-ready data for a report" is just not signposted.

**Proposal.**
- A short **report cookbook** under `examples/`: load N sessions, find the PB and
  prior PB, compare two laps, build mini-sectors and the ideal lap, project for a
  map. One runnable file that becomes the canonical starting point.
- Optionally a thin facade (`analyzeForReport(sessions, { track })`) that returns
  a single object with laps, classifications, PB, pairwise deltas, mini-sectors,
  and projected lines, so a report can start from one call and drill down only
  when it needs to.

**Payoff.** The distance from "I have files" to "I have a chart" drops by an
order of magnitude, which is the difference between one report getting built and
ten getting built.

---

## Where to start

If these get picked up, the highest leverage for report builders, roughly in
order: **3** (delta reconciliation) and **1** (corner detection) are small fixes
that remove active confusion; **4** (viz-ready geometry) and **5** (lap
classification) remove the most copy-pasted glue; **2** (track geometry) and
**6** (progression) unlock whole report types. The rest are strong follow-ons
once those land.
