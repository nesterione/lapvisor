# Lap detection

Detects laps from a time-ordered stream of GPS samples and a `[laptiming]` start gate. Pure function, no I/O.

Implementation: [`src/analysis/laps.ts`](../../src/analysis/laps.ts) — `detectLaps(samples, gates, opts?) → LapDetectionResult`.

## Geometry

The gate is a line segment `A → B`. For every consecutive sample pair `P → Q`:

1. **Project** `A`, `B`, `P`, `Q` to local meters with an equirectangular projection centred on the gate midpoint. At karting scale this is sub-mm accurate, and `cos(lat0)` is computed once.
2. **Solve segment-segment intersection** for parameters `t` (along `P→Q`) and `u` (along `A→B`):
   ```
   denom = (Q-P) × (B-A)
   t     = ((A-P) × (B-A)) / denom
   u     = ((A-P) × (Q-P)) / denom
   ```
   A crossing is valid iff `t ∈ [0, 1]` *and* `u ∈ [0, 1]` — the second condition is what stops the gate's *infinite extension* from triggering false crossings elsewhere on the track.
3. **Interpolate the timestamp** at `t`: `crossingMs = P.timeOfDayMs + t · (Q.timeOfDayMs − P.timeOfDayMs)`. Lap times are precise to ~10 ms instead of being quantised to the GPS sample period (40 ms at 25 Hz).
4. **Sign of `denom`** = direction of crossing. The first accepted crossing locks `expectedDirection`; later crossings with a different sign are rejected.

`N` accepted crossings → `N − 1` complete laps. Out-laps and in-laps are not returned.

## Filters

| Filter | Default | Behaviour |
|---|---|---|
| `requireFix` | `true` | Drop sample pairs where either has `sats === 0`. The pre-fix prefix is silent (not added to `rejected`). |
| `minSpeedKmh` | `5` | Drop pairs where both samples are below the threshold. |
| `minLapMs` | `5_000` | Reject crossings that occur within this much of the previous accepted one. Doubles as a gate-debounce and a min-lap-time. |
| Direction lock | (always on) | First accepted crossing fixes the expected direction; opposite-direction crossings are rejected. |

The result also returns `rejected: { sampleIndex, reason }[]` so callers (or AI agents) can audit why the lap count came out the way it did. Reasons: `off-gate-end`, `wrong-direction`, `too-soon-after-previous`, `parallel`.

## Known limitations

- **Direction lock fails** if the first valid crossing is a backwards paddock pass. Mitigation: drop the kart on the track before the start line, or pre-trim the file. A heading-based direction check would harden this — not implemented in v1.
- **Out lap / in lap** are not returned. The pre-first-crossing samples are warm-up and post-last-crossing samples are cool-down; analysing them needs different boundaries.
- **Single start gate.** If the file has multiple `Start` gates the first is used. Multi-gate sessions aren't a thing in normal VBOX usage.
- **Sub-millimetre projection accuracy** assumes the track fits in roughly a 10 km × 10 km box. Beyond that the equirectangular approximation starts to skew; not a concern for any motorsport venue.
