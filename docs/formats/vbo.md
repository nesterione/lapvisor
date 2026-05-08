# VBO format

Racelogic VBOX text format (`.vbo`). Plain ASCII (or UTF-8), line-oriented, organized into bracketed sections. Used by Racelogic VBOX hardware and by RaceBox exports for interoperability with Circuit Tools / Track Studio.

Implementation: [`src/adapters/vbo.ts`](../../src/adapters/vbo.ts) — `parseVbo(text, source?) → VboFile`.

## Layout

```
File created on DD/MM/YYYY @ HH:MM     ← optional banner, ignored

[header]                               ← descriptive channel labels, one per line
latitude
longitude
…

[comments]                             ← free-form "Key : Value" lines
Serial Number : 3242708543
UTC Date Started : 05/05/2026 16:35
Venue : Plytines

[laptiming]                            ← start/finish + split gates (zero or more)
Start  +03283.51816 -001520.96398  +03283.51862 -001520.94724  ¬   Start / Finish

[column names]                         ← short tokens, position matches [data] columns
time lat lng velocity heading height LongAcc LatAcc VertAcc \
     x-rotation-gyroscope y-rotation-gyroscope z-rotation-gyroscope sats

[data]                                 ← samples, whitespace-separated
163508.00 +03283.51691 -001520.95871 052.171 312.25 +00145.77 -0.504 +0.116 +1.039 +5.880 +4.470 -7.130 0
…
```

Section order is conventional but not guaranteed — parse by `[section]` headers, not by line position. `[header]` and `[column names]` should describe the same channels in the same order; verify rather than assume.

## Channel encoding

| Column | Format | Notes |
|---|---|---|
| `time` | `HHMMSS.ss` UTC | No date in rows — combine with `UTC Date Started` from `[comments]`. Sample rate is implicit (typically 10/25 Hz); infer from successive deltas. |
| `lat` | signed decimal **minutes**, N positive | `+03283.51691` → 3283.51691′ → 54.7253° N |
| `lng` | signed decimal **minutes**, **W positive / E negative** (legacy VBOX convention) | `-001520.95871` → −1520.95871′ → 25.3493° **E**. The parser flips the sign so callers always see standard E-positive degrees. |
| `velocity` | km/h | from GPS Doppler |
| `heading` | degrees, 0–360, true north | |
| `height` | metres, WGS-84 ellipsoid | |
| `LongAcc / LatAcc / VertAcc` | g | IMU, body frame |
| `x/y/z-rotation-gyroscope` | deg/s | IMU, body frame |
| `sats` | integer | satellite count; `0` means no fix yet — drop or flag those rows |

Devices may emit additional channels (brake pressure, throttle, RPM, …). The parser routes anything it doesn't recognize into `sample.extra` so unknown columns don't get silently dropped.

## Lap gates

Each line in `[laptiming]` defines a gate as a 4-coordinate **line segment** between two GPS points:

```
<kind>   <latA> <lngA>   <latB> <lngB>   ¬   <label>
```

- `kind` is `Start` (start/finish) or `Split` (sector split).
- The `¬` (U+00AC) separates the optional human-readable label.
- Lap detection = segment-intersection between consecutive sample positions and the gate line. The file itself does **not** tag `[data]` rows with lap numbers — that's an analysis step.

## Gotchas

1. **Lat/lng aren't decimal degrees.** Convert with `deg = minutes / 60`, then flip longitude sign.
2. **No date in `[data]`.** It lives only in `[comments]` (`UTC Date Started`, day-first `DD/MM/YYYY`). Watch for midnight rollover on long sessions.
3. **`sats=0`** = pre-fix row. Velocity/position are unreliable; the parser keeps them so analysis can decide.
4. **Pre-section banner** ("File created on …") is ignored; treat anything before the first `[section]` as decoration.
5. **`[comments]`** is free text. RaceBox writes a fixed handful of keys; Racelogic devices write different ones. Don't rely on a fixed schema.
6. **Encoding.** Files are usually UTF-8 these days but may be Latin-1 on older devices — the only non-ASCII character that matters in practice is `¬`.
