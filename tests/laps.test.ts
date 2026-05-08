import { describe, expect, test } from "bun:test";
import type { VboGate, VboSample } from "../src/adapters/vbo.js";
import { detectLaps, NoStartGateError } from "../src/analysis/laps.js";

// Tests work in a 2D meter frame anchored at lat/lng = 0. At the equator, one
// degree of latitude and longitude are both ~111_320 m, and cos(0) = 1, so the
// projection used by detectLaps is exact: a sample at (xM, yM) here lands at
// the same (x, y) in the projector's local frame.
const M_PER_DEG = 111_320;

function makeSample(opts: {
  tMs: number;
  xM: number;
  yM: number;
  vKmh?: number;
  sats?: number;
}): VboSample {
  return {
    timeOfDayMs: opts.tMs,
    latDeg: opts.yM / M_PER_DEG,
    lngDeg: -opts.xM / M_PER_DEG, // parser flips lng sign on read; we mimic that here so the projector sees +xM east
    velocityKmh: opts.vKmh ?? 60,
    heading: 0,
    heightM: 0,
    sats: opts.sats ?? 8,
  };
}

function makeGate(opts: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind?: VboGate["kind"];
}): VboGate {
  return {
    label: "test",
    kind: opts.kind ?? "start",
    pointA: { latDeg: opts.y1 / M_PER_DEG, lngDeg: opts.x1 / M_PER_DEG },
    pointB: { latDeg: opts.y2 / M_PER_DEG, lngDeg: opts.x2 / M_PER_DEG },
  };
}

// Vertical gate at x=0, between y=-5 and y=+5.
const VERTICAL_GATE = makeGate({ x1: 0, y1: -5, x2: 0, y2: 5 });

