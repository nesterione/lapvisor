import { describe, expect, test } from "bun:test";
import type { RichSample } from "../../src/analysis/lap-detail.js";
import { computeDeltaT } from "../../src/compare/delta-t.js";

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
    out.push({
      t,
      lat: d / M_PER_DEG_LAT,
      lng: 0,
      v: vKmh,
      d,
    });
  }
  return out;
}

describe("computeDeltaT", () => {
  test("returns sub-millisecond noise when comparing a lap to itself", () => {
    const lap = constantSpeedLap(60, 100, 21);
    const r = computeDeltaT(lap, lap, { count: 21 });
    expect(r.dGrid).toHaveLength(21);
    expect(r.deltaTMs).toHaveLength(21);
    for (const dt of r.deltaTMs) {
      expect(Math.abs(dt)).toBeLessThan(1);
    }
    expect(r.coverage).toBe(1);
    expect(r.maxDistanceM).toBe(100);
  });

  test("faster candidate produces monotonically decreasing delta-t", () => {
    const ref = constantSpeedLap(50, 100, 21);
    const cand = constantSpeedLap(60, 100, 21);
    const r = computeDeltaT(ref, cand, { count: 21 });

    expect(Math.abs(r.deltaTMs[0]!)).toBeLessThan(1);
    expect(r.deltaTMs[r.deltaTMs.length - 1]!).toBeLessThan(0);
    for (let i = 1; i < r.deltaTMs.length; i++) {
      // Allow a tiny tolerance for floating-point noise.
      expect(r.deltaTMs[i]! - r.deltaTMs[i - 1]!).toBeLessThan(1e-6);
    }

    const refTotalMs = (100 / ((50 * 1000) / 3600)) * 1000;
    const candTotalMs = (100 / ((60 * 1000) / 3600)) * 1000;
    const expectedEnd = candTotalMs - refTotalMs;
    expect(Math.abs(r.totalMs - expectedEnd)).toBeLessThan(2);
  });

  test("truncates to the shared overlap when laps differ in length", () => {
    const ref = constantSpeedLap(60, 100, 21);
    const cand = constantSpeedLap(60, 80, 17);
    const r = computeDeltaT(ref, cand, { count: 21 });
    expect(r.maxDistanceM).toBe(80);
    expect(r.coverage).toBeCloseTo(0.8, 6);
    expect(r.dGrid[r.dGrid.length - 1]!).toBe(80);
  });

  test("returns empty result for degenerate laps", () => {
    expect(computeDeltaT([], constantSpeedLap(60, 100, 5))).toEqual({
      dGrid: [],
      deltaTMs: [],
      totalMs: 0,
      maxDistanceM: 0,
      coverage: 0,
    });
  });
});
