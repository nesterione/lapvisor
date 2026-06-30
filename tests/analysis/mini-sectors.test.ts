import { describe, expect, test } from "bun:test";
import type { RichSample } from "../../src/analysis/lap-detail.js";
import {
  bestMiniSectorsAcrossSession,
  buildMiniSectors,
} from "../../src/analysis/mini-sectors.js";

const M_PER_DEG_LAT = 111_320;

function constantSpeedLap(
  vKmh: number,
  distanceM: number,
  sampleCount: number,
): RichSample[] {
  const out: RichSample[] = [];
  const step = distanceM / (sampleCount - 1);
  const vMps = (vKmh * 1000) / 3600;
  for (let i = 0; i < sampleCount; i++) {
    const d = i * step;
    const t = (d / vMps) * 1000;
    out.push({ t, lat: d / M_PER_DEG_LAT, lng: 0, v: vKmh, d });
  }
  return out;
}

describe("buildMiniSectors", () => {
  test("returns N bins with equal-distance boundaries", () => {
    const lap = constantSpeedLap(60, 100, 51);
    const bins = buildMiniSectors(lap, { count: 10 });
    expect(bins).toHaveLength(10);
    expect(bins[0]!.dStart).toBe(0);
    expect(bins[0]!.dEnd).toBe(10);
    expect(bins[9]!.dEnd).toBe(100);
    // Constant speed -> equal duration per bin.
    const expected = bins[0]!.durationMs;
    for (const b of bins) {
      expect(Math.abs(b.durationMs - expected)).toBeLessThanOrEqual(1);
    }
  });

  test("populates vMin/vMax per bin", () => {
    const samples: RichSample[] = [];
    // 0..100m, varying speed: 30 km/h at 0m, 90 km/h at 50m, 30 km/h at 100m.
    for (let i = 0; i < 51; i++) {
      const d = i * 2;
      const v = 30 + 60 * (1 - Math.abs(d - 50) / 50);
      // t doesn't matter for vMin/vMax check; use d / (avg speed).
      const t = (d / ((30 * 1000) / 3600)) * 1000;
      samples.push({ t, lat: 0, lng: 0, v, d });
    }
    const bins = buildMiniSectors(samples, { count: 5 });
    expect(bins).toHaveLength(5);
    // Middle bin (40-60m) should contain the 90 km/h peak.
    expect(bins[2]!.vMax).toBeGreaterThanOrEqual(89);
  });

  test("returns empty for degenerate input", () => {
    expect(buildMiniSectors([])).toEqual([]);
    expect(
      buildMiniSectors([{ t: 0, lat: 0, lng: 0, v: 50, d: 0 }]),
    ).toEqual([]);
  });
});

describe("bestMiniSectorsAcrossSession", () => {
  test("picks the per-bin minimum across laps", () => {
    const lap1 = [
      { index: 0, dStart: 0, dEnd: 10, durationMs: 600, vMin: 50, vMax: 60 },
      { index: 1, dStart: 10, dEnd: 20, durationMs: 700, vMin: 50, vMax: 60 },
      { index: 2, dStart: 20, dEnd: 30, durationMs: 800, vMin: 50, vMax: 60 },
    ];
    const lap2 = [
      { index: 0, dStart: 0, dEnd: 10, durationMs: 650, vMin: 50, vMax: 60 },
      { index: 1, dStart: 10, dEnd: 20, durationMs: 650, vMin: 50, vMax: 60 },
      { index: 2, dStart: 20, dEnd: 30, durationMs: 750, vMin: 50, vMax: 60 },
    ];
    const ideal = bestMiniSectorsAcrossSession([
      { lapIndex: 1, miniSectors: lap1 },
      { lapIndex: 2, miniSectors: lap2 },
    ]);
    expect(ideal).not.toBeNull();
    expect(ideal!.totalMs).toBe(600 + 650 + 750);
    expect(ideal!.miniSectors[0]!.sourceLapIndex).toBe(1);
    expect(ideal!.miniSectors[1]!.sourceLapIndex).toBe(2);
    expect(ideal!.miniSectors[2]!.sourceLapIndex).toBe(2);
  });

  test("returns null when bin counts disagree", () => {
    expect(
      bestMiniSectorsAcrossSession([
        { lapIndex: 1, miniSectors: [{ index: 0, dStart: 0, dEnd: 10, durationMs: 100, vMin: 0, vMax: 0 }] },
        { lapIndex: 2, miniSectors: [] },
      ]),
    ).toBeNull();
  });

  test("returns null on empty input", () => {
    expect(bestMiniSectorsAcrossSession([])).toBeNull();
  });
});
