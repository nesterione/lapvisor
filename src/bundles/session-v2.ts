import type { VboFile, VboGate } from "../adapters/vbo.js";
import { extractLap } from "../analysis/lap-detail.js";
import { detectLaps, type LapDetectionOptions } from "../analysis/laps.js";
import { detectSectorSplits } from "../analysis/sectors.js";
import {
  buildSessionSummary,
  summarizeLap,
} from "../analysis/session-summary.js";
import { trackGatesToVboGates } from "../track/loader.js";
import type { KartTrack } from "../track/types.js";
import { round1, round7 } from "../util/rounding.js";
import { gatesFromTrack, gatesFromVbo } from "./gates.js";
import type {
  BundleSource,
  SessionBundle,
  SessionBundleSample,
} from "./types.js";

export interface BuildSessionBundleInput {
  source: BundleSource;
  vboFile: VboFile;
  /** Optional kart-track/v1 — when present, its gates override the VBO file's gates. */
  track?: KartTrack | null;
  detectionOptions?: LapDetectionOptions;
}

/**
 * Produce a `lapvisor-session/v2` bundle: GPS samples, detected laps, sector
 * splits, per-lap summaries, session summary, and gates. The same bundle the
 * CLI emits for `lapvisor session <file> [--track <track>]`.
 *
 * @param input - Parsed VBO file plus optional track override.
 * @returns A `SessionBundle` matching the published `lapvisor-session/v2` schema.
 * @see {@link ../../docs/formats/lapvisor-session-v2.md | docs/formats/lapvisor-session-v2.md}
 * @example
 * ```ts
 * import { parseVbo } from "lapvisor/adapters";
 * import { loadKartTrack } from "lapvisor/track";
 * import { buildSessionBundle } from "lapvisor/bundles";
 * const vboFile = parseVbo(text, "session.vbo");
 * const track = await loadKartTrack("track.json");
 * const bundle = buildSessionBundle({
 *   source: { file: "session.vbo", format: "vbo" },
 *   vboFile,
 *   track,
 * });
 * ```
 */
export function buildSessionBundle(
  input: BuildSessionBundleInput,
): SessionBundle {
  const { source, vboFile, track, detectionOptions } = input;

  const detectionGates: VboGate[] = track
    ? trackGatesToVboGates(track)
    : vboFile.gates;

  const { laps } = detectLaps(
    vboFile.samples,
    detectionGates,
    detectionOptions,
  );

  const sectorGates = detectionGates.filter((g) => g.kind === "split");
  const sectorSplits = detectSectorSplits(vboFile.samples, sectorGates, laps);

  const samples: SessionBundleSample[] = vboFile.samples.map((s) => ({
    lat: round7(s.latDeg),
    lng: round7(s.lngDeg),
    v: round1(s.velocityKmh),
  }));

  const lapSummaries = laps.map((lap) => {
    const detail = extractLap(
      vboFile.samples,
      lap,
      sectorSplits.find((entry) => entry.lapIndex === lap.index),
    );
    return summarizeLap(detail);
  });

  return {
    schema: "lapvisor-session/v2",
    source,
    meta: {
      trackName: track?.name ?? null,
      venue: vboFile.comments.Venue,
      startedAt: vboFile.startedAt?.toISOString(),
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
    lapSummaries,
    sessionSummary: buildSessionSummary(lapSummaries),
    gates: track ? gatesFromTrack(track) : gatesFromVbo(detectionGates),
  };
}
