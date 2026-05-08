import type { KartTrack } from "../types.js";
import { EDITOR_CLIENT_JS } from "./client.js";

export interface EditorRenderOptions {
  track: KartTrack;
  readOnly: boolean;
  filePath: string;
}

const LEAFLET_VERSION = "1.9.4";

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderEditorHtml(opts: EditorRenderOptions): string {
  const { track, readOnly, filePath } = opts;
  const title = `${track.name} — lapvisor track edit`;
  const config = { readOnly, filePath };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin="" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; font-family: system-ui, -apple-system, sans-serif; }
  #app { display: grid; grid-template-columns: 1fr 320px; grid-template-rows: 48px 1fr; height: 100%; }
  header { grid-column: 1 / 3; display: flex; align-items: center; gap: 12px; padding: 0 12px;
           border-bottom: 1px solid #ddd; background: #fafafa; }
  header h1 { font-size: 14px; font-weight: 600; margin: 0; }
  header .file { font-size: 11px; color: #888; font-family: ui-monospace, monospace; }
  header input.track-name { font-size: 14px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px;
                            min-width: 240px; }
  header .spacer { flex: 1; }
  header button { padding: 6px 12px; border: 1px solid #888; background: #fff; border-radius: 4px;
                  cursor: pointer; font-size: 13px; }
  header button.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
  header button:disabled { opacity: 0.5; cursor: default; }
  header .status { font-size: 12px; color: #666; min-width: 120px; text-align: right; }
  header .status.error { color: #c00; }
  header .status.saved { color: #0a0; }
  #map { grid-row: 2; grid-column: 1; }
  aside { grid-row: 2; grid-column: 2; border-left: 1px solid #ddd; padding: 12px; overflow-y: auto;
          background: #fff; font-size: 13px; }
  aside h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #888;
             margin: 16px 0 6px; }
  aside h2:first-child { margin-top: 0; }
  aside .empty { color: #888; font-style: italic; padding: 16px 0; }
  aside label { display: block; margin-bottom: 8px; }
  aside label > span { display: block; font-size: 11px; color: #666; margin-bottom: 2px; }
  aside input[type="text"], aside input[type="number"], aside select {
    width: 100%; box-sizing: border-box; padding: 4px 6px; border: 1px solid #ccc; border-radius: 3px;
    font-size: 13px; font-family: inherit;
  }
  aside .row { display: flex; gap: 8px; align-items: center; }
  aside button { padding: 6px 10px; border: 1px solid #888; background: #fff; border-radius: 4px;
                 cursor: pointer; font-size: 12px; }
  aside button.danger { color: #c00; border-color: #c00; }
  aside button.action { background: #2563eb; color: #fff; border-color: #2563eb; }
  aside .feature-list { margin-top: 4px; max-height: 240px; overflow-y: auto; border: 1px solid #eee;
                        border-radius: 3px; }
  aside .feature-list .item { padding: 4px 8px; cursor: pointer; display: flex; align-items: center;
                              gap: 6px; border-bottom: 1px solid #f0f0f0; }
  aside .feature-list .item:hover { background: #f5f5f5; }
  aside .feature-list .item.selected { background: #e0e7ff; }
  aside .feature-list .swatch { width: 10px; height: 10px; border-radius: 2px; flex: 0 0 10px; }
  aside .feature-list .name { flex: 1; }
  aside .feature-list .badge { font-size: 10px; color: #888; }
  .add-mode-banner { position: absolute; top: 56px; left: 50%; transform: translateX(-50%);
                     background: #2563eb; color: #fff; padding: 6px 12px; border-radius: 4px;
                     font-size: 12px; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
</style>
</head>
<body>
<div id="app">
  <header>
    <h1>lapvisor track edit</h1>
    <span class="file">${escapeHtml(filePath)}</span>
    <span class="spacer"></span>
    <input class="track-name" id="track-name" placeholder="Track name" />
    <button id="add-trap">+ Add trap</button>
    <button id="save" class="primary"${readOnly ? " disabled" : ""}>${readOnly ? "Read-only" : "Save"}</button>
    <span class="status" id="status">idle</span>
  </header>
  <div id="map"></div>
  <aside id="panel"></aside>
</div>

<script type="application/json" id="track-data">${safeJson(track)}</script>
<script type="application/json" id="editor-config">${safeJson(config)}</script>
<script src="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossorigin=""></script>
<script>
${EDITOR_CLIENT_JS}
</script>
</body>
</html>
`;
}
