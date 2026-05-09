import { describe, expect, test } from "bun:test";
import type { LapDetail } from "../src/analysis/lap-detail.js";
import {
  buildSessionSummary,
  summarizeLap,
} from "../src/analysis/session-summary.js";

function makeLapDetail(opts: {
  index: number;
  durationMs: number;
  distanceM?: number;
  sectorOffsetsMs?: number[];
  sectorLabels?: string[];
}): LapDetail {
  const offsets = opts.sectorOffsetsMs ?? [];
  const labels = opts.sectorLabels ?? offsets.map((_, i) => `S${i + 1}`);
  return {
    lap: {
      index: opts.index,
      durationMs: opts.durationMs,
      distanceM: opts.distanceM ?? 800,
    },
    samples: [],
    sectors: offsets.map((offsetMs, i) => ({
      sectorIndex: i,
      label: labels[i] ?? `S${i + 1}`,
      sampleIndex: i,
      offsetMs,
      distanceM: (opts.distanceM ?? 800) * ((i + 1) / (offsets.length + 1)),
    })),
    aggregates: {
      topSpeedKmh: 70 + opts.index,
      minSpeedKmh: 25,
      peakLatG: 1,
      peakLongGBrake: 1,
      peakLongGAccel: 0.4,
    },
  };
}

describe("summarizeLap", () => {
  test("derives sector durations and appends final sector to finish", () => {
    const out = summarizeLap(
      makeLapDetail({
        index: 4,
        durationMs: 46_200,
        distanceM: 900,
        sectorOffsetsMs: [14_000, 29_500],
      }),
    );

    expect(out.index).toBe(4);
    expect(out.sectors).toHaveLength(3);
    expect(out.sectors[0]).toMatchObject({
      sectorIndex: 0,
      label: "S1",
      offsetMs: 14_000,
      durationMs: 14_000,
    });
    expect(out.sectors[1]).toMatchObject({
      sectorIndex: 1,
      label: "S2",
      offsetMs: 29_500,
      durationMs: 15_500,
    });
    expect(out.sectors[2]).toMatchObject({
      sectorIndex: 2,
      label: "Finish",
      offsetMs: 46_200,
      durationMs: 16_700,
      distanceM: 900,
    });
  });

  test("keeps sectors empty when no split gates exist", () => {
    const out = summarizeLap(
      makeLapDetail({
        index: 1,
        durationMs: 45_000,
      }),
    );
    expect(out.sectors).toEqual([]);
  });
});

describe("buildSessionSummary", () => {
  test("finds best lap, best sectors, and theoretical best", () => {
    const laps = [
      summarizeLap(
        makeLapDetail({
          index: 1,
          durationMs: 45_500,
          sectorOffsetsMs: [14_000, 29_500],
        }),
      ),
      summarizeLap(
        makeLapDetail({
          index: 2,
          durationMs: 45_200,
          sectorOffsetsMs: [13_800, 29_900],
        }),
      ),
    ];

    const summary = buildSessionSummary(laps);

    expect(summary.bestLapMs).toBe(45_200);
    expect(summary.bestLapIndex).toBe(2);
    expect(summary.sectorCount).toBe(3);
    expect(summary.bestSectors).toEqual([
      { sectorIndex: 0, label: "S1", durationMs: 13_800, lapIndex: 2 },
      { sectorIndex: 1, label: "S2", durationMs: 15_500, lapIndex: 1 },
      { sectorIndex: 2, label: "Finish", durationMs: 15_300, lapIndex: 2 },
    ]);
    expect(summary.theoreticalBestMs).toBe(44_600);
  });
});
