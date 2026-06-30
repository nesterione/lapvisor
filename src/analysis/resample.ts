/**
 * Distance-axis resampling: takes lap samples (with cumulative distance and
 * lap-start-relative time already attached, as produced by `extractLap`) and
 * re-emits them at evenly spaced distance steps via linear interpolation.
 *
 * This is the foundation for any analysis that overlays two laps on a common
 * x-axis — delta-t, mini-sectors, lap-vs-lap comparison.
 *
 * Pure.
 */

import type { RichSample } from "./lap-detail.js";

export interface ResampledSample {
  /** Distance from lap start in metres. Equal to the corresponding `dGrid` entry. */
  d: number;
  /** Time from lap start in milliseconds. Linearly interpolated. */
  t: number;
  /** Velocity in km/h. Linearly interpolated. */
  v: number;
  lat: number;
  lng: number;
  longG?: number;
  latG?: number;
}

export interface ResampleOptions {
  /** Number of evenly spaced distance points (>= 2). Default 200. */
  count?: number;
  /**
   * Upper bound for the grid in metres. Defaults to the last sample's
   * cumulative distance. Used by comparison code to truncate to the shared
   * overlap when two laps differ in length.
   */
  maxDistanceM?: number;
}

export interface ResampledLap {
  /** Distance grid in metres, length === `count`, evenly spaced from 0 to `maxDistanceM`. */
  dGrid: number[];
  /** One resampled sample per grid distance. */
  samples: ResampledSample[];
  /** Total distance covered by the source samples (last sample's `d`). */
  totalDistanceM: number;
}

/**
 * Resample lap samples onto an evenly spaced distance grid by linear
 * interpolation. Source samples must be ordered by non-decreasing `d`
 * (the shape produced by {@link "./lap-detail.js".extractLap}). Stationary
 * runs (consecutive identical `d`) are tolerated.
 *
 * Returns an empty grid when the lap has fewer than 2 samples or zero
 * distance.
 *
 * @param samples - Lap samples in source order.
 * @param opts - Grid resolution and optional max-distance truncation.
 */
export function resampleByDistance(
  samples: ReadonlyArray<RichSample>,
  opts: ResampleOptions = {},
): ResampledLap {
  const count = Math.max(2, Math.floor(opts.count ?? 200));
  const last = samples[samples.length - 1];
  if (samples.length < 2 || !last) {
    return {
      dGrid: [],
      samples: [],
      totalDistanceM: samples[0]?.d ?? 0,
    };
  }
  const lastD = last.d;
  const maxD = Math.max(0, Math.min(opts.maxDistanceM ?? lastD, lastD));
  if (maxD <= 0) {
    return { dGrid: [], samples: [], totalDistanceM: lastD };
  }

  const dGrid = new Array<number>(count);
  const out = new Array<ResampledSample>(count);
  const step = maxD / (count - 1);

  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const d = i === count - 1 ? maxD : i * step;
    dGrid[i] = d;
    while (cursor + 1 < samples.length) {
      const next = samples[cursor + 1];
      if (!next || next.d > d) break;
      cursor++;
    }
    const a = samples[cursor];
    const b = samples[cursor + 1];
    if (!a) {
      out[i] = projectAt(last, d);
      continue;
    }
    if (!b) {
      out[i] = projectAt(a, d);
      continue;
    }
    const span = b.d - a.d;
    const f = span <= 0 ? 0 : (d - a.d) / span;
    out[i] = interpolate(a, b, d, f);
  }
  return { dGrid, samples: out, totalDistanceM: lastD };
}

function interpolate(
  a: RichSample,
  b: RichSample,
  d: number,
  f: number,
): ResampledSample {
  const out: ResampledSample = {
    d,
    t: a.t + (b.t - a.t) * f,
    v: a.v + (b.v - a.v) * f,
    lat: a.lat + (b.lat - a.lat) * f,
    lng: a.lng + (b.lng - a.lng) * f,
  };
  if (a.longG !== undefined && b.longG !== undefined) {
    out.longG = a.longG + (b.longG - a.longG) * f;
  }
  if (a.latG !== undefined && b.latG !== undefined) {
    out.latG = a.latG + (b.latG - a.latG) * f;
  }
  return out;
}

function projectAt(s: RichSample, d: number): ResampledSample {
  const r: ResampledSample = { d, t: s.t, v: s.v, lat: s.lat, lng: s.lng };
  if (s.longG !== undefined) r.longG = s.longG;
  if (s.latG !== undefined) r.latG = s.latG;
  return r;
}
