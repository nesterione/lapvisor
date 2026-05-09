import { describe, expect, test } from "bun:test";
import type { VboSample } from "../src/adapters/vbo.js";
import { lapAggregates } from "../src/analysis/aggregates.js";
import { cumulativeDistance } from "../src/analysis/distance.js";
import { extractLap } from "../src/analysis/lap-detail.js";
import type { DetectedLap } from "../src/analysis/laps.js";

const M_PER_DEG_LAT = 111_320;

function sampleAt(opts: {
  tMs: number;
  northM?: number;
  eastM?: number;
  vKmh?: number;
  longG?: number;
  latG?: number;
  vertG?: number;
}): VboSample {
  return {
    timeOfDayMs: opts.tMs,
    latDeg: (opts.northM ?? 0) / M_PER_DEG_LAT,
    lngDeg: -(opts.eastM ?? 0) / M_PER_DEG_LAT, // parser flips lng sign on read
    velocityKmh: opts.vKmh ?? 50,
    heading: 0,
    heightM: 0,
    longAccG: opts.longG,
    latAccG: opts.latG,
    vertAccG: opts.vertG,
  };
}

describe("cumulativeDistance", () => {
  test("returns zeros for empty / single-sample inputs", () => {
    expect(cumulativeDistance([])).toEqual([]);
    expect(cumulativeDistance([sampleAt({ tMs: 0 })])).toEqual([0]);
  });

  test("returns the straight-line meters between equally spaced samples", () => {
    const samples = [
      sampleAt({ tMs: 0, northM: 0 }),
      sampleAt({ tMs: 100, northM: 100 }),
      sampleAt({ tMs: 200, northM: 200 }),
      sampleAt({ tMs: 300, northM: 300 }),
    ];
    const d = cumulativeDistance(samples);
    expect(d[0]).toBe(0);
    // Allow ±0.5 m for Haversine vs naive lat-deg conversion.
    expect(Math.abs(d[1]! - 100)).toBeLessThan(0.5);
    expect(Math.abs(d[2]! - 200)).toBeLessThan(0.5);
    expect(Math.abs(d[3]! - 300)).toBeLessThan(0.5);
  });

  test("is monotonically non-decreasing", () => {
    const samples = [
      sampleAt({ tMs: 0, northM: 0, eastM: 0 }),
      sampleAt({ tMs: 100, northM: 50, eastM: 30 }),
      sampleAt({ tMs: 200, northM: 80, eastM: 80 }),
      sampleAt({ tMs: 300, northM: 80, eastM: 80 }), // stationary
    ];
    const d = cumulativeDistance(samples);
    for (let i = 1; i < d.length; i++) {
      expect(d[i]! >= d[i - 1]!).toBe(true);
    }
  });
});

describe("lapAggregates", () => {
  test("scans top/min speed and peak G channels", () => {
    const samples = [
      sampleAt({ tMs: 0, vKmh: 30, longG: -0.8, latG: 0.5 }),
      sampleAt({ tMs: 100, vKmh: 60, longG: 0.4, latG: -1.2 }),
      sampleAt({ tMs: 200, vKmh: 45, longG: -1.5, latG: 0.9 }),
    ];
    const a = lapAggregates(samples);
    expect(a.topSpeedKmh).toBe(60);
    expect(a.minSpeedKmh).toBe(30);
    expect(a.peakLatG).toBeCloseTo(1.2, 3);
    expect(a.peakLongGBrake).toBeCloseTo(1.5, 3);
    expect(a.peakLongGAccel).toBeCloseTo(0.4, 3);
  });

  test("returns zero for missing channels (e.g. RaceChrono has no vertG)", () => {
    const samples = [
      sampleAt({ tMs: 0, vKmh: 50 }), // no longG/latG
    ];
    const a = lapAggregates(samples);
    expect(a.peakLatG).toBe(0);
    expect(a.peakLongGBrake).toBe(0);
    expect(a.peakLongGAccel).toBe(0);
  });
});

describe("extractLap", () => {
  test("re-bases time, attaches distance and sectors", () => {
    // 5 samples spanning t=1000..1400, ~100 m apart along a north line.
    const all: VboSample[] = [
      sampleAt({ tMs: 900, northM: -100 }),
      sampleAt({ tMs: 1000, northM: 0 }),
      sampleAt({ tMs: 1100, northM: 100 }),
      sampleAt({ tMs: 1200, northM: 200 }),
      sampleAt({ tMs: 1300, northM: 300 }),
      sampleAt({ tMs: 1400, northM: 400 }),
      sampleAt({ tMs: 1500, northM: 500 }),
    ];
    const lap: DetectedLap = {
      index: 1,
      startTimeOfDayMs: 1000,
      durationMs: 400,
      firstSampleIndex: 1,
      lastSampleIndex: 5,
    };

    const out = extractLap(all, lap, { lapIndex: 1, splits: [{ sectorIndex: 0, label: "S1", offsetMs: 200 }] });

    expect(out.lap.index).toBe(1);
    expect(out.lap.durationMs).toBe(400);
    expect(out.samples).toHaveLength(5);
    expect(out.samples[0]!.t).toBe(0); // t re-based to 0
    expect(out.samples[4]!.t).toBe(400);
    expect(out.samples[0]!.d).toBe(0);
    expect(Math.abs(out.samples[4]!.d - 400)).toBeLessThan(0.5);
    expect(Math.abs(out.lap.distanceM - 400)).toBeLessThan(0.5);

    // Sector at 200 ms should land at sample index 2 (t=200ms).
    expect(out.sectors).toHaveLength(1);
    expect(out.sectors[0]!.sampleIndex).toBe(2);
    expect(out.sectors[0]!.label).toBe("S1");
  });

  test("omits optional channels when absent in source", () => {
    const all = [sampleAt({ tMs: 0 }), sampleAt({ tMs: 100, northM: 10 })];
    const out = extractLap(
      all,
      { index: 1, startTimeOfDayMs: 0, durationMs: 100, firstSampleIndex: 0, lastSampleIndex: 1 },
      undefined,
    );
    expect(out.samples[0]!.longG).toBeUndefined();
    expect(out.samples[0]!.latG).toBeUndefined();
    expect(out.samples[0]!.vertG).toBeUndefined();
    expect(out.samples[0]!.gyroX).toBeUndefined();
  });
});
