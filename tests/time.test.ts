import { describe, expect, test } from "bun:test";
import { formatLapTime, parseLapTimeMs } from "../src/util/time.js";

describe("parseLapTimeMs", () => {
  test("plain seconds", () => {
    expect(parseLapTimeMs("43.605")).toBe(43605);
  });
  test("MM:SS.mmm", () => {
    expect(parseLapTimeMs("01:23.456")).toBe(83456);
  });
  test("HH:MM:SS.mmm", () => {
    expect(parseLapTimeMs("01:02:34.567")).toBe(3754567);
  });
  test("rejects garbage", () => {
    expect(() => parseLapTimeMs("not-a-time")).toThrow();
  });
});

describe("formatLapTime", () => {
  test("under a minute", () => {
    expect(formatLapTime(43605)).toBe("43.605");
  });
  test("over a minute pads seconds", () => {
    expect(formatLapTime(83456)).toBe("1:23.456");
  });
  test("round trip", () => {
    const ms = parseLapTimeMs("1:23.456");
    expect(formatLapTime(ms)).toBe("1:23.456");
  });
});
