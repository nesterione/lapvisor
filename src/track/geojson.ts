/**
 * `kart-track/v1` GeoJSON builder. Computes gate endpoints from
 * `(center, bearing, width)` using Haversine destination on a sphere
 * (R = 6 371 008.8 m), accurate to <0.1 m at the 5–10 m gate-half-width
 * scale. Coordinates are rounded to 7 decimal places (≈ 11 mm at the
 * equator) so files diff cleanly across re-runs.
 *
 * Spec: docs/formats/kart-track-v1.md
 */

import type { KartTrackIntent } from "./intent.js";
import type { KartTrack, KartTrackFeature, LonLat } from "./types.js";

const EARTH_RADIUS_M = 6_371_008.8;

const deg2rad = (d: number) => (d * Math.PI) / 180;
const rad2deg = (r: number) => (r * 180) / Math.PI;

function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

/**
 * Haversine "destination" formula: from `start`, travel `distance_m` along
 * `bearingDeg` on a sphere and return the resulting [lon, lat]. Output is
 * rounded to 7dp for stable diffs.
 */
export function destination(
  start: LonLat,
  bearingDeg: number,
  distance_m: number,
): LonLat {
  const [lon, lat] = start;
  const δ = distance_m / EARTH_RADIUS_M;
  const θ = deg2rad(bearingDeg);
  const φ1 = deg2rad(lat);
  const λ1 = deg2rad(lon);

  const sinφ2 =
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  return [round(rad2deg(λ2), 7), round(rad2deg(φ2), 7)];
}

/**
 * Endpoints of a trap gate: perpendicular to the crossing bearing,
 * `width_m / 2` either side. Order is (left of bearing, right of bearing).
 */
export function gateEndpoints(
  center: LonLat,
  bearingDeg: number,
  width_m: number,
): [LonLat, LonLat] {
  const half = width_m / 2;
  const left = destination(center, (bearingDeg + 270) % 360, half);
  const right = destination(center, (bearingDeg + 90) % 360, half);
  return [left, right];
}

/**
 * Re-derive a feature's geometry from its center/bearing/width. Returns a new
 * feature object — does not mutate the input. Used by the editor on save as
 * defence in depth: even if the client posts stale geometry, the file on disk
 * matches its properties.
 */
export function recomputeEndpoints(
  feature: KartTrackFeature,
): KartTrackFeature {
  const { center, bearing_deg, width_m } = feature.properties;
  const [left, right] = gateEndpoints(center, bearing_deg, width_m);
  return {
    ...feature,
    geometry: { type: "LineString", coordinates: [left, right] },
  };
}

function deriveCenter(intent: KartTrackIntent): LonLat {
  if (intent.center)
    return [round(intent.center[0], 7), round(intent.center[1], 7)];
  const n = intent.features.length;
  let lonSum = 0;
  let latSum = 0;
  for (const f of intent.features) {
    lonSum += f.center[0];
    latSum += f.center[1];
  }
  return [round(lonSum / n, 7), round(latSum / n, 7)];
}

/**
 * Build a complete `kart-track/v1` FeatureCollection from an intent. The
 * caller supplies (center, bearing, width) per gate; this function computes
 * LineString endpoints and assembles the FeatureCollection envelope.
 */
export function buildKartTrack(intent: KartTrackIntent): KartTrack {
  const features: KartTrackFeature[] = intent.features.map((f) => {
    const center: LonLat = [round(f.center[0], 7), round(f.center[1], 7)];
    const bearing_deg = round(f.bearing_deg, 3);
    const width_m = round(f.width_m, 3);
    const [left, right] = gateEndpoints(center, bearing_deg, width_m);

    const properties: KartTrackFeature["properties"] = {
      id: f.id,
      kind: f.kind,
      name: f.name,
      order: f.order,
      bearing_deg,
      width_m,
      unidirectional: f.unidirectional,
      center,
    };
    if (f.raw_type !== undefined) properties.raw_type = f.raw_type;

    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [left, right] },
      properties,
    };
  });

  return {
    type: "FeatureCollection",
    name: intent.name,
    properties: {
      schema: "kart-track/v1",
      ...(intent.source ? { source: intent.source } : {}),
      center: deriveCenter(intent),
    },
    features,
  };
}
