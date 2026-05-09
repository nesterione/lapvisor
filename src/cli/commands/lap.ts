/**
 * `lapvisor lap` — emit a `lapvisor-lap/v1` JSON bundle for a single lap:
 * rich per-sample telemetry (lat/lng/speed/distance + acceleration + gyro
 * when present), sector boundaries as in-lap sample indices, and per-lap
 * aggregates. Designed for distance-aligned cross-driver comparison in
 * `kart compare`.
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import { parseVbo, type VboGate } from "../../adapters/vbo.js";
import { extractLap } from "../../analysis/lap-detail.js";
import { detectLaps } from "../../analysis/laps.js";
import { detectSectorSplits } from "../../analysis/sectors.js";
import { loadKartTrack, trackGatesToVboGates } from "../../track/loader.js";
import type { KartTrack } from "../../track/types.js";
import { formatLapTime } from "../../util/time.js";

interface SessionGate {
  kind: "start_finish" | "sector" | "unknown";
  name: string;
  /** [lon, lat] */
  pointA: [number, number];
  /** [lon, lat] */
  pointB: [number, number];
}

interface LapBundle {
  schema: "lapvisor-lap/v1";
  source: { file: string; format: "vbo" };
  meta: { trackName: string | null; venue?: string; startedAt?: string };
  lap: {
    index: number;
    durationMs: number;
    startTimestampMs?: number;
    distanceM: number;
  };
  samples: Array<{
    t: number;
    lat: number;
    lng: number;
    v: number;
    d: number;
    heading?: number;
    longG?: number;
    latG?: number;
    vertG?: number;
    gyroX?: number;
    gyroY?: number;
    gyroZ?: number;
  }>;
  sectors: Array<{
    sectorIndex: number;
    label: string;
    sampleIndex: number;
    offsetMs: number;
    distanceM: number;
  }>;
  aggregates: {
    topSpeedKmh: number;
    minSpeedKmh: number;
    peakLatG: number;
    peakLongGBrake: number;
    peakLongGAccel: number;
  };
  gates: SessionGate[];
}

function round7(v: number): number {
  return Math.round(v * 1e7) / 1e7;
}

function gatesFromTrack(track: KartTrack): SessionGate[] {
  return track.features.map((f) => ({
    kind: f.properties.kind,
    name: f.properties.name || f.properties.id,
    pointA: f.geometry.coordinates[0],
    pointB: f.geometry.coordinates[1],
  }));
}

function gatesFromVbo(gates: VboGate[]): SessionGate[] {
  return gates.map((g) => ({
    kind: g.kind === "start" ? "start_finish" : "sector",
    name: g.label || (g.kind === "start" ? "S/F" : "Sector"),
    pointA: [round7(g.pointA.lngDeg), round7(g.pointA.latDeg)],
    pointB: [round7(g.pointB.lngDeg), round7(g.pointB.latDeg)],
  }));
}

export default defineCommand({
  meta: {
    name: "lap",
    description:
      "Emit one lap as a `lapvisor-lap/v1` JSON bundle (rich telemetry + distance + sectors).",
  },
  args: {
    input: {
      type: "positional",
      description: "Path to session file (.vbo)",
      required: true,
    },
    index: {
      type: "positional",
      description: "1-based lap index",
      required: true,
    },
    track: {
      type: "string",
      description:
        "Path to a kart-track/v1 GeoJSON file. When set, overrides any gates in the session file.",
    },
    json: {
      type: "boolean",
      description: "Force JSON output even when stdout is a TTY",
    },
  },
  async run({ args }) {
    const ext = extname(args.input).toLowerCase();
    if (ext !== ".vbo") {
      throw new Error(
        `unsupported file format "${ext || "<no extension>"}" — lap currently supports .vbo only`,
      );
    }

    const lapIndex = Number(args.index);
    if (!Number.isInteger(lapIndex) || lapIndex < 1) {
      throw new Error(`lap index must be a positive integer, got "${args.index}"`);
    }

    const text = await readFile(args.input, "utf8");
    const file = parseVbo(text, args.input);

    let kartTrack: KartTrack | null = null;
    let detectionGates: VboGate[] = file.gates;
    if (args.track) {
      kartTrack = await loadKartTrack(args.track);
      detectionGates = trackGatesToVboGates(kartTrack);
    }

    const { laps } = detectLaps(file.samples, detectionGates);
    const lap = laps.find((l) => l.index === lapIndex);
    if (!lap) {
      throw new Error(
        `lap ${lapIndex} not found — file has ${laps.length} detected laps`,
      );
    }

    const sectorGates = detectionGates.filter((g) => g.kind === "split");
    const allSectorSplits = detectSectorSplits(file.samples, sectorGates, [lap]);
    const lapSectorSplits = allSectorSplits[0];

    const detail = extractLap(file.samples, lap, lapSectorSplits);

    const bundle: LapBundle = {
      schema: "lapvisor-lap/v1",
      source: { file: args.input, format: "vbo" },
      meta: {
        trackName: kartTrack?.name ?? null,
        venue: file.comments.Venue,
        startedAt: file.startedAt?.toISOString(),
      },
      lap: detail.lap,
      samples: detail.samples,
      sectors: detail.sectors,
      aggregates: detail.aggregates,
      gates: kartTrack ? gatesFromTrack(kartTrack) : gatesFromVbo(detectionGates),
    };

    const useJson = args.json || !process.stdout.isTTY;
    if (useJson) {
      process.stdout.write(`${JSON.stringify(bundle)}\n`);
      return;
    }

    console.log(pc.bold(`Lap ${bundle.lap.index} — ${formatLapTime(bundle.lap.durationMs)}`));
    if (bundle.meta.venue) console.log(`Venue:    ${bundle.meta.venue}`);
    if (bundle.meta.trackName) console.log(`Track:    ${bundle.meta.trackName}`);
    console.log(`Distance: ${bundle.lap.distanceM.toFixed(1)} m`);
    console.log(`Samples:  ${bundle.samples.length}`);
    console.log(`Sectors:  ${bundle.sectors.length}`);
    console.log(
      `Speed:    ${pc.green(`${bundle.aggregates.topSpeedKmh.toFixed(1)} km/h max`)}, ${bundle.aggregates.minSpeedKmh.toFixed(1)} km/h min`,
    );
    if (bundle.aggregates.peakLatG > 0) {
      console.log(
        `Peak G:   lat ${bundle.aggregates.peakLatG.toFixed(2)}, brake ${bundle.aggregates.peakLongGBrake.toFixed(2)}, accel ${bundle.aggregates.peakLongGAccel.toFixed(2)}`,
      );
    }
  },
});
