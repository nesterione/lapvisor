/**
 * Browser-side track editor. Embedded as a string so tsup can bundle the whole
 * CLI into a single dist/index.js without shipping extra asset files.
 *
 * The editor mirrors the Haversine math from `src/track/geojson.ts` so that a
 * save → re-open is a no-op diff. Server-side `recomputeEndpoints` is the
 * source of truth on save (defence in depth).
 */
export const EDITOR_CLIENT_JS = `
/* global L */
"use strict";

// --- math (mirrors src/track/geojson.ts so save→reopen is a no-op diff) ---

const EARTH_RADIUS_M = 6371008.8;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const round = (v, p) => Math.round(v * 10 ** p) / 10 ** p;

function destination([lon, lat], bearingDeg, distM) {
  const δ = distM / EARTH_RADIUS_M;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  return [round(toDeg(λ2), 7), round(toDeg(φ2), 7)];
}

function gateEndpoints(center, bearingDeg, widthM) {
  const half = widthM / 2;
  return [
    destination(center, (bearingDeg + 270) % 360, half),
    destination(center, (bearingDeg + 90) % 360, half),
  ];
}

// --- state ---

const STYLE = {
  start_finish: { color: "#16a34a", weight: 5 },
  sector: { color: "#2563eb", weight: 4 },
  unknown: { color: "#f97316", weight: 4 },
};
const SELECTED_WEIGHT_BUMP = 3;

const trackEl = document.getElementById("track-data");
const configEl = document.getElementById("editor-config");
const initialTrack = JSON.parse(trackEl.textContent);
const config = JSON.parse(configEl.textContent);

const state = {
  track: initialTrack,
  selectedId: null,
  addMode: false,
  dirty: false,
};

// featureId -> { gate: L.Polyline, center: L.Marker, arrow: L.Polyline }
const layers = new Map();

// --- helpers ---

function fc() { return state.track; }
function setDirty() { state.dirty = true; setStatus("unsaved", ""); }

function nextTrapId() {
  let max = 0;
  for (const f of fc().features) {
    const m = /^trap-(\\d+)$/.exec(f.properties.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return \`trap-\${max + 1}\`;
}

function nextOrder() {
  let max = -1;
  for (const f of fc().features) max = Math.max(max, f.properties.order);
  return max + 1;
}

function findFeature(id) {
  return fc().features.find((f) => f.properties.id === id) ?? null;
}

function setStatus(state_, text) {
  const el = document.getElementById("status");
  el.className = "status" + (state_ ? " " + state_ : "");
  el.textContent = text || ({
    idle: "idle", saving: "saving…", saved: "saved", error: "error", unsaved: "unsaved",
  })[state_] || "";
}

// --- map ---

const map = L.map("map");
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 22,
  maxNativeZoom: 19,
  attribution: "© OpenStreetMap contributors",
});
const esri = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 22, maxNativeZoom: 19, attribution: "Tiles © Esri" },
);
osm.addTo(map);
L.control.layers({ Streets: osm, Satellite: esri }, {}).addTo(map);

// --- rendering ---

function lonLatToLatLng([lon, lat]) { return [lat, lon]; }

function makeCenterIcon(kind) {
  const color = STYLE[kind].color;
  return L.divIcon({
    className: "kt-center",
    html: \`<div style="
      width: 14px; height: 14px;
      border-radius: 50%;
      background: \${color};
      border: 2px solid #fff;
      box-shadow: 0 0 0 1px #333;
      cursor: move;
    "></div>\`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function arrowEnd(center, bearingDeg, widthM) {
  return destination(center, bearingDeg, widthM * 0.6);
}

function renderFeature(feature) {
  const { id, kind, center, bearing_deg, width_m } = feature.properties;
  const style = STYLE[kind] || STYLE.unknown;
  const selected = state.selectedId === id;
  const weight = style.weight + (selected ? SELECTED_WEIGHT_BUMP : 0);

  const [left, right] = gateEndpoints(center, bearing_deg, width_m);
  const tip = arrowEnd(center, bearing_deg, width_m);

  let entry = layers.get(id);
  if (!entry) {
    const gate = L.polyline([lonLatToLatLng(left), lonLatToLatLng(right)], {
      color: style.color,
      weight,
    }).addTo(map);
    gate.on("click", () => selectFeature(id));

    const centerMarker = L.marker(lonLatToLatLng(center), {
      icon: makeCenterIcon(kind),
      draggable: !config.readOnly,
    }).addTo(map);
    centerMarker.on("click", () => selectFeature(id));
    centerMarker.on("drag", (e) => onCenterDrag(id, e.target.getLatLng()));
    centerMarker.on("dragend", setDirty);

    const arrow = L.polyline([lonLatToLatLng(center), lonLatToLatLng(tip)], {
      color: style.color,
      weight: 2,
      dashArray: "4,4",
    }).addTo(map);

    entry = { gate, center: centerMarker, arrow };
    layers.set(id, entry);
  } else {
    entry.gate.setLatLngs([lonLatToLatLng(left), lonLatToLatLng(right)]);
    entry.gate.setStyle({ color: style.color, weight });
    entry.center.setLatLng(lonLatToLatLng(center));
    entry.center.setIcon(makeCenterIcon(kind));
    entry.arrow.setLatLngs([lonLatToLatLng(center), lonLatToLatLng(tip)]);
    entry.arrow.setStyle({ color: style.color });
  }

  feature.geometry = { type: "LineString", coordinates: [left, right] };
}

function removeFeatureLayer(id) {
  const entry = layers.get(id);
  if (!entry) return;
  map.removeLayer(entry.gate);
  map.removeLayer(entry.center);
  map.removeLayer(entry.arrow);
  layers.delete(id);
}

function renderAll() {
  for (const f of fc().features) renderFeature(f);
}

function fitToTrack() {
  const pts = fc().features.map((f) => lonLatToLatLng(f.properties.center));
  if (pts.length === 0) {
    map.setView([0, 0], 2);
    return;
  }
  const bounds = L.latLngBounds(pts);
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 20 });
}

// --- panel ---

const panel = document.getElementById("panel");

function renderPanel() {
  const f = state.selectedId ? findFeature(state.selectedId) : null;
  const list = renderListHtml();
  if (!f) {
    panel.innerHTML = \`
      <h2>Trap list (\${fc().features.length})</h2>
      \${list}
      <h2>Selection</h2>
      <div class="empty">Click a gate or list item to edit it.</div>
    \`;
    attachListHandlers();
    return;
  }
  const p = f.properties;
  panel.innerHTML = \`
    <h2>Trap list (\${fc().features.length})</h2>
    \${list}
    <h2>Selected: \${escapeHtml(p.name || p.id)}</h2>
    <label><span>Name</span><input type="text" id="f-name" value="\${escapeAttr(p.name)}" /></label>
    <label><span>Kind</span>
      <select id="f-kind">
        <option value="start_finish"\${p.kind === "start_finish" ? " selected" : ""}>start_finish</option>
        <option value="sector"\${p.kind === "sector" ? " selected" : ""}>sector</option>
        <option value="unknown"\${p.kind === "unknown" ? " selected" : ""}>unknown</option>
      </select>
    </label>
    <label><span>Bearing (deg)</span>
      <input type="number" id="f-bearing" min="0" max="360" step="0.1" value="\${p.bearing_deg}" />
    </label>
    <label><span>Width (m)</span>
      <input type="number" id="f-width" min="0.1" step="0.1" value="\${p.width_m}" />
    </label>
    <label class="row">
      <input type="checkbox" id="f-uni"\${p.unidirectional ? " checked" : ""} />
      <span>Unidirectional</span>
    </label>
    <h2>Center</h2>
    <div style="font-family: ui-monospace, monospace; font-size: 12px; color: #444;">
      \${p.center[1].toFixed(7)}, \${p.center[0].toFixed(7)}
    </div>
    <h2>Identity</h2>
    <div style="font-size: 12px; color: #666;">
      id: <code>\${escapeHtml(p.id)}</code> · order: \${p.order}
    </div>
    <div style="margin-top: 16px;">
      <button class="danger" id="f-delete"\${config.readOnly ? " disabled" : ""}>Delete trap</button>
    </div>
  \`;
  attachPanelHandlers(f);
  attachListHandlers();
}

function renderListHtml() {
  const items = fc().features.map((f) => {
    const p = f.properties;
    const style = STYLE[p.kind] || STYLE.unknown;
    const selected = state.selectedId === p.id ? " selected" : "";
    return \`
      <div class="item\${selected}" data-id="\${escapeAttr(p.id)}">
        <span class="swatch" style="background:\${style.color}"></span>
        <span class="name">\${escapeHtml(p.name || p.id)}</span>
        <span class="badge">\${escapeHtml(p.kind)}</span>
      </div>
    \`;
  }).join("");
  return \`<div class="feature-list">\${items}</div>\`;
}

function attachListHandlers() {
  panel.querySelectorAll(".feature-list .item").forEach((el) => {
    el.addEventListener("click", () => selectFeature(el.dataset.id));
  });
}

function attachPanelHandlers(feature) {
  const p = feature.properties;
  document.getElementById("f-name").addEventListener("input", (e) => {
    p.name = e.target.value;
    setDirty();
    updateListItemLabel(p.id);
  });
  document.getElementById("f-kind").addEventListener("change", (e) => {
    p.kind = e.target.value;
    if (p.kind === "start_finish") p.id = "sf";
    else if (p.id === "sf") p.id = nextTrapId();
    setDirty();
    renderFeature(feature);
    renderPanel();
  });
  document.getElementById("f-bearing").addEventListener("input", (e) => {
    p.bearing_deg = round(Number(e.target.value), 3);
    setDirty();
    renderFeature(feature);
  });
  document.getElementById("f-width").addEventListener("input", (e) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v > 0) {
      p.width_m = round(v, 3);
      setDirty();
      renderFeature(feature);
    }
  });
  document.getElementById("f-uni").addEventListener("change", (e) => {
    p.unidirectional = e.target.checked;
    setDirty();
  });
  document.getElementById("f-delete").addEventListener("click", () => deleteFeature(feature.properties.id));
}

function updateListItemLabel(id) {
  const item = panel.querySelector(\`.feature-list .item[data-id="\${cssEscape(id)}"] .name\`);
  const f = findFeature(id);
  if (item && f) item.textContent = f.properties.name || f.properties.id;
}

// --- selection ---

function selectFeature(id) {
  if (state.selectedId === id) return;
  const prev = state.selectedId;
  state.selectedId = id;
  if (prev) {
    const f = findFeature(prev);
    if (f) renderFeature(f);
  }
  const f = findFeature(id);
  if (f) renderFeature(f);
  renderPanel();
}

// --- drag ---

function onCenterDrag(id, latLng) {
  const f = findFeature(id);
  if (!f) return;
  f.properties.center = [round(latLng.lng, 7), round(latLng.lat, 7)];
  renderFeature(f);
  if (state.selectedId === id) {
    renderPanel();
  }
}

// --- add / delete ---

function enterAddMode() {
  state.addMode = true;
  showAddBanner();
  map.getContainer().style.cursor = "crosshair";
}

function exitAddMode() {
  state.addMode = false;
  hideAddBanner();
  map.getContainer().style.cursor = "";
}

let bannerEl = null;
function showAddBanner() {
  if (bannerEl) return;
  bannerEl = document.createElement("div");
  bannerEl.className = "add-mode-banner";
  bannerEl.textContent = "Click on the map to place a new trap (Esc to cancel)";
  document.body.appendChild(bannerEl);
}
function hideAddBanner() {
  if (bannerEl) { bannerEl.remove(); bannerEl = null; }
}

function addTrapAt(lon, lat) {
  const id = nextTrapId();
  const order = nextOrder();
  const center = [round(lon, 7), round(lat, 7)];
  const newFeature = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: gateEndpoints(center, 0, 10) },
    properties: {
      id,
      kind: "sector",
      name: "New trap",
      order,
      bearing_deg: 0,
      width_m: 10,
      unidirectional: true,
      center,
    },
  };
  fc().features.push(newFeature);
  renderFeature(newFeature);
  setDirty();
  selectFeature(id);
}

function deleteFeature(id) {
  const idx = fc().features.findIndex((f) => f.properties.id === id);
  if (idx < 0) return;
  fc().features.splice(idx, 1);
  removeFeatureLayer(id);
  fc().features.forEach((f, i) => { f.properties.order = i; });
  if (state.selectedId === id) state.selectedId = null;
  setDirty();
  renderPanel();
}

map.on("click", (e) => {
  if (!state.addMode) return;
  exitAddMode();
  addTrapAt(e.latlng.lng, e.latlng.lat);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.addMode) {
    e.preventDefault();
    exitAddMode();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    save();
  }
});

// --- save ---

async function save() {
  if (config.readOnly) return;
  setStatus("saving");
  try {
    const res = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fc()),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || \`HTTP \${res.status}\`);
    }
    state.dirty = false;
    setStatus("saved");
    setTimeout(() => { if (!state.dirty) setStatus("idle"); }, 1500);
  } catch (e) {
    setStatus("error", \`error: \${e.message}\`);
  }
}

// --- track-name binding ---

const nameInput = document.getElementById("track-name");
nameInput.value = fc().name;
nameInput.addEventListener("input", (e) => {
  fc().name = e.target.value;
  setDirty();
});

// --- top-bar buttons ---

document.getElementById("add-trap").addEventListener("click", () => {
  if (config.readOnly) return;
  if (state.addMode) exitAddMode();
  else enterAddMode();
});

document.getElementById("save").addEventListener("click", save);

// --- escape helpers ---

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
function escapeAttr(s) { return escapeHtml(s); }
function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/"/g, '\\\\"');
}

// --- boot ---

renderAll();
fitToTrack();
renderPanel();
setStatus("idle");
`;
