import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import { z } from "zod";
import { buildKartTrack } from "../../../track/geojson.js";
import { kartTrackIntentSchema } from "../../../track/intent.js";

async function readStdin(): Promise<string> {
  return new Promise((res, rej) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => res(data));
    process.stdin.on("error", rej);
  });
}

export default defineCommand({
  meta: {
    name: "create",
    description:
      "Build a kart-track/v1 GeoJSON file from a structured gate description (stdin or --input). Lapvisor computes LineString endpoints from each gate's center+bearing+width.",
  },
  args: {
    input: {
      type: "string",
      alias: "i",
      description: "Path to intent JSON. Default: read from stdin.",
    },
    out: {
      type: "string",
      alias: "o",
      description: "Output path. Default: write to stdout.",
    },
    pretty: {
      type: "boolean",
      default: true,
      description: "Pretty-print JSON (--no-pretty for minified).",
    },
  },
  async run({ args }) {
    const text = args.input
      ? await readFile(resolve(args.input), "utf8")
      : await readStdin();

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`error: invalid JSON intent: ${msg}`);
      process.exit(1);
    }

    let intent: ReturnType<typeof kartTrackIntentSchema.parse>;
    try {
      intent = kartTrackIntentSchema.parse(raw);
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error("error: intent failed schema validation:");
        for (const issue of e.issues) {
          console.error(
            `  ${issue.path.join(".") || "<root>"}: ${issue.message}`,
          );
        }
        process.exit(1);
      }
      throw e;
    }

    const track = buildKartTrack(intent);
    const json = args.pretty
      ? JSON.stringify(track, null, 2)
      : JSON.stringify(track);

    if (args.out) {
      const outPath = resolve(args.out);
      await writeFile(outPath, `${json}\n`);
      console.error(
        `track="${track.name}" features=${track.features.length} → ${outPath}`,
      );
    } else {
      process.stdout.write(`${json}\n`);
    }
  },
});
