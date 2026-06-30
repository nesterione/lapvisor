# Corner detection

`detectCorners` is a heuristic that turns a lap's speed trace into a list of
corners with `{ entry, apex, exit }` sample indices and distances. It does not
need any track-side metadata — no manual marking, no curvature integration —
which is what makes it usable on a fresh session before the user has done any
labelling.

## Heuristic

The lap's speed trace is treated as a sequence of local maxima and minima:

1. Walk the samples and record every local maximum of `v` (a sample whose
   speed is at least as high as both neighbours, with strict inequality on at
   least one side). The first and last samples are also treated as maxima so
   the first corner of the lap and the run-out at the chequered flag are
   both bracketed.
2. Between every pair of consecutive maxima, locate the minimum of `v`. That
   sample is a corner-apex candidate.
3. Accept the candidate as a corner when
   `max(vEntry, vExit) − vApex ≥ minDropKmh`. Default `minDropKmh = 15`.
   Smaller drops are treated as throttle-trail or kerb noise, not corners.

For each accepted corner the function records:

- **entry** = preceding speed maximum
- **apex** = speed minimum
- **exit** = following speed maximum
- **peakLatG** = max `|latG|` between entry and exit (when `latG` is present)
- **peakBrakingG** = most-negative `longG` between entry and apex (when `longG` is present)

## When it works well

- Karting tracks with clearly separated corners and short straights between.
- Sessions where the lap starts at speed (typical VBOX recording — the first
  data point is somewhere on the out-lap into the gate). The `[0, lastIndex]`
  artificial maxima keep the first and last corners well-bracketed.
- Tracks where every corner has at least a 15 km/h speed drop. Lower the
  threshold (`minDropKmh`) for faster, flowier circuits.

## When it under- or over-detects

- **Throttle lift through a flat-out kink** can fire a false positive if the
  driver lifts more than 15 km/h. Raise `minDropKmh` to suppress.
- **Combined corners taken in one apex** (e.g. a chicane driven with a single
  speed minimum) will count as one corner, not two. This is usually fine for
  time-loss attribution because it matches how the driver experiences it.
- **Out-lap / in-lap entries** sometimes look like a "corner" when the driver
  is rolling out of pit lane. The first and last detected corners on a session
  should be treated as suspect.

## Comparing corners between laps

The companion `compareCorners(refCorners, refSamples, candidateSamples)` maps
each reference-lap corner onto the candidate lap by *proportional distance* —
a corner whose entry sits at 30% of the reference lap's distance is matched to
the 30% point of the candidate lap's own distance. This handles small
lap-to-lap variations in driven distance without requiring a track-side
mapping.

For each corner, the comparison reports:

- `refMs`, `candMs`, `deltaMs` — time spent between entry and exit
- `refMinKmh`, `candMinKmh`, `deltaMinKmh` — apex-speed delta

A negative `deltaMs` plus a positive `deltaMinKmh` is the canonical "carrying
more apex speed and gaining time" signal coaches look for.
