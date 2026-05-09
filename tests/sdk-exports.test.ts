/**
 * Verifies that built SDK subpath bundles expose their public surface.
 * Skips when `dist/` isn't built — CI runs `bun run build && bun test`.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

const distPath = (rel: string) =>
  fileURLToPath(new URL(`../dist/sdk/${rel}`, import.meta.url));
const distBuilt = existsSync(distPath("bundles.js"));

describe.skipIf(!distBuilt)("SDK subpath exports", () => {
  test("lapvisor/adapters", async () => {
    const m = await import(distPath("adapters.js"));
    expect(typeof m.parseVbo).toBe("function");
    expect(typeof m.loadSession).toBe("function");
    expect(typeof m.loadSessionFromText).toBe("function");
    expect(typeof m.decodeVboCoord).toBe("function");
    expect(typeof m.decodeVboTime).toBe("function");
    expect(typeof m.UnsupportedFormatError).toBe("function");
    expect(typeof m.VboParseError).toBe("function");
  });

  test("lapvisor/analysis", async () => {
    const m = await import(distPath("analysis.js"));
    expect(typeof m.detectLaps).toBe("function");
    expect(typeof m.detectSectorSplits).toBe("function");
    expect(typeof m.lapAggregates).toBe("function");
    expect(typeof m.cumulativeDistance).toBe("function");
    expect(typeof m.extractLap).toBe("function");
    expect(typeof m.summarizeLap).toBe("function");
    expect(typeof m.buildSessionSummary).toBe("function");
    expect(typeof m.NoStartGateError).toBe("function");
  });

  test("lapvisor/bundles", async () => {
    const m = await import(distPath("bundles.js"));
    expect(typeof m.buildLapBundle).toBe("function");
    expect(typeof m.buildSessionBundle).toBe("function");
    expect(typeof m.buildLapsSummary).toBe("function");
  });

  test("lapvisor/track", async () => {
    const m = await import(distPath("track.js"));
    expect(typeof m.buildKartTrack).toBe("function");
    expect(typeof m.parseKartTrack).toBe("function");
    expect(typeof m.loadKartTrack).toBe("function");
    expect(typeof m.trackGatesToVboGates).toBe("function");
    expect(typeof m.destination).toBe("function");
    expect(typeof m.gateEndpoints).toBe("function");
    expect(typeof m.recomputeEndpoints).toBe("function");
    expect(typeof m.TrackLoadError).toBe("function");
    expect(m.kartTrackIntentSchema).toBeDefined();
  });

  test("lapvisor/time", async () => {
    const m = await import(distPath("time.js"));
    expect(typeof m.parseLapTimeMs).toBe("function");
    expect(typeof m.formatLapTime).toBe("function");
  });

  test("lapvisor/model has no runtime exports (types only)", async () => {
    const m = await import(distPath("model.js"));
    const runtime = Object.keys(m).filter((k) => k !== "default");
    expect(runtime).toEqual([]);
  });

  test("CLI bin still runs from dist/cli.js", async () => {
    const cliPath = fileURLToPath(
      new URL("../dist/cli.js", import.meta.url),
    );
    expect(existsSync(cliPath)).toBe(true);
  });
});