describe("detectLaps", () => {
  test("throws when no Start gate is defined", () => {
    expect(() => detectLaps([], [makeGate({ x1: 0, y1: 0, x2: 1, y2: 0, kind: "split" })]))
      .toThrow(NoStartGateError);
  });

  test("single crossing → 1 crossing, 0 laps", () => {
    const samples = [
      makeSample({ tMs: 0, xM: -10, yM: 0 }),
      makeSample({ tMs: 1000, xM: 10, yM: 0 }),
    ];
    const result = detectLaps(samples, [VERTICAL_GATE]);
    expect(result.crossings).toHaveLength(1);
    expect(result.laps).toHaveLength(0);
  });

  test("two same-direction crossings → 1 lap with correct duration", () => {
    const samples = [
      makeSample({ tMs: 0, xM: -10, yM: 0 }),
      makeSample({ tMs: 1000, xM: 10, yM: 0 }),
      // simulate a loop returning to the start side without crossing in reverse
      makeSample({ tMs: 30_000, xM: -10, yM: 0 }), // teleport back via a long arc; no crossing modeled
      makeSample({ tMs: 60_000, xM: -10, yM: 0 }),
      makeSample({ tMs: 61_000, xM: 10, yM: 0 }),
    ];
    const result = detectLaps(samples, [VERTICAL_GATE]);
    // The "teleport back" segment also crosses the gate (in reverse) — direction lock rejects it.
    expect(result.crossings).toHaveLength(2);
    expect(result.laps).toHaveLength(1);
    // first crossing at tMs=500, second at tMs=60_500 → 60_000 ms duration
    expect(result.laps[0].durationMs).toBeCloseTo(60_000, 0);
    expect(result.laps[0].startTimeOfDayMs).toBeCloseTo(500, 0);
  });

  test("reverse crossing is rejected by direction lock", () => {
    const samples = [
      makeSample({ tMs: 0, xM: -10, yM: 0 }),
      makeSample({ tMs: 1000, xM: 10, yM: 0 }), // forward
      makeSample({ tMs: 10_000, xM: 10, yM: 0 }),
      makeSample({ tMs: 11_000, xM: -10, yM: 0 }), // reverse
    ];
    const result = detectLaps(samples, [VERTICAL_GATE]);
    expect(result.crossings).toHaveLength(1);
    expect(result.rejected.some((r) => r.reason === "wrong-direction")).toBe(true);
  });

  test("stationary cluster is rejected by velocity filter", () => {
    const samples = [
      makeSample({ tMs: 0, xM: -1, yM: 0, vKmh: 1 }),
      makeSample({ tMs: 1000, xM: 1, yM: 0, vKmh: 1 }),
    ];
    const result = detectLaps(samples, [VERTICAL_GATE]);
    expect(result.crossings).toHaveLength(0);
  });

  test("pre-fix samples (sats=0) are silently skipped", () => {
    const samples = [
      makeSample({ tMs: 0, xM: -10, yM: 0, sats: 0 }),
      makeSample({ tMs: 1000, xM: 10, yM: 0, sats: 0 }),
    ];
    const result = detectLaps(samples, [VERTICAL_GATE]);
    expect(result.crossings).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });

  test("sub-sample timestamp interpolation is linear in t", () => {
    // Path crosses the gate at exactly the midpoint between the two samples.
    const samples = [
      makeSample({ tMs: 1000, xM: -10, yM: 0 }),
      makeSample({ tMs: 1040, xM: 10, yM: 0 }),
    ];
    const result = detectLaps(samples, [VERTICAL_GATE]);
    expect(result.crossings[0].timeOfDayMs).toBeCloseTo(1020, 0);
  });

  test("path crossing AB's extension off the gate end is rejected", () => {
    // Crosses the line x=0 but at y=100, far above the gate's [-5, +5] span.
    const samples = [
      makeSample({ tMs: 0, xM: -10, yM: 100 }),
      makeSample({ tMs: 1000, xM: 10, yM: 100 }),
    ];
    const result = detectLaps(samples, [VERTICAL_GATE]);
    expect(result.crossings).toHaveLength(0);
    expect(result.rejected.some((r) => r.reason === "off-gate-end")).toBe(true);
  });

  test("close-together crossings are debounced by minLapMs", () => {
    const samples = [
      makeSample({ tMs: 0, xM: -10, yM: 0 }),
      makeSample({ tMs: 1000, xM: 10, yM: 0 }),
      makeSample({ tMs: 2000, xM: -10, yM: 0 }), // would cross again — but reverse, rejected by direction
      makeSample({ tMs: 3000, xM: 10, yM: 0 }), // forward again, but only 2 s after first crossing
    ];
    const result = detectLaps(samples, [VERTICAL_GATE], { minLapMs: 5_000 });
    // First crossing accepted, third (forward) rejected by min-lap filter.
    expect(result.crossings).toHaveLength(1);
    expect(result.rejected.some((r) => r.reason === "too-soon-after-previous")).toBe(true);
  });

  test("lap range covers samples between crossings", () => {
    const samples = [
      makeSample({ tMs: 0, xM: -10, yM: 0 }), // 0
      makeSample({ tMs: 1000, xM: 10, yM: 0 }), // 1 — first crossing
      makeSample({ tMs: 30_000, xM: 5, yM: 5 }), // 2
      makeSample({ tMs: 60_000, xM: -10, yM: 0 }), // 3
      makeSample({ tMs: 61_000, xM: 10, yM: 0 }), // 4 — second crossing (forward)
    ];
    const result = detectLaps(samples, [VERTICAL_GATE]);
    expect(result.laps).toHaveLength(1);
    expect(result.laps[0].firstSampleIndex).toBe(1);
    expect(result.laps[0].lastSampleIndex).toBe(3);
  });

  test("absolute timestampMs is interpolated when samples carry it", () => {
    const dayMs = Date.UTC(2026, 4, 5);
    const mk = (opts: Parameters<typeof makeSample>[0]) => {
      const s = makeSample(opts);
      s.timestampMs = dayMs + opts.tMs;
      return s;
    };
    const samples = [
      mk({ tMs: 1000, xM: -10, yM: 0 }),
      mk({ tMs: 1040, xM: 10, yM: 0 }),
    ];
    const result = detectLaps(samples, [VERTICAL_GATE]);
    expect(result.crossings[0].timestampMs).toBeCloseTo(dayMs + 1020, 0);
  });
});
