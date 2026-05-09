import type { VboGate } from "../adapters/vbo.js";
import type { KartTrack } from "../track/types.js";
import { round7 } from "../util/rounding.js";
import type { SessionGate } from "./types.js";

export function gatesFromTrack(track: KartTrack): SessionGate[] {
  return track.features.map((f) => ({
    kind: f.properties.kind,
    name: f.properties.name || f.properties.id,
    pointA: f.geometry.coordinates[0],
    pointB: f.geometry.coordinates[1],
  }));
}

export function gatesFromVbo(gates: VboGate[]): SessionGate[] {
  return gates.map((g) => ({
    kind: g.kind === "start" ? "start_finish" : "sector",
    name: g.label || (g.kind === "start" ? "S/F" : "Sector"),
    pointA: [round7(g.pointA.lngDeg), round7(g.pointA.latDeg)],
    pointB: [round7(g.pointB.lngDeg), round7(g.pointB.latDeg)],
  }));
}
