import { readFile } from "node:fs/promises";
import type { VboGate } from "../adapters/vbo.js";
import type { KartTrack, KartTrackFeature } from "./types.js";

export class TrackLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackLoadError";
  }
}

function isKartTrack(value: unknown): value is KartTrack {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.type !== "FeatureCollection") return false;
  const props = v.properties as Record<string, unknown> | undefined;
  if (!props || props.schema !== "kart-track/v1") return false;
  if (!Array.isArray(v.features)) return false;
  return true;
}

export async function loadKartTrack(path: string): Promise<KartTrack> {
  const text = await readFile(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new TrackLoadError(`${path}: invalid JSON (${msg})`);
  }
  if (!isKartTrack(parsed)) {
    throw new TrackLoadError(`${path}: not a kart-track/v1 FeatureCollection`);
  }
  return parsed;
}

/**
 * Translate kart-track features into the VBO-flavoured gate shape consumed by
 * `detectLaps`. The endpoints are taken straight from the LineString geometry,
 * which the karting writer guarantees is in (left, right) order relative to
 * the bearing. `start_finish` becomes `start`; `sector` becomes `split`.
 */
export function trackGatesToVboGates(track: KartTrack): VboGate[] {
  return track.features.map(featureToVboGate);
}

function featureToVboGate(f: KartTrackFeature): VboGate {
  const [a, b] = f.geometry.coordinates;
  const kind: VboGate["kind"] =
    f.properties.kind === "start_finish"
      ? "start"
      : f.properties.kind === "sector"
        ? "split"
        : "other";
  return {
    label: f.properties.name || f.properties.id,
    kind,
    pointA: { latDeg: a[1], lngDeg: a[0] },
    pointB: { latDeg: b[1], lngDeg: b[0] },
  };
}
