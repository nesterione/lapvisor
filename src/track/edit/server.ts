/**
 * Local Node http server backing `lapvisor track edit`. Serves the editor HTML
 * and exposes `GET /api/track` (re-read from disk) and `POST /api/track`
 * (validate, recompute endpoints, atomic write).
 *
 * Server-side `recomputeEndpoints` is the source of truth: even if the client
 * is buggy or someone POSTs hand-crafted JSON with stale geometry, the file
 * on disk has geometry that matches its (center, bearing, width) properties.
 */

import { readFile, rename, writeFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { recomputeEndpoints } from "../geojson.js";
import type { KartTrack, KartTrackFeature } from "../types.js";
import { renderEditorHtml } from "./template.js";

export interface EditServerOptions {
  filePath: string;
  port: number;
  hostname?: string;
  readOnly: boolean;
}

export interface EditServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

export class TrackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackValidationError";
  }
}

function isKartTrack(value: unknown): value is KartTrack {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.type !== "FeatureCollection") return false;
  const props = v.properties as Record<string, unknown> | undefined;
  if (!props || props.schema !== "kart-track/v1") return false;
  if (!Array.isArray(v.features)) return false;
  return true;
}

function normaliseFeatures(track: KartTrack): KartTrack {
  return {
    ...track,
    features: track.features.map((f) =>
      recomputeEndpoints(f as KartTrackFeature),
    ),
  };
}

async function readTrackFromDisk(filePath: string): Promise<KartTrack> {
  const text = await readFile(filePath, "utf8");
  const parsed = JSON.parse(text) as unknown;
  if (!isKartTrack(parsed)) {
    throw new TrackValidationError(
      `${filePath} is not a kart-track/v1 FeatureCollection`,
    );
  }
  return parsed;
}

async function atomicWrite(filePath: string, body: string): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, body);
  await rename(tmp, filePath);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export async function startEditServer(
  opts: EditServerOptions,
): Promise<EditServer> {
  const initialTrack = await readTrackFromDisk(opts.filePath);
  const html = renderEditorHtml({
    track: initialTrack,
    readOnly: opts.readOnly,
    filePath: opts.filePath,
  });

  const server = createServer((req, res) => {
    handleRequest(req, res, opts, html).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: msg });
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, opts.hostname ?? "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      const port = addr.port;
      resolve({
        url: `http://127.0.0.1:${port}/`,
        port,
        close: () =>
          new Promise<void>((r, rj) =>
            server.close((err) => (err ? rj(err) : r())),
          ),
      });
    });
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: EditServerOptions,
  html: string,
): Promise<void> {
  const url = req.url ?? "/";

  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (req.method === "GET" && url === "/api/track") {
    const fresh = await readTrackFromDisk(opts.filePath);
    sendJson(res, 200, fresh);
    return;
  }

  if (req.method === "POST" && url === "/api/track") {
    if (opts.readOnly) {
      sendJson(res, 403, { error: "read-only" });
      return;
    }
    let parsed: unknown;
    try {
      const body = await readBody(req);
      parsed = JSON.parse(body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      sendJson(res, 400, { error: `invalid JSON: ${msg}` });
      return;
    }
    if (!isKartTrack(parsed)) {
      sendJson(res, 400, {
        error: "not a kart-track/v1 FeatureCollection",
      });
      return;
    }
    const normalised = normaliseFeatures(parsed);
    const body = `${JSON.stringify(normalised, null, 2)}\n`;
    await atomicWrite(opts.filePath, body);
    sendJson(res, 200, { ok: true, savedAt: new Date().toISOString() });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
}
