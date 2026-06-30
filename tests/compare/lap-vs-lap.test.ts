import { describe, expect, test } from "bun:test";
import type { RichSample } from "../../src/analysis/lap-detail.js";
import { compareLaps } from "../../src/compare/lap-vs-lap.js";

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

describe("compareLaps", () => {
  test("self-comparison gives near-zero deltas everywhere", () => {
    const lap = constantSpeedLap(60, 100, 51);
    const r = compareLaps(lap, lap, { miniSectorCount: 10, deltaTCount: 21 });
    expect(Math.abs(r.totalDeltaMs)).toBeLessThanOrEqual(20);
    for (const m of r.miniSectors) {
      expect(Math.abs(m.deltaMs)).toBeLessThan(5);
    }
    for (const dt of r.deltaT.deltaTMs) {
      expect(Math.abs(dt)).toBeLessThan(1);
    }
  });

  test("slower candidate -> all positive mini-sector deltas, monotonic delta-t", () => {
    const ref = constantSpeedLap(60, 100, 51);
    const cand = constantSpeedLap(50, 100, 51);
    const r = compareLaps(ref, cand, { miniSectorCount: 10, deltaTCount: 21 });

    // Every bin should report candidate behind by ~constant amount.
    for (const m of r.miniSectors) {
      expect(m.deltaMs).toBeGreaterThan(0);
    }
    expect(r.totalDeltaMs).toBeGreaterThan(0);
    // Delta-t monotonically increasing.
    for (let i = 1; i < r.deltaT.deltaTMs.length; i++) {
      const prev = r.deltaT.deltaTMs[i - 1] ?? 0;
      const cur = r.deltaT.deltaTMs[i] ?? 0;
      expect(cur - prev).toBeGreaterThan(-1e-6);
    }
  });

  test("sum of mini-sector deltas approximates delta-t end value", () => {
    const ref = constantSpeedLap(60, 200, 101);
    const cand = constantSpeedLap(55, 200, 101);
    const r = compareLaps(ref, cand, { miniSectorCount: 20, deltaTCount: 41 });
    const summed = r.miniSectors.reduce((a, m) => a + m.deltaMs, 0);
    // Both methods derive from the same source samples; agreement within a few ms.
    expect(Math.abs(summed - r.deltaT.totalMs)).toBeLessThan(50);
  });
});
