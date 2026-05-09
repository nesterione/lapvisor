import type { VboFile, VboGate } from "../adapters/vbo.js";
import { extractLap } from "../analysis/lap-detail.js";
import { detectLaps, type LapDetectionOptions } from "../analysis/laps.js";
import { detectSectorSplits } from "../analysis/sectors.js";
import { trackGatesToVboGates } from "../track/loader.js";
import type { KartTrack } from "../track/types.js";
import { gatesFromTrack, gatesFromVbo } from "./gates.js";
import type { BundleSource, LapBundle } from "./types.js";

export interface BuildLapBundleInput {
  source: BundleSource;
  vboFile: VboFile;
  /** 1-based lap index. */
  lapIndex: number;
  /** Optional kart-track/v1 — when present, its gates override the VBO file's gates. */
  track?: KartTrack | null;
  detectionOptions?: LapDetectionOptions;
}

/**
 * Produce a `lapvisor-lap/v1` bundle for a single lap. Composes
 * `detectLaps` → `detectSectorSplits` → `extractLap` and assembles the wire
 * shape. The same bundle the CLI emits for `lapvisor lap <file> <index>`.
 *
 * @param input - Parsed VBO file, target lap index (1-based), optional track override.
 * @returns A frozen `LapBundle` matching the published `lapvisor-lap/v1` schema.
 * @throws Error when the requested lap index isn't found in the detected laps.
 * @see {@link ../../docs/formats/lapvisor-lap-v1.md | docs/formats/lapvisor-lap-v1.md}
 * @example
 * ```ts
 * import { parseVbo } from "lapvisor/adapters";
 * import { buildLapBundle } from "lapvisor/bundles";
 * const vboFile = parseVbo(text, "session.vbo");
 * const bundle = buildLapBundle({
 *   source: { file: "session.vbo", format: "vbo" },
 *   vboFile,
 *   lapIndex: 3,
 * });
 * ```
 */
export function buildLapBundle(input: BuildLapBundleInput): LapBundle {
  const { source, vboFile, lapIndex, track, detectionOptions } = input;

  const detectionGates: VboGate[] = track
    ? trackGatesToVboGates(track)
    : vboFile.gates;

  const { laps } = detectLaps(
    vboFile.samples,
    detectionGates,
    detectionOptions,
  );
  const lap = laps.find((l) => l.index === lapIndex);
  if (!lap) {
    throw new Error(
      `lap ${lapIndex} not found — file has ${laps.length} detected laps`,
    );
  }

  const sectorGates = detectionGates.filter((g) => g.kind === "split");
  const allSectorSplits = detectSectorSplits(vboFile.samples, sectorGates, [
    lap,
  ]);
  const lapSectorSplits = allSectorSplits[0];

  const detail = extractLap(vboFile.samples, lap, lapSectorSplits);

  return {
    schema: "lapvisor-lap/v1",
    source,
    meta: {
      trackName: track?.name ?? null,
      venue: vboFile.comments.Venue,
      startedAt: vboFile.startedAt?.toISOString(),
    },
    lap: detail.lap,
    samples: detail.samples,
    sectors: detail.sectors,
    aggregates: detail.aggregates,
    gates: track ? gatesFromTrack(track) : gatesFromVbo(detectionGates),
  };
}
