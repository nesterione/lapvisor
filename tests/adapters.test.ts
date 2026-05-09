import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import {
  loadSession,
  loadSessionFromText,
  UnsupportedFormatError,
} from "../src/adapters/index.js";

const fixturePath = fileURLToPath(
  new URL("./fixtures/sample.vbo", import.meta.url),
);

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
    await expect(loadSession("foo.xyz")).rejects.toThrow(
      UnsupportedFormatError,
    );
  });
});

describe("loadSessionFromText", () => {
  test("parses VBO text without touching the filesystem", async () => {
    const text = await readFile(fixturePath, "utf8");
    const session = loadSessionFromText(text, "vbo", { source: "memory.vbo" });
    expect(session.format).toBe("vbo");
    expect(session.source).toBe("memory.vbo");
    expect(session.meta?.venue).toBe("TestTrack");
  });

  test("defaults source to <input> when none is provided", async () => {
    const text = await readFile(fixturePath, "utf8");
    const session = loadSessionFromText(text, "vbo");
    expect(session.source).toBe("<input>");
  });

  test("throws UnsupportedFormatError for unsupported formats", () => {
    expect(() => loadSessionFromText("", "gpx")).toThrow(
      UnsupportedFormatError,
    );
  });
});
