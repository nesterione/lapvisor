import { describe, expect, test } from "bun:test";
import { detectCorners } from "../../src/analysis/corners.js";
import type { RichSample } from "../../src/analysis/lap-detail.js";

const M_PER_DEG_LAT = 111_320;

/**
 * Build a synthetic lap with prescribed (distance, speed) waypoints.
 * Time is derived from cumulative distance / instantaneous speed
 * (trapezoidal integration over each segment).
 */
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

describe("detectCorners", () => {
  test("identifies corners at speed minima with >=15 km/h drop", () => {
    // Three corners: 60→30, 70→25, 65→35.
    const samples = syntheticLap([
      { d: 0, vKmh: 60 },
      { d: 100, vKmh: 60 }, // straight
      { d: 130, vKmh: 30 }, // T1 apex
      { d: 200, vKmh: 70 }, // straight peak
      { d: 230, vKmh: 25 }, // T2 apex
      { d: 300, vKmh: 65 }, // straight peak
      { d: 330, vKmh: 35 }, // T3 apex
      { d: 400, vKmh: 60 }, // back on power
    ]);
    const corners = detectCorners(samples);
    expect(corners.length).toBe(3);
    expect(corners[0]!.vMinKmh).toBeLessThanOrEqual(31);
    expect(corners[1]!.vMinKmh).toBeLessThanOrEqual(26);
    expect(corners[2]!.vMinKmh).toBeLessThanOrEqual(36);
    // Distances should be in increasing order.
    expect(corners[0]!.dApex).toBeLessThan(corners[1]!.dApex);
    expect(corners[1]!.dApex).toBeLessThan(corners[2]!.dApex);
  });

  test("ignores noise smaller than the prominence threshold", () => {
    // A single dip of only 5 km/h should not register.
    const samples = syntheticLap([
      { d: 0, vKmh: 60 },
      { d: 100, vKmh: 60 },
      { d: 110, vKmh: 55 },
      { d: 120, vKmh: 60 },
      { d: 200, vKmh: 60 },
    ]);
    expect(detectCorners(samples)).toHaveLength(0);
  });

  test("returns empty for degenerate input", () => {
    expect(detectCorners([])).toEqual([]);
    expect(
      detectCorners([{ t: 0, lat: 0, lng: 0, v: 50, d: 0 }]),
    ).toEqual([]);
  });
});
