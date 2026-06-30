import { describe, expect, test } from "bun:test";
import type { VboFile, VboGate, VboSample } from "../../src/adapters/vbo.js";
import { buildLapComparisonBundle } from "../../src/bundles/lap-compare-v1.js";

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
}): VboGate {
  return {
    label: "Start / Finish",
    kind: "start",
    pointA: { latDeg: opts.y1 / M_PER_DEG, lngDeg: opts.x1 / M_PER_DEG },
    pointB: { latDeg: opts.y2 / M_PER_DEG, lngDeg: opts.x2 / M_PER_DEG },
  };
}

function fakeVboFile(): VboFile {
  // Three lap-end crossings at the gate -> 2 laps.
  const samples: VboSample[] = [
    sample({ tMs: 0, xM: -1, yM: 0 }),
    sample({ tMs: 1000, xM: 1, yM: 0 }),
    sample({ tMs: 30_000, xM: -1, yM: 0 }),
    sample({ tMs: 31_000, xM: 1, yM: 0 }),
    sample({ tMs: 60_000, xM: -1, yM: 0 }),
    sample({ tMs: 61_000, xM: 1, yM: 0 }),
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

describe("buildLapComparisonBundle", () => {
  test("emits lapvisor-lap-compare/v1 with delta-t and mini-sectors", () => {
    const vboFile = fakeVboFile();
    const bundle = buildLapComparisonBundle({
      source: { file: "fake.vbo", format: "vbo" },
      vboFile,
      refLapIndex: 1,
      candidateLapIndex: 2,
      miniSectorCount: 5,
      deltaTCount: 11,
    });

    expect(bundle.schema).toBe("lapvisor-lap-compare/v1");
    expect(bundle.reference.index).toBe(1);
    expect(bundle.candidate.index).toBe(2);
    expect(bundle.miniSectorCount).toBe(5);
    expect(bundle.miniSectors).toHaveLength(5);
    expect(bundle.deltaT.count).toBe(11);
    expect(bundle.deltaT.dGrid).toHaveLength(11);
    expect(bundle.deltaT.deltaTMs).toHaveLength(11);
    expect(bundle.deltaT.maxDistanceM).toBeGreaterThan(0);
    expect(typeof bundle.totalDeltaMs).toBe("number");
  });

  test("throws when a requested lap index is missing", () => {
    const vboFile = fakeVboFile();
    expect(() =>
      buildLapComparisonBundle({
        source: { file: "fake.vbo", format: "vbo" },
        vboFile,
        refLapIndex: 1,
        candidateLapIndex: 99,
      }),
    ).toThrow(/candidate lap 99 not found/);
  });
});
