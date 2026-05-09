/**
 * Per-sample cumulative distance along the GPS trace.
 *
 * Used to express telemetry on a distance-along-track axis so two laps of
 * different durations can be overlaid on a common x-axis. Distances are
 * Haversine great-circle metres between consecutive (lat, lng) pairs,
 * summed from the first sample.
 *
 * For karting-scale steps (~1–3 m at 10–25 Hz) Haversine and the local
 * equirectangular projection used elsewhere in the codebase agree to
 * sub-mm. We use Haversine here for simplicity (no anchor needed) and
 * because it's robust at any latitude.
 */

import type { VboSample } from "../adapters/vbo.js";

const EARTH_RADIUS_M = 6_371_008.8; // IUGG mean Earth radius

export function cumulativeDistance(samples: VboSample[]): number[] {
  const out = new Array<number>(samples.length);
  if (samples.length === 0) return out;
  out[0] = 0;
  let acc = 0;
  for (let i = 1; i < samples.length; i++) {
    acc += haversineMeters(samples[i - 1], samples[i]);
    out[i] = acc;
  }
  return out;
}

function haversineMeters(a: VboSample, b: VboSample): number {
  const lat1 = (a.latDeg * Math.PI) / 180;
  const lat2 = (b.latDeg * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.lngDeg - a.lngDeg) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
