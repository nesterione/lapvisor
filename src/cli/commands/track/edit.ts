import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
  type EditServer,
  startEditServer,
} from "../../../track/edit/server.js";

export default defineCommand({
  meta: {
    name: "edit",
    description: "Open a kart-track/v1 file in a local browser editor.",
  },
  args: {
    input: {
      type: "positional",
      required: true,
      description: "Path to .track.json (kart-track/v1 GeoJSON)",
    },
    port: {
      type: "string",
      default: "5174",
      description: "Port to serve on (0 = pick a free one)",
    },
    open: {
      type: "boolean",
      default: true,
      description: "Open the URL in a browser (default: true)",
    },
    readOnly: {
      type: "boolean",
      default: false,
      description: "Disable saving (view-only mode)",
    },
  },
  async run({ args }) {
    const filePath = resolve(args.input);
    const port = Number(args.port);
    if (!Number.isFinite(port) || port < 0 || port > 65535) {
      throw new Error(`--port must be 0..65535, got "${args.port}"`);
    }

    let server: EditServer;
    try {
      server = await startEditServer({
        filePath,
        port,
        readOnly: args.readOnly,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`error starting editor: ${msg}`);
      process.exit(1);
    }

    console.log(pc.bold("lapvisor track edit"));
    console.log(`File:   ${filePath}${args.readOnly ? " (read-only)" : ""}`);
    console.log(`URL:    ${pc.cyan(server.url)}`);
    console.log(pc.dim("Press Ctrl-C to stop."));

    if (args.open) tryOpen(server.url);

    await new Promise<void>((resolveClose) => {
      const stop = async () => {
        await server.close();
        resolveClose();
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
    });
  },
});

function tryOpen(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const cmdArgs =
    process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(cmd, cmdArgs, { stdio: "ignore", detached: true });
    child.on("error", () => {
      /* swallow — user can copy the URL */
    });
    child.unref();
  } catch {
    /* swallow */
  }
}
