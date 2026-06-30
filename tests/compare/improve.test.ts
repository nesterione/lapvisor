import { describe, expect, test } from "bun:test";
import type { RichSample } from "../../src/analysis/lap-detail.js";
import { buildImprovementReport } from "../../src/compare/improve.js";

const M_PER_DEG_LAT = 111_320;

function syntheticLap(
  waypoints: Array<{ d: number; vKmh: number }>,
  resolutionM = 1,
): RichSample[] {
  const out: RichSample[] = [];
  let t = 0;
  let prev: { d: number; vKmh: number } | null = null;
  for (const wp of waypoints) {
    if (prev) {
      const segLen = wp.d - prev.d;
      const steps = Math.max(1, Math.ceil(segLen / resolutionM));
      for (let s = 1; s <= steps; s++) {
        const f = s / steps;
        const d = prev.d + segLen * f;
        const v = prev.vKmh + (wp.vKmh - prev.vKmh) * f;
        const prevSampleD = out[out.length - 1]?.d ?? 0;
        const prevSampleV = out[out.length - 1]?.v ?? prev.vKmh;
        const segDist = d - prevSampleD;
        const avgVMps = ((prevSampleV + v) / 2) * (1000 / 3600);
        if (avgVMps > 0) t += (segDist / avgVMps) * 1000;
        out.push({ t, d, v, lat: d / M_PER_DEG_LAT, lng: 0 });
      }
    } else {
      out.push({ t: 0, d: wp.d, v: wp.vKmh, lat: 0, lng: 0 });
    }
    prev = wp;
  }
  return out;
}

function lapDuration(samples: RichSample[]): number {
  return samples[samples.length - 1]?.t ?? 0;
}

describe("buildImprovementReport", () => {
  test("ranks corners by time-loss and credits the fastest-corner lap", () => {
    // Lap 1 — fast T1 (40 km/h apex), middling T2 (30 km/h). Best overall.
    const lap1 = syntheticLap([
      { d: 0, vKmh: 60 },
      { d: 100, vKmh: 60 },
      { d: 130, vKmh: 40 },
      { d: 200, vKmh: 60 },
      { d: 230, vKmh: 30 },
      { d: 300, vKmh: 60 },
    ]);
    // Lap 2 — very slow T1 (20 km/h), but fast T2 (40 km/h).
    // Slower overall (T1 penalty exceeds T2 gain), but quickest through T2.
    const lap2 = syntheticLap([
      { d: 0, vKmh: 60 },
      { d: 100, vKmh: 60 },
      { d: 130, vKmh: 20 },
      { d: 200, vKmh: 60 },
      { d: 230, vKmh: 40 },
      { d: 300, vKmh: 60 },
    ]);
    // Lap 3 — slow T1, mediocre T2. Strictly worse than lap 1.
    const lap3 = syntheticLap([
      { d: 0, vKmh: 60 },
      { d: 100, vKmh: 60 },
      { d: 130, vKmh: 25 },
      { d: 200, vKmh: 60 },
      { d: 230, vKmh: 35 },
      { d: 300, vKmh: 60 },
    ]);

    const report = buildImprovementReport([
      { lapIndex: 1, durationMs: lapDuration(lap1), samples: lap1 },
      { lapIndex: 2, durationMs: lapDuration(lap2), samples: lap2 },
      { lapIndex: 3, durationMs: lapDuration(lap3), samples: lap3 },
    ]);
    expect(report).not.toBeNull();
    expect(report!.bestLapIndex).toBe(1);
    expect(report!.topOpportunities.length).toBeGreaterThan(0);
    const top = report!.topOpportunities[0]!;
    // Biggest opportunity for lap 1: T2 (its mediocre apex vs lap 2's quick apex).
    expect(top.cornerIndex).toBe(2);
    expect(top.fastestLapIndex).toBe(2);
    expect(top.deltaMs).toBeGreaterThan(0);
    expect(top.fastestApexKmh).toBeGreaterThan(top.bestApexKmh);
    expect(top.observations.length).toBeGreaterThan(0);
  });

  test("returns empty opportunities when only one lap is provided", () => {
    const lap = syntheticLap([
      { d: 0, vKmh: 60 },
      { d: 100, vKmh: 60 },
      { d: 130, vKmh: 35 },
      { d: 200, vKmh: 60 },
    ]);
    const report = buildImprovementReport([
      { lapIndex: 1, durationMs: lapDuration(lap), samples: lap },
    ]);
    expect(report).not.toBeNull();
    expect(report!.topOpportunities).toEqual([]);
  });

  test("returns null on empty input", () => {
    expect(buildImprovementReport([])).toBeNull();
  });
});
