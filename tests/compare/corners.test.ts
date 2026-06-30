import { describe, expect, test } from "bun:test";
import { detectCorners } from "../../src/analysis/corners.js";
import type { RichSample } from "../../src/analysis/lap-detail.js";
import { compareCorners } from "../../src/compare/corners.js";

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

describe("compareCorners", () => {
  test("reports per-corner deltas vs reference apex speeds", () => {
    const ref = syntheticLap([
      { d: 0, vKmh: 60 },
      { d: 100, vKmh: 60 },
      { d: 130, vKmh: 30 },
      { d: 200, vKmh: 60 },
    ]);
    // Candidate carries 5 km/h more apex speed -> faster through.
    const cand = syntheticLap([
      { d: 0, vKmh: 60 },
      { d: 100, vKmh: 60 },
      { d: 130, vKmh: 35 },
      { d: 200, vKmh: 60 },
    ]);
    const corners = detectCorners(ref);
    expect(corners).toHaveLength(1);
    const cmp = compareCorners(corners, ref, cand);
    expect(cmp).toHaveLength(1);
    expect(cmp[0]!.refMinKmh).toBeLessThanOrEqual(31);
    expect(cmp[0]!.candMinKmh).toBeGreaterThan(cmp[0]!.refMinKmh);
    expect(cmp[0]!.deltaMinKmh).toBeGreaterThan(0);
    // More apex speed -> candidate is quicker through the corner -> negative deltaMs.
    expect(cmp[0]!.deltaMs).toBeLessThanOrEqual(0);
  });

  test("returns empty when either lap has no distance", () => {
    expect(compareCorners([], [], [])).toEqual([]);
  });
});
