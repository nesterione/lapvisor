import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { loadSession, UnsupportedFormatError } from "../src/adapters/index.js";

const fixturePath = fileURLToPath(new URL("./fixtures/sample.vbo", import.meta.url));

describe("loadSession", () => {
  test("dispatches .vbo to the VBO adapter and produces a Session", async () => {
    const session = await loadSession(fixturePath);
    expect(session.format).toBe("vbo");
    expect(session.source).toBe(fixturePath);
    // Fixture has 3 samples, all on one side of the start gate — no crossings → no laps.
    expect(session.laps).toEqual([]);
    expect(session.meta).toMatchObject({
      venue: "TestTrack",
      sampleCount: 3,
      gateCount: 2,
    });
  });

  test("throws UnsupportedFormatError for unknown extensions", async () => {
    await expect(loadSession("foo.xyz")).rejects.toThrow(UnsupportedFormatError);
  });
});
