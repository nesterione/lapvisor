import { describe, expect, test } from "bun:test";
import type { VboFile, VboGate, VboSample } from "../../src/adapters/vbo.js";
import { buildSessionImprovementBundle } from "../../src/bundles/session-improvement-v1.js";

const M_PER_DEG = 111_320;

function sample(opts: {
  tMs: number;
  xM: number;
  yM: number;
  vKmh?: number;
}): VboSample {
  return {
    timeOfDayMs: opts.tMs,
    latDeg: opts.yM / M_PER_DEG,
    lngDeg: -opts.xM / M_PER_DEG,
    velocityKmh: opts.vKmh ?? 60,
    heading: 0,
    heightM: 0,
    sats: 8,
  };
}

function gate(opts: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind?: VboGate["kind"];
  label?: string;
}): VboGate {
  return {
    label: opts.label ?? "Start / Finish",
    kind: opts.kind ?? "start",
    pointA: { latDeg: opts.y1 / M_PER_DEG, lngDeg: opts.x1 / M_PER_DEG },
    pointB: { latDeg: opts.y2 / M_PER_DEG, lngDeg: opts.x2 / M_PER_DEG },
  };
}

function fakeVboFile(): VboFile {
  // Three laps crossing a gate at x=0, with the second lap quickest.
  // Each lap is two samples (gate cross + return), plus close-out.
  const samples: VboSample[] = [
    sample({ tMs: 0, xM: -1, yM: 0 }),
    sample({ tMs: 1000, xM: 1, yM: 0 }), // lap 1 start
    sample({ tMs: 30_000, xM: -1, yM: 0 }),
    sample({ tMs: 31_000, xM: 1, yM: 0 }), // lap 1 end (29s)
    // Lap 2 — slower at start, faster at end
    sample({ tMs: 55_000, xM: -1, yM: 0 }),
    sample({ tMs: 56_000, xM: 1, yM: 0 }), // lap 2 end (25s)
    // Lap 3 — fastest overall (24s)
    sample({ tMs: 79_000, xM: -1, yM: 0 }),
    sample({ tMs: 80_000, xM: 1, yM: 0 }), // lap 3 end
  ];
  return {
    source: "fake.vbo",
    comments: { Venue: "TestTrack" },
    channels: ["time", "lat", "lng"],
    channelLabels: [],
    gates: [gate({ x1: 0, y1: -5, x2: 0, y2: 5 })],
    samples,
  };
}

describe("buildSessionImprovementBundle", () => {
  test("emits lapvisor-session-improvement/v1 with best+ideal+gap", () => {
    const vboFile = fakeVboFile();
    const bundle = buildSessionImprovementBundle({
      source: { file: "fake.vbo", format: "vbo" },
      vboFile,
      miniSectorCount: 5,
    });

    expect(bundle.schema).toBe("lapvisor-session-improvement/v1");
    expect(bundle.source).toEqual({ file: "fake.vbo", format: "vbo" });
    expect(bundle.meta.trackName).toBeNull();
    expect(bundle.meta.venue).toBe("TestTrack");
    expect(bundle.lapCount).toBeGreaterThanOrEqual(2);
    expect(bundle.bestLap.index).toBeGreaterThan(0);
    expect(bundle.bestLap.durationMs).toBeGreaterThan(0);
    expect(bundle.idealLap.miniSectorCount).toBe(5);
    expect(bundle.idealLap.miniSectors).toHaveLength(5);
    // Ideal time is at most the best lap.
    expect(bundle.idealLap.totalMs).toBeLessThanOrEqual(
      bundle.bestLap.durationMs,
    );
    // Gap is non-negative.
    expect(bundle.gapToIdealMs).toBeGreaterThanOrEqual(0);
  });
});
