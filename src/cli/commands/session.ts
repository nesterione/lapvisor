/**
 * `lapvisor session` — emit a complete render bundle for a single session as
 * JSON: meta + GPS samples + laps + sector splits + gates. Designed to be
 * consumed by external UIs (the karting repo's `kart view`, agents building
 * dashboards, etc.). No HTML, no server, no browser.
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { defineCommand } from "citty";
import { parseVbo, type VboGate } from "../../adapters/vbo.js";
import { detectLaps } from "../../analysis/laps.js";
import { detectSectorSplits } from "../../analysis/sectors.js";
import { loadKartTrack, trackGatesToVboGates } from "../../track/loader.js";
import type { KartTrack } from "../../track/types.js";

interface SessionSample {
  lat: number;
  lng: number;
  /** velocity in km/h */
  v: number;
}

interface SessionLap {
  index: number;
  durationMs: number;
  firstSampleIndex: number;
  lastSampleIndex: number;
}

interface SessionSectorSplit {
  sectorIndex: number;
  label: string;
  offsetMs: number;
}

interface SessionLapSectorSplits {
  lapIndex: number;
  splits: SessionSectorSplit[];
}

interface SessionGate {
  kind: "start_finish" | "sector" | "unknown";
  name: string;
  /** [lon, lat] */
  pointA: [number, number];
  /** [lon, lat] */
  pointB: [number, number];
}

interface SessionBundle {
  schema: "lapvisor-session/v1";
  source: { file: string; format: "vbo" };
  meta: { trackName: string | null; venue?: string; startedAt?: string };
  samples: SessionSample[];
  laps: SessionLap[];
  sectorSplits: SessionLapSectorSplits[];
  gates: SessionGate[];
}

function round7(v: number): number {
  return Math.round(v * 1e7) / 1e7;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export default defineCommand({
  meta: {
    name: "session",
    description:
      "Emit a session render bundle (samples + laps + sectors + gates) as JSON.",
  },
  args: {
    input: {
      type: "positional",
      description: "Path to session file (.vbo)",
      required: true,
    },
    track: {
      type: "string",
      description:
        "Path to a kart-track/v1 GeoJSON file. When set, overrides any gates in the session file.",
    },
  },
  async run({ args }) {
    const ext = extname(args.input).toLowerCase();
    if (ext !== ".vbo") {
      throw new Error(
        `unsupported file format "${ext || "<no extension>"}" — session currently supports .vbo only`,
      );
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

    const sectorGates = detectionGates.filter((g) => g.kind === "split");
    const sectorSplits = detectSectorSplits(file.samples, sectorGates, laps);

    const samples: SessionSample[] = file.samples.map((s) => ({
      lat: round7(s.latDeg),
      lng: round7(s.lngDeg),
      v: round1(s.velocityKmh),
    }));

    const gates: SessionGate[] = kartTrack
      ? kartTrack.features.map((f) => ({
          kind: f.properties.kind,
          name: f.properties.name || f.properties.id,
          pointA: f.geometry.coordinates[0],
          pointB: f.geometry.coordinates[1],
        }))
      : detectionGates.map((g) => ({
          kind: g.kind === "start" ? "start_finish" : "sector",
          name: g.label || (g.kind === "start" ? "S/F" : "Sector"),
          pointA: [round7(g.pointA.lngDeg), round7(g.pointA.latDeg)],
          pointB: [round7(g.pointB.lngDeg), round7(g.pointB.latDeg)],
        }));

    const bundle: SessionBundle = {
      schema: "lapvisor-session/v1",
      source: { file: args.input, format: "vbo" },
      meta: {
        trackName: kartTrack?.name ?? null,
        venue: file.comments.Venue,
        startedAt: file.startedAt?.toISOString(),
      },
      samples,
      laps: laps.map((l) => ({
        index: l.index,
        durationMs: Math.round(l.durationMs),
        firstSampleIndex: l.firstSampleIndex,
        lastSampleIndex: l.lastSampleIndex,
      })),
      sectorSplits: sectorSplits.map((ls) => ({
        lapIndex: ls.lapIndex,
        splits: ls.splits.map((s) => ({
          sectorIndex: s.sectorIndex,
          label: s.label,
          offsetMs: Math.round(s.offsetMs),
        })),
      })),
      gates,
    };

    process.stdout.write(`${JSON.stringify(bundle)}\n`);
  },
});
