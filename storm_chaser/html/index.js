/* Storm Chaser settings UI */
'use strict';

// CamScripter proxies the microapp's HttpServer under this path. Bare relative
// paths hit the static-file route and return 400 — always use the proxy.
const PKG = 'storm_chaser';
const API = (ep) => `/local/camscripter/proxy/${PKG}/${ep}`;

const FIELDS = {
  bool: ['enabled', 'use_cloud', 'overlay_enabled', 'nws_enabled', 'nws_override', 'ptz_pan_flip', 'cg_enabled', 'typhoon_enabled', 'typhoon_override'],
  num: ['camera_port', 'typhoon_range_km', 'ptz_channel', 'latitude', 'longitude', 'coverage_deg', 'center_bearing_deg',
        'home_preset', 'scan_radius_km', 'scan_rings', 'pp_count',
        'pp_preset_1', 'pp_preset_2', 'pp_preset_3', 'pp_preset_4', 'pp_preset_5', 'pp_preset_6', 'pp_preset_7', 'pp_preset_8',
        'pp_bearing_1', 'pp_bearing_2', 'pp_bearing_3', 'pp_bearing_4', 'pp_bearing_5', 'pp_bearing_6', 'pp_bearing_7', 'pp_bearing_8',
        'samples_per_ring', 'w_lightning', 'w_cape', 'w_precip', 'w_gust',
        'intensity_threshold', 'update_interval_min', 'dwell_min', 'hysteresis_deg',
        'switch_margin', 'top_spots', 'infoticker_service_id', 'cs_view_count',
        'ptz_ref_bearing', 'ptz_tilt', 'ptz_zoom_min_pct', 'ptz_zoom_max_pct', 'ptz_arc_left_deg', 'ptz_arc_right_deg', 'cg_service_id',
        'cs_view_1_bearing', 'cs_view_2_bearing', 'cs_view_3_bearing', 'cs_view_4_bearing', 'cs_view_5_bearing'],
  str: ['camera_ip', 'camera_protocol', 'camera_user', 'camera_pass', 'cloud_url', 'device_access_token',
        'location_name', 'infoticker_template', 'target_mode', 'unit_system', 'cs_home_url', 'cs_home_name',
        'cs_view_1_url', 'cs_view_2_url', 'cs_view_3_url', 'cs_view_4_url', 'cs_view_5_url',
        'cs_view_1_name', 'cs_view_2_name', 'cs_view_3_name', 'cs_view_4_name', 'cs_view_5_name',
        'cg_field_status', 'cg_field_bearing', 'cg_field_compass', 'cg_field_distance', 'cg_field_dist_unit',
        'cg_field_intensity', 'cg_field_preset', 'cg_field_location', 'cg_field_time',
        'pp_name_1', 'pp_name_2', 'pp_name_3', 'pp_name_4', 'pp_name_5', 'pp_name_6', 'pp_name_7', 'pp_name_8'],
};

/* Curated quick-select locations: CamStreamer offices + Axis Experience Centers.
   Coordinates are city-level — fine for seeding the camera position (storm
   bearings are computed relative to this point). Edit lat/lon after selecting if
   you need the exact rooftop. The live Axis AEC map may add/remove cities over
   time; verify at https://www.axis.com/axis-experience-center */
const LOCATIONS = [
  { g: 'CamStreamer offices', items: [
    { n: 'CamStreamer HQ — Prague, CZ',        lat: 50.0686, lon: 14.4030 },
    { n: 'CamStreamer US — Leander / Austin, TX', lat: 30.5788, lon: -97.8531 },
  ]},
  { g: 'Axis Experience Centers — Americas', items: [
    { n: 'AEC — New York City, NY',  lat: 40.7128, lon: -74.0060 },
    { n: 'AEC — Boston, MA',         lat: 42.3601, lon: -71.0589 },
    { n: 'AEC — Washington, D.C.',   lat: 38.9072, lon: -77.0369 },
    { n: 'AEC — Atlanta, GA',        lat: 33.7490, lon: -84.3880 },
    { n: 'AEC — Fort Lauderdale, FL',lat: 26.1224, lon: -80.1373 },
    { n: 'AEC — Chicago, IL',        lat: 41.8781, lon: -87.6298 },
    { n: 'AEC — Detroit, MI',        lat: 42.3314, lon: -83.0458 },
    { n: 'AEC — Dallas, TX',         lat: 32.7767, lon: -96.7970 },
    { n: 'AEC — Houston, TX',        lat: 29.7604, lon: -95.3698 },
    { n: 'AEC — Los Angeles, CA',    lat: 34.0522, lon: -118.2437 },
    { n: 'AEC — San Jose, CA',       lat: 37.3382, lon: -121.8863 },
    { n: 'AEC — Toronto, CA',        lat: 43.6532, lon: -79.3832 },
    { n: 'AEC — Mexico City, MX',    lat: 19.4326, lon: -99.1332 },
    { n: 'AEC — São Paulo, BR',      lat: -23.5558, lon: -46.6396 },
  ]},
  { g: 'Axis Experience Centers — EMEA', items: [
    { n: 'Axis HQ / AEC — Lund, SE', lat: 55.7047, lon: 13.1910 },
    { n: 'AEC — London, UK',         lat: 51.5074, lon: -0.1278 },
    { n: 'AEC — Paris, FR',          lat: 48.8566, lon: 2.3522 },
    { n: 'AEC — Madrid, ES',         lat: 40.4168, lon: -3.7038 },
    { n: 'AEC — Milan, IT',          lat: 45.4642, lon: 9.1900 },
    { n: 'AEC — Munich, DE',         lat: 48.1351, lon: 11.5820 },
    { n: 'AEC — Vienna, AT',         lat: 48.2082, lon: 16.3738 },
    { n: 'AEC — Dubai, AE',          lat: 25.2048, lon: 55.2708 },
    { n: 'AEC — Johannesburg, ZA',   lat: -26.2041, lon: 28.0473 },
  ]},
  { g: 'Axis Experience Centers — APAC', items: [
    { n: 'AEC — Tokyo, JP',          lat: 35.6762, lon: 139.6503 },
    { n: 'AEC — Seoul, KR',          lat: 37.5665, lon: 126.9780 },
    { n: 'AEC — Shanghai, CN',       lat: 31.2304, lon: 121.4737 },
    { n: 'AEC — Hong Kong, HK',      lat: 22.3193, lon: 114.1694 },
    { n: 'AEC — Singapore, SG',      lat: 1.3521,  lon: 103.8198 },
    { n: 'AEC — Bangkok, TH',        lat: 13.7563, lon: 100.5018 },
    { n: 'AEC — Kuala Lumpur, MY',   lat: 3.1390,  lon: 101.6869 },
    { n: 'AEC — Mumbai, IN',         lat: 19.0760, lon: 72.8777 },
    { n: 'AEC — Sydney, AU',         lat: -33.8688, lon: 151.2093 },
  ]},
];

const $ = (id) => document.getElementById(id);

// Units (display only; all internal math stays in km).
const KM_PER_MI = 1.60934;
let displayUnit = 'imperial';              // unit the scan-radius input currently shows
const toDispWith = (u, km) => u === 'metric' ? km : km / KM_PER_MI;
const fromDispWith = (u, v) => u === 'metric' ? v : v * KM_PER_MI;
const distUnit = () => displayUnit === 'metric' ? 'km' : 'mi';
const dispDist = (km) => (km == null ? null : (displayUnit === 'metric' ? km : km / KM_PER_MI));
// Canonical scan radius in km (input may hold miles).
function scanRadiusKm() { return Math.max(1, fromDispWith(displayUnit, num($('scan_radius_km').value)) || 1); }

// Distinct colors per sector (CamSwitcher views and PTZ presets, up to 8).
// Red is reserved for storm dots, so it's excluded here.
const CS_COLORS = ['#2563eb', '#e8590c', '#16a34a', '#9333ea', '#0891b2', '#db2777', '#ca8a04', '#4f46e5'];

// Build the 5 CamSwitcher view rows (fixed ids so load/collect work).
(function buildCsRows() {
  const wrap = document.getElementById('csViewRows');
  if (!wrap) return;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const col = CS_COLORS[i - 1];
    html += `<div class="csrow" data-slot="${i}" style="display:none;border-left-color:${col}">
      <span class="csswatch" style="background:${col}"></span>
      <div class="csbear"><label>View ${i} · °</label><input id="cs_view_${i}_bearing" type="number" min="0" max="359"></div>
      <div><label>View ${i} — playlist</label>
        <select class="cspick" id="cs_view_${i}_pick" data-target="cs_view_${i}_url" data-name="cs_view_${i}_name" style="display:none"><option value="">— pick from camera —</option></select>
        <input class="csurl" id="cs_view_${i}_url" placeholder="pick above, or paste URL / playlist_name">
        <input type="hidden" id="cs_view_${i}_name"></div>
    </div>`;
  }
  wrap.innerHTML = html;
})();

// Build the 8 PTZ-preset assignment rows (same style as CamSwitcher).
(function buildPpRows() {
  const wrap = document.getElementById('ppRows');
  if (!wrap) return;
  let html = '';
  for (let i = 1; i <= 8; i++) {
    const col = CS_COLORS[(i - 1) % CS_COLORS.length];
    html += `<div class="csrow" data-slot="${i}" style="display:none;border-left-color:${col}">
      <span class="csswatch" style="background:${col}"></span>
      <div class="csbear"><label>Preset ${i} · °</label><input id="pp_bearing_${i}" type="number" min="0" max="359"></div>
      <div><label>Slot ${i} — camera preset</label>
        <div style="display:flex;gap:8px;align-items:center">
          <select class="pppick" id="pp_pick_${i}" data-target="pp_preset_${i}" data-name="pp_name_${i}" style="flex:1;min-width:0"><option value="">— pick from camera —</option></select>
          <input class="csurl" id="pp_preset_${i}" type="number" min="0" title="Preset number" placeholder="#" style="flex:0 0 64px;text-align:center">
        </div>
        <input type="hidden" id="pp_name_${i}"></div>
    </div>`;
  }
  wrap.innerHTML = html;
})();
const msg = (t, kind) => { const m = $('msg'); m.textContent = t; m.style.color = kind === 'err' ? 'var(--danger)' : kind === 'ok' ? 'var(--ok)' : 'var(--muted)'; };

// ── Theme (light default, persisted) ────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  $('themeToggle').textContent = t === 'dark' ? '☀ Light' : '🌙 Dark';
  try { localStorage.setItem('sc_theme', t); } catch {}
}
$('themeToggle').addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});
applyTheme((() => { try { return localStorage.getItem('sc_theme') || 'light'; } catch { return 'light'; } })());

// ── Quick-select location dropdown ───────────────────────────────────────────
(function buildLocationPicker() {
  const sel = $('location_preset');
  LOCATIONS.forEach((grp) => {
    const og = document.createElement('optgroup');
    og.label = grp.g;
    grp.items.forEach((it) => {
      const o = document.createElement('option');
      o.value = `${it.lat},${it.lon}`;
      o.textContent = it.n;
      o.dataset.name = it.n;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  sel.addEventListener('change', () => {
    if (!sel.value) return;
    const [lat, lon] = sel.value.split(',');
    $('latitude').value = lat;
    $('longitude').value = lon;
    const opt = sel.options[sel.selectedIndex];
    // Strip the "AEC — " / "CamStreamer … — " prefix for a clean overlay name.
    $('location_name').value = (opt.dataset.name || '').replace(/^.*?—\s*/, '').trim() || opt.dataset.name;
    refreshDerived();
  });
})();

/** Mark the dropdown as matching the current lat/lon, else reset to placeholder. */
function syncLocationPicker() {
  const sel = $('location_preset');
  const lat = Number($('latitude').value).toFixed(4);
  const lon = Number($('longitude').value).toFixed(4);
  let match = '';
  for (const o of sel.options) {
    if (!o.value) continue;
    const [a, b] = o.value.split(',');
    if (Number(a).toFixed(4) === lat && Number(b).toFixed(4) === lon) { match = o.value; break; }
  }
  sel.value = match;
}

// ── Load / collect ──────────────────────────────────────────────────────────
function fill(s) {
  FIELDS.bool.forEach((k) => { if ($(k)) $(k).checked = !!s[k]; });
  FIELDS.num.forEach((k) => { if ($(k)) $(k).value = s[k] ?? ''; });
  FIELDS.str.forEach((k) => { if ($(k)) $(k).value = s[k] ?? ''; });
  // Port 0 means "auto" — leave the box blank so the placeholder shows.
  if ($('camera_port') && (!s.camera_port || Number(s.camera_port) === 0)) $('camera_port').value = '';
  if ($('camera_protocol') && !s.camera_protocol) $('camera_protocol').value = 'http';
  // Show scan radius (stored in km) in the chosen display unit.
  displayUnit = s.unit_system === 'metric' ? 'metric' : 'imperial';
  if ($('unit_system')) $('unit_system').value = displayUnit;
  if ($('scan_radius_km')) $('scan_radius_km').value = Math.round(toDispWith(displayUnit, Number(s.scan_radius_km) || 0));
  updateUnitLabels();
  syncModeSeg();
  syncLocationPicker();
  syncPortHint();
  refreshDerived();
}
// Accept both "." and "," decimal separators (CZ/EU locale types comma).
const num = (v) => {
  const s = String(v).trim().replace(',', '.');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
function collect() {
  const out = {};
  FIELDS.bool.forEach((k) => out[k] = $(k).checked);
  FIELDS.num.forEach((k) => out[k] = num($(k).value));
  FIELDS.str.forEach((k) => out[k] = $(k).value);
  // Always store scan radius in km regardless of the displayed unit.
  out.scan_radius_km = Math.round(scanRadiusKm());
  return out;
}

function updateUnitLabels() {
  if ($('radiusLabel')) $('radiusLabel').textContent = `Scan radius (${distUnit()})`;
}

// Switching units converts the value already typed in the radius box.
function onUnitChange() {
  const newU = $('unit_system').value === 'metric' ? 'metric' : 'imperial';
  const km = fromDispWith(displayUnit, num($('scan_radius_km').value)); // interpret with OLD unit
  displayUnit = newU;
  $('scan_radius_km').value = Math.round(toDispWith(newU, km));
  updateUnitLabels();
  refreshDerived();
  saveDraft();
}

// ── Draft autosave (survives accidental page refresh) ────────────────────────
const DRAFT_KEY = 'sc_draft';
let draftReady = false; // don't autosave until the form is first populated
function saveDraft() {
  if (!draftReady) return;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(collect())); } catch {}
}
function readDraft() {
  try { const d = localStorage.getItem(DRAFT_KEY); return d ? JSON.parse(d) : null; } catch { return null; }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

// Cache the lists fetched from the camera (view areas/presets, CamSwitcher
// playlists) so a page refresh re-shows them without forcing a re-fetch. These
// are just the option lists — the chosen values live in the saved settings.
const LIST_CACHE_KEY = 'sc_lists';
function cacheLists(patch) {
  try {
    const cur = JSON.parse(localStorage.getItem(LIST_CACHE_KEY) || '{}');
    localStorage.setItem(LIST_CACHE_KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {}
}
function readLists() {
  try { return JSON.parse(localStorage.getItem(LIST_CACHE_KEY) || '{}'); } catch { return {}; }
}

async function fetchSettingsWithRetry(tries = 12, delayMs = 1000) {
  // After "Save & restart" the CamScripter proxy returns 500 for ~1s while the
  // app relaunches. Retry so a refresh during that window doesn't blank the form.
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(API('settings.cgi'), { cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch {}
    if (i < tries - 1) {
      if (i === 0) msg('App is starting up…');
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
  throw new Error('settings unavailable');
}

async function load() {
  let saved = null;
  try { saved = await fetchSettingsWithRetry(); }
  catch (e) { msg('Load failed (using last local draft): ' + e, 'err'); }

  const draft = readDraft();
  if (draft) {
    // Restore in-progress edits the user hadn't saved yet (e.g. after refresh).
    fill({ ...(saved || {}), ...draft });
    msg('Restored your unsaved changes. Reload to discard.', 'warn');
  } else if (saved) {
    fill(saved);
    msg('Settings loaded.', 'ok');
  }
  restoreCachedLists();
  draftReady = true;
}

// Re-show the last-fetched camera lists (view areas/presets, CamSwitcher
// playlists) after a refresh, without overwriting saved selections.
function restoreCachedLists() {
  const c = readLists();
  try {
    if (Array.isArray(c.viewAreas) && c.viewAreas.length) renderViewAreas(c.viewAreas, false);
    if (Array.isArray(c.playlists) && c.playlists.length) { csPlaylists = c.playlists; populatePlaylistPickers(); }
    // Pre-select each picker to match the saved value so the dropdowns reflect
    // the current assignment (not just the hidden value/url fields).
    for (let i = 1; i <= 8; i++) { const pk = $(`pp_pick_${i}`), v = $(`pp_preset_${i}`); if (pk && v) pk.value = String(v.value || ''); }
    for (let i = 1; i <= 5; i++) { const pk = $(`cs_view_${i}_pick`), u = $(`cs_view_${i}_url`); if (pk && u) pk.value = String(u.value || ''); }
  } catch {}
}

// Reload button = discard the draft and pull the saved settings from the camera.
async function discardAndReload() {
  clearDraft();
  draftReady = false;
  try {
    const saved = await (await fetch(API('settings.cgi'))).json();
    fill(saved);
    msg('Reverted to saved settings.', 'ok');
  } catch (e) { msg('Reload failed: ' + e, 'err'); }
  draftReady = true;
}

async function save() {
  try {
    msg('Saving…');
    const r = await fetch(API('settings.cgi'), { method: 'POST', body: JSON.stringify(collect()) });
    const j = await r.json();
    if (j.ok) { clearDraft(); msg('Saved — app is restarting.', 'ok'); }
    else msg('Save error: ' + (j.error || '?'), 'err');
  } catch (e) { msg('Save failed: ' + e, 'err'); }
}

// ── Derived preview (preset map + compass) ───────────────────────────────────
const norm360 = (d) => ((d % 360) + 360) % 360;
const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const compass = (deg) => COMPASS[Math.round(norm360(deg) / 22.5) % 16];

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const EARTH_R = 6371;
function destPoint(lat, lon, bearingDeg, distKm) {
  const ang = distKm / EARTH_R, br = toRad(bearingDeg), la1 = toRad(lat), lo1 = toRad(lon);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(ang) + Math.cos(la1) * Math.sin(ang) * Math.cos(br));
  const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(ang) * Math.cos(la1), Math.cos(ang) - Math.sin(la1) * Math.sin(la2));
  return [toDeg(la2), ((toDeg(lo2) + 540) % 360) - 180];
}

let presetNamesByNo = {};   // fetched PTZ preset names keyed by preset number
function isViewAreaMode() { return $('target_mode').value === 'camswitcher'; }
function csViewCount() { return Math.max(1, Math.min(5, num($('cs_view_count').value) || 1)); }

/** Configured CamSwitcher views with a URL: [{name, bearing, color, slot}].
 *  360° → explicit bearings; 180° → even tiling across the arc by order. */
function csViews() {
  const n = csViewCount();
  const arc180 = num($('coverage_deg').value) === 180;
  const active = [];
  for (let i = 1; i <= n; i++) {
    const url = $(`cs_view_${i}_url`) ? $(`cs_view_${i}_url`).value : '';
    const name = String(url).replace(/.*playlist_name=/, '').trim();
    if (name) active.push({ name, slot: i });
  }
  const cnt = active.length || 1;
  return active.map((a, idx) => {
    const nm = $(`cs_view_${a.slot}_name`) ? $(`cs_view_${a.slot}_name`).value.trim() : '';
    return {
      name: nm || a.name,
      slot: a.slot,
      color: CS_COLORS[a.slot - 1],
      bearing: arc180 ? presetCenter(idx, cnt) : norm360(num($(`cs_view_${a.slot}_bearing`).value)),
    };
  });
}
function ppCount() { return Math.max(1, Math.min(8, num($('pp_count').value) || 1)); }
/** Configured PTZ presets with a preset number: [{presetNo, name, bearing, color, slot}]. */
function ppViews() {
  const arc180 = num($('coverage_deg').value) === 180;
  const n = ppCount();
  const active = [];
  for (let i = 1; i <= n; i++) {
    const no = num($(`pp_preset_${i}`).value);
    if (!no) continue;
    active.push({ slot: i, no, name: $(`pp_name_${i}`) ? $(`pp_name_${i}`).value.trim() : '' });
  }
  const cnt = active.length || 1;
  return active.map((a, idx) => ({
    presetNo: a.no, name: a.name || String(a.no), title: a.name,
    slot: a.slot, color: CS_COLORS[(a.slot - 1) % CS_COLORS.length],
    bearing: arc180 ? presetCenter(idx, cnt) : norm360(num($(`pp_bearing_${a.slot}`).value)),
  }));
}
function sectorCount() {
  if (isViewAreaMode()) return Math.max(1, csViews().length);
  if (isPtzTrackMode()) return 1;
  return Math.max(1, ppViews().length);
}
function presetCenter(i, n) {
  if (n == null) n = sectorCount();
  const coverage = num($('coverage_deg').value) === 180 ? 180 : 360;
  const center = norm360(num($('center_bearing_deg').value));
  if (coverage === 360) return norm360(center + (i * 360) / n);
  return norm360((center - 90) + ((i + 0.5) * 180) / n);
}
/** [{name, title, bearing, color}] per sector. */
function sectorViews() {
  if (isViewAreaMode()) return csViews().map((v) => ({ ...v, title: v.name }));
  if (isPtzTrackMode()) return [];   // continuous tracking — no fixed sectors
  return ppViews();
}

function isPtzTrackMode() { return $('target_mode').value === 'ptztrack'; }

// Camera protocol/port helper text: show the effective port and cert note.
function syncPortHint() {
  const https = ($('camera_protocol').value || 'http') === 'https';
  const p = num($('camera_port').value) || 0;
  const eff = p > 0 ? p : (https ? 443 : 80);
  const el = $('portHint');
  if (el) el.textContent = `→ port ${eff}` + (https ? ' · untrusted certs OK' : '');
}
['camera_protocol', 'camera_port'].forEach((k) => {
  const el = $(k);
  if (el) el.addEventListener('input', () => { syncPortHint(); saveDraft && saveDraft(); });
});

// Segmented control for targeting mode (replaces the dropdown).
function syncModeSeg() {
  const v = $('target_mode').value || 'camswitcher';
  document.querySelectorAll('#modeSeg .seg').forEach((b) => b.classList.toggle('active', b.dataset.val === v));
}
document.getElementById('modeSeg').addEventListener('click', (e) => {
  const b = e.target.closest('.seg');
  if (!b) return;
  $('target_mode').value = b.dataset.val;
  syncModeSeg();
  refreshDerived();
  saveDraft();
});

function refreshDerived() {
  const va = isViewAreaMode();
  const ptz = isPtzTrackMode();
  const presets = !va && !ptz;
  // Toggle mode-specific controls.
  $('viewareaModeBox').style.display = va ? 'block' : 'none';
  $('ptzModeBox').style.display = ptz ? 'block' : 'none';
  $('ptzPresetBox').style.display = presets ? 'block' : 'none';
  const arc180 = Number($('coverage_deg').value) === 180;
  // Show only as many rows as selected, hiding the bearing input in 180° mode.
  function layoutRows(sel, cnt) {
    document.querySelectorAll(sel).forEach((row) => {
      row.style.display = Number(row.dataset.slot) <= cnt ? 'grid' : 'none';
      const bear = row.querySelector('.csbear');
      if (bear) bear.style.display = arc180 ? 'none' : 'block';
      row.style.gridTemplateColumns = arc180 ? 'auto 1fr' : 'auto 78px 1fr';
    });
  }
  if (va) layoutRows('#csViewRows .csrow', csViewCount());
  if (presets) layoutRows('#ppRows .csrow', ppCount());

  const coverage = Number($('coverage_deg').value) === 180 ? 180 : 360;
  $('centerLabel').textContent = coverage === 360 ? 'North offset (°)' : 'Arc center bearing (°)';
  if (ptz) {
    const L = Math.max(0, Math.min(180, num($('ptz_arc_left_deg').value)));
    const R = Math.max(0, Math.min(180, num($('ptz_arc_right_deg').value)));
    $('coverageHint').textContent = (L + R >= 360)
      ? 'PTZ tracking: full 360° — the camera pans to any storm bearing and zooms by distance.'
      : `PTZ tracking: pans up to ${L}° left and ${R}° right of its pan-0 bearing (set under PTZ tracking). Storms outside this reach are ignored. The "Preset coverage" arc settings below are not used in this mode.`;
  } else if (va) {
    $('coverageHint').textContent = coverage === 360
      ? 'Each view is placed at its own bearing; the storm picks the nearest view.'
      : 'Views tile the 180° arc evenly by order (e.g. 2 views = two 90° halves). Set the arc-center bearing to the middle of where your cameras look.';
  } else {
    $('coverageHint').textContent = coverage === 360
      ? 'Presets are spread evenly around the full circle, starting at the north offset.'
      : 'Presets cover a 180° arc centered on the arc-center bearing (center ± 90°). Storms outside the arc are ignored.';
  }

  const sv = sectorViews();
  $('presetTable').querySelector('thead').innerHTML =
    va ? '<tr><th>View (playlist)</th><th>Bearing</th><th>Direction</th></tr>'
       : '<tr><th>Preset</th><th>Bearing</th><th>Direction</th></tr>';
  const tb = $('presetTable').querySelector('tbody');
  tb.innerHTML = '';
  const centers = [];
  const labels = [];
  sv.forEach((v) => {
    centers.push(v.bearing);
    labels.push(va ? `V${v.slot}` : String(v.presetNo));
    const dot = v.color ? `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${v.color};margin-right:6px;vertical-align:middle"></span>` : '';
    const label = va
      ? `${dot}V${v.slot} · ${(v.name || '—').slice(0, 14)}`
      : `${dot}#${v.presetNo}${v.title ? ' · ' + v.title.slice(0, 14) : ''}`;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${label}</td><td>${Math.round(v.bearing)}°</td><td>${compass(v.bearing)}</td>`;
    tb.appendChild(tr);
  });
  const rings = Math.max(1, num($('scan_rings').value) || 1);
  const per = Math.max(1, num($('samples_per_ring').value) || 1);
  $('probeCount').textContent = rings * per;
  // Estimate Open-Meteo daily cost: points × scans/day (1 location = ~1 call).
  const interval = Math.max(1, num($('update_interval_min').value) || 5);
  const perDay = Math.round(rings * per * (1440 / interval));
  $('apiCost').textContent = perDay.toLocaleString();
  $('apiWarn').textContent = perDay > 9000 ? ' ⚠ over free limit — raise interval or lower rings/samples' : '';
  drawCompass(centers, 1);
  updateMap();
  saveDraft(); // capture programmatic changes (location picker, view-area apply)
}

function drawCompass(centers, base) {
  const cv = $('compass'); const ctx = cv.getContext('2d');
  const W = cv.width, cx = W / 2, cy = W / 2, R = W / 2 - 26;
  const css = getComputedStyle(document.documentElement);
  const col = (v) => css.getPropertyValue(v).trim();
  ctx.clearRect(0, 0, W, W);
  // ring
  ctx.strokeStyle = col('--border'); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  // cardinal labels
  ctx.fillStyle = col('--muted'); ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [['N',0],['E',90],['S',180],['W',270]].forEach(([t, b]) => {
    const a = (b - 90) * Math.PI / 180;
    ctx.fillText(t, cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14));
  });
  // preset spokes
  centers.forEach((c, i) => {
    const a = (c - 90) * Math.PI / 180;
    ctx.strokeStyle = col('--accent'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
    ctx.fillStyle = col('--accent');
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif';
    ctx.fillText(String(base + i), cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  });
}

['coverage_deg','center_bearing_deg','scan_rings','samples_per_ring',
 'target_mode','cs_view_count','cs_home_url','update_interval_min','ptz_ref_bearing','ptz_arc_left_deg','ptz_arc_right_deg','pp_count']
  .forEach((k) => $(k).addEventListener('input', refreshDerived));
// PTZ-preset rows → refresh on edit, and capture preset nice name on pick.
$('ppRows').addEventListener('input', () => { refreshDerived(); saveDraft(); });
$('ppRows').addEventListener('change', (e) => {
  const sel = e.target.closest('.pppick');
  if (!sel) return;
  const t = $(sel.dataset.target), nm = $(sel.dataset.name);
  if (t && sel.value) { t.value = sel.value; if (nm) nm.value = sel.options[sel.selectedIndex].dataset.nice || ''; refreshDerived(); saveDraft(); }
});
$('fetchPresetsBtn2').addEventListener('click', fetchPresets);

// PTZ tracking: read the camera's current pan/tilt/zoom and show it.
$('readPtzBtn').addEventListener('click', async () => {
  const c = connSettings(); c.ptz_channel = num($('ptz_channel').value) || 1;
  $('ptzPosMsg').textContent = 'Reading…';
  try {
    const r = await fetch(API('ptzpos.cgi'), { method: 'POST', body: JSON.stringify(c) });
    const j = await r.json();
    if (!j.ok) { $('ptzPosMsg').textContent = '✗ ' + (j.error || 'failed'); return; }
    const p = j.position || {};
    $('ptzPosMsg').textContent = `current: pan ${p.pan ?? '?'}° · tilt ${p.tilt ?? '?'}° · zoom ${p.zoom ?? '?'}`;
  } catch (e) { $('ptzPosMsg').textContent = '✗ ' + e; }
});
// Dynamically-built CamSwitcher view inputs → refresh on edit (event delegation).
$('csViewRows').addEventListener('input', () => { refreshDerived(); saveDraft(); });
['latitude','longitude'].forEach((k) => $(k).addEventListener('input', () => { syncLocationPicker(); updateMap(); }));

// ── Leaflet map (free OSM tiles + optional RainViewer storm radar) ────────────
let map = null, mapLayers = [], radarLayer = null, mapReady = false, stormLayers = [];

/** Plot the top storm cells as red dots. The active/selected one gets a ring.
 *  In manual mode, clicking a dot locks the camera to that direction. */
function updateStormMarkers(spots, activeBearing, manualOn) {
  if (!mapReady || !map) return;
  stormLayers.forEach((l) => map.removeLayer(l));
  stormLayers = [];
  if (!Array.isArray(spots) || !spots.length) return;
  const lat = num($('latitude').value), lon = num($('longitude').value);
  const maxI = Math.max(...spots.map((s) => s.intensity), 0.001);
  // The dot to emphasize: in manual mode the locked/active one; in auto mode the
  // strongest cell (spots are sorted strongest-first by the backend).
  const hiBearing = manualOn ? (activeBearing != null ? activeBearing : (spots[0] && spots[0].bearing))
                             : (spots[0] && spots[0].bearing);
  spots.forEach((s) => {
    const p = destPoint(lat, lon, Number(s.bearing), Number(s.distance) || 0);
    const isActive = hiBearing != null && Math.abs(((s.bearing - hiBearing + 540) % 360) - 180) < 8;
    // Tropical cyclones: spinning 🌀 marker (cyan). NWS alerts: purple. Storms: red.
    if (s.tc) {
      const size = isActive ? 34 : 28;
      const inner = `<div class="tc-marker${isActive ? ' tc-active' : ''}" style="width:${size}px;height:${size}px;cursor:${manualOn ? 'pointer' : 'default'}">🌀</div>`;
      const m = L.marker(p, {
        riseOnHover: true, zIndexOffset: isActive ? 1200 : 200,
        icon: L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], html: inner }),
      }).addTo(map).bindTooltip(`🌀 ${s.event || 'Tropical cyclone'} · ${Math.round(s.bearing)}° ${compass(s.bearing)} · ${Math.round(dispDist(s.distance))} ${distUnit()} · intensity ${s.intensity.toFixed(1)}${isActive ? ' · FOLLOWING' : ''}${manualOn ? ' · click to lock' : ''}`);
      if (manualOn) m.on('click', () => setManual(true, s.bearing));
      stormLayers.push(m);
      return;
    }
    const col = s.event ? '#9333ea' : '#d9342b';                 // NWS alerts purple, storms red
    const glow = s.event ? '147,51,234' : '217,52,43';
    const base = 11 + Math.round(10 * (s.intensity / maxI));     // 11–21px by strength
    const size = isActive ? base + 9 : base;                     // followed one is clearly bigger
    const inner = isActive
      ? `<div class="storm-active" style="background:${col};border:3px solid #fff;border-radius:50%;width:${size}px;height:${size}px;cursor:${manualOn ? 'pointer' : 'default'}"></div>`
      : `<div style="background:${col};border:1px solid #fff;opacity:.8;border-radius:50%;width:${size}px;height:${size}px;cursor:${manualOn ? 'pointer' : 'default'};box-shadow:0 0 5px rgba(${glow},.7)"></div>`;
    const tag = s.event ? `⚠ ${s.event}` : '⛈';
    const m = L.marker(p, {
      riseOnHover: true, zIndexOffset: isActive ? 1000 : 0,
      icon: L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], html: inner }),
    }).addTo(map).bindTooltip(`${tag} · ${Math.round(s.bearing)}° ${compass(s.bearing)} · ${Math.round(dispDist(s.distance))} ${distUnit()} · intensity ${s.intensity.toFixed(1)}${isActive ? ' · FOLLOWING' : ''}${manualOn ? ' · click to lock' : ''}`);
    if (manualOn) m.on('click', () => setManual(true, s.bearing));
    stormLayers.push(m);
  });
}

// Set manual mode / locked bearing on the backend, then refresh.
async function setManual(mode, bearing) {
  try {
    const body = {};
    if (mode != null) body.mode = mode;
    if (bearing !== undefined) body.bearing = bearing;
    await fetch(API('manual.cgi'), { method: 'POST', body: JSON.stringify(body) });
    setTimeout(poll, 600);
  } catch (e) { msg('Manual mode failed: ' + e, 'err'); }
}
const hasLeaflet = typeof L !== 'undefined';

function initMap() {
  if (!hasLeaflet) {
    // Offline / CDN blocked → fall back to the self-contained canvas compass.
    $('compassFallback').style.display = 'flex';
    $('map').style.display = 'none';
    return;
  }
  const lat = num($('latitude').value) || 50.0755;
  const lon = num($('longitude').value) || 14.4378;
  map = L.map('map', { zoomControl: true, attributionControl: true }).setView([lat, lon], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap',
  }).addTo(map);
  mapReady = true;
  updateMap();
  // Radar is on by default — load it once the map is ready.
  if ($('radar_toggle').checked) toggleRadar(true);
}

function clearMapLayers() {
  mapLayers.forEach((l) => map.removeLayer(l));
  mapLayers = [];
}

function updateMap() {
  if (!mapReady || !map) return;
  const lat = num($('latitude').value), lon = num($('longitude').value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#1f6feb';
  const radiusKm = scanRadiusKm();
  const va = isViewAreaMode();
  const sv = sectorViews();
  const n = sv.length;

  clearMapLayers();

  // Scan-radius ring.
  mapLayers.push(L.circle([lat, lon], {
    radius: radiusKm * 1000, color: accent, weight: 1, fillColor: accent, fillOpacity: 0.06,
  }).addTo(map));

  // Camera marker.
  mapLayers.push(L.marker([lat, lon]).addTo(map).bindPopup(
    `📷 ${$('location_name').value || 'Camera'}<br>${lat.toFixed(4)}, ${lon.toFixed(4)}`));

  // PTZ-track mode: show the camera's reference (pan 0) direction plus the
  // configurable left/right pan reach as a shaded coverage wedge.
  if (isPtzTrackMode()) {
    const ref = norm360(num($('ptz_ref_bearing').value));
    const left = Math.max(0, Math.min(180, num($('ptz_arc_left_deg').value)));
    const right = Math.max(0, Math.min(180, num($('ptz_arc_right_deg').value)));
    const span = left + right;
    if (span > 0 && span < 360) {
      const pts = [[lat, lon]];
      const STEPS = 36;
      for (let s = 0; s <= STEPS; s++) pts.push(destPoint(lat, lon, (ref - left) + (s / STEPS) * span, radiusKm));
      mapLayers.push(L.polygon(pts, { color: accent, weight: 1.5, opacity: 0.85, fillColor: accent, fillOpacity: 0.12 })
        .addTo(map).bindTooltip(`PTZ pan reach · ${left}° left + ${right}° right`));
    } else if (span >= 360) {
      mapLayers.push(L.circle([lat, lon], { radius: radiusKm * 1000, color: accent, weight: 1.5, fillColor: accent, fillOpacity: 0.10 })
        .addTo(map).bindTooltip('PTZ pan reach · full 360°'));
    }
    const end = destPoint(lat, lon, ref, radiusKm);
    mapLayers.push(L.polyline([[lat, lon], end], { color: accent, weight: 2, dashArray: '6 5', opacity: 0.9 }).addTo(map).bindTooltip(`Camera home (pan 0) · ${Math.round(ref)}° ${compass(ref)}`));
  }

  // Coverage wedges, centered on each sector's (possibly explicit) bearing.
  const coverage = num($('coverage_deg').value) === 180 ? 180 : 360;
  const half = (coverage / Math.max(1, n)) / 2;
  const STEPS = 10;
  sv.forEach((v, i) => {
    const b = v.bearing;
    const c = v.color || accent;
    const lbl = va ? `V${v.slot}` : `${v.presetNo}`;
    const nm = v.title ? ' · ' + v.title : '';
    const tip = `${va ? 'View ' + v.slot : 'Preset ' + v.presetNo}${nm} · ${Math.round(b)}° ${compass(b)}`;
    const pts = [[lat, lon]];
    for (let s = 0; s <= STEPS; s++) {
      const ang = (b - half) + (s / STEPS) * (2 * half);
      pts.push(destPoint(lat, lon, ang, radiusKm));
    }
    mapLayers.push(L.polygon(pts, {
      color: c, weight: 1.5, opacity: 0.85, fillColor: c, fillOpacity: 0.18,
    }).addTo(map).bindTooltip(tip));
    const mid = destPoint(lat, lon, b, radiusKm * 0.78);
    mapLayers.push(L.marker(mid, {
      icon: L.divIcon({
        className: '', html: `<div style="background:${c};color:#fff;border-radius:50%;min-width:20px;height:20px;padding:0 4px;display:flex;align-items:center;justify-content:center;font:bold 11px sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.4)">${lbl}</div>`,
        iconSize: null, iconAnchor: [10, 10],
      }),
    }).addTo(map).bindTooltip(tip));
  });
}

function recenter() {
  if (!mapReady) return;
  const lat = num($('latitude').value), lon = num($('longitude').value);
  map.fitBounds(L.latLng(lat, lon).toBounds(scanRadiusKm() * 2200));
}

async function toggleRadar(on) {
  if (!mapReady) return;
  if (radarLayer) { map.removeLayer(radarLayer); radarLayer = null; }
  if (!on) return;
  try {
    const meta = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
    const frames = (meta.radar && meta.radar.past) || [];
    const last = frames[frames.length - 1];
    if (!last) { msg('No radar data available right now.', 'err'); $('radar_toggle').checked = false; return; }
    // color scheme 2, smooth on, snow on
    radarLayer = L.tileLayer(`${meta.host}${last.path}/256/{z}/{x}/{y}/2/1_1.png`, {
      opacity: 0.6, zIndex: 400,
    }).addTo(map);
  } catch (e) {
    msg('Radar load failed (needs internet): ' + e, 'err');
    $('radar_toggle').checked = false;
  }
}

let resizeT = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (mapReady && map) map.invalidateSize(); }, 200);
});

$('unit_system').addEventListener('change', onUnitChange);
$('radar_toggle').addEventListener('change', (e) => toggleRadar(e.target.checked));
$('manual_toggle').addEventListener('change', (e) => setManual(e.target.checked, e.target.checked ? undefined : null));
$('recenterBtn').addEventListener('click', recenter);
['scan_radius_km'].forEach((k) => $(k).addEventListener('input', updateMap));

// ── Fetch view areas & presets from the camera ───────────────────────────────
let lastViewAreas = [];

function connSettings() {
  return {
    camera_ip: $('camera_ip').value,
    camera_user: $('camera_user').value,
    camera_pass: $('camera_pass').value,
    use_cloud: $('use_cloud').checked,
    cloud_url: $('cloud_url').value,
    device_access_token: $('device_access_token').value,
  };
}

function applyViewArea(va) {
  if (!va) return;
  $('ptz_channel').value = va.camera;
  const ps = va.presets || [];
  // Populate the preset dropdowns and auto-assign each slot to a preset in order.
  populatePresetPickers(ps);
  $('pp_count').value = Math.max(1, Math.min(8, ps.length || 1));
  for (let i = 1; i <= 8; i++) {
    if (i <= ps.length) {
      $(`pp_preset_${i}`).value = ps[i - 1].no;
      if ($(`pp_name_${i}`)) $(`pp_name_${i}`).value = ps[i - 1].name || '';
      if ($(`pp_pick_${i}`)) $(`pp_pick_${i}`).value = String(ps[i - 1].no);
    }
  }
  // Render the preset names so the user can sanity-check the assignment.
  $('presetList').innerHTML = ps.length
    ? 'Presets: ' + ps.map((p) => `<b>${p.no}</b>·${p.name || '—'}`).join(' &nbsp; ')
    : 'No presets defined on this view area.';
  refreshDerived();
}

/** Fill the PTZ-preset dropdowns with a view area's presets. */
function populatePresetPickers(presets) {
  const esc = (s) => String(s).replace(/"/g, '&quot;');
  const opts = '<option value="">— pick from camera —</option>' +
    (presets || []).map((p) => `<option value="${p.no}" data-nice="${esc(p.name || '')}">#${p.no} · ${p.name || '—'}</option>`).join('');
  document.querySelectorAll('.pppick').forEach((s) => { const cur = s.value; s.innerHTML = opts; s.value = cur; s.style.display = 'block'; });
}

function renderViewAreas(viewAreas, apply = true) {
  lastViewAreas = viewAreas || [];
  const sel = $('viewarea_select');
  sel.innerHTML = '';
  lastViewAreas.forEach((va, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `View area ${va.camera} — ${va.presets.length} preset(s)`;
    sel.appendChild(o);
  });
  $('viewAreaWrap').style.display = lastViewAreas.length ? 'block' : 'none';
  if (lastViewAreas.length) {
    // Prefer the view area matching the current PTZ channel, else the first.
    const ch = num($('ptz_channel').value);
    const idx = Math.max(0, lastViewAreas.findIndex((v) => v.camera === ch));
    sel.value = String(idx);
    if (apply) {
      // Fresh fetch: apply the selected view area (fills the preset fields).
      applyViewArea(lastViewAreas[idx]);
    } else {
      // Restore from cache: show the picker options + preset list, but DON'T
      // overwrite the user's saved preset assignments.
      const va = lastViewAreas[idx];
      populatePresetPickers(va.presets);
      $('presetList').innerHTML = va.presets.length
        ? 'Presets: ' + va.presets.map((p) => `<b>${p.no}</b>·${p.name || '—'}`).join(' &nbsp; ')
        : 'No presets defined on this view area.';
    }
  }
}

$('viewarea_select').addEventListener('change', () => {
  applyViewArea(lastViewAreas[Number($('viewarea_select').value)]);
});

// Mirror the fetch-presets status to both buttons (connection card + coverage card).
function presetMsg(t) {
  $('presetFetchMsg').textContent = t;
  if ($('ppFetchMsg')) $('ppFetchMsg').textContent = t;
}
async function fetchPresets() {
  const c = connSettings();
  if (!c.use_cloud && !c.camera_ip) { presetMsg('Enter camera IP first.'); return; }
  presetMsg('Querying camera…');
  $('fetchPresetsBtn').disabled = true;
  try {
    const r = await fetch(API('presets.cgi'), { method: 'POST', body: JSON.stringify(c) });
    const j = await r.json();
    if (!j.ok) { presetMsg('✗ ' + (j.error || 'failed')); return; }
    const total = (j.viewAreas || []).reduce((n, v) => n + v.presets.length, 0);
    renderViewAreas(j.viewAreas);
    cacheLists({ viewAreas: j.viewAreas || [] });
    presetMsg(`✓ ${j.viewAreas.length} view area(s), ${total} preset(s)`);
  } catch (e) {
    presetMsg('✗ ' + e);
  } finally {
    $('fetchPresetsBtn').disabled = false;
  }
}

$('fetchPresetsBtn').addEventListener('click', fetchPresets);

// Auto-fetch once IP + user + password are all filled (debounced).
let autoFetchTimer = null;
function maybeAutoFetch() {
  const c = connSettings();
  const ready = (c.use_cloud && c.cloud_url) || (c.camera_ip && c.camera_user && c.camera_pass);
  if (!ready) return;
  clearTimeout(autoFetchTimer);
  autoFetchTimer = setTimeout(fetchPresets, 600);
}
['camera_ip', 'camera_user', 'camera_pass', 'cloud_url', 'device_access_token']
  .forEach((k) => $(k).addEventListener('change', maybeAutoFetch));

// ── Status polling ───────────────────────────────────────────────────────────
async function poll() {
  try {
    const s = await (await fetch(API('status.cgi'))).json();
    $('runPill').textContent = s.enabled ? 'RUNNING' : 'DISABLED';
    $('runPill').className = 'pill ' + (s.enabled ? 'on' : 'off');
    const vb = document.getElementById('verBadge');
    if (vb && s.version) vb.textContent = 'v' + s.version;
    const cs = s.currentStatus || {};
    $('st_status').textContent = cs.status ?? '—';
    $('st_preset').textContent = cs.preset ?? s.currentPreset ?? '—';
    $('st_bearing').textContent = cs.bearing == null ? '—' : Math.round(cs.bearing) + '° ' + compass(cs.bearing);
    $('st_dist').textContent = cs.distance == null ? '—' : Math.round(dispDist(cs.distance)) + ' ' + distUnit();
    $('st_int').textContent = cs.intensity == null ? '—' : Number(cs.intensity).toFixed(1);
    // Reflect manual state and plot the red dots.
    if (document.activeElement !== $('manual_toggle')) $('manual_toggle').checked = !!s.manualMode;
    const active = s.manualMode ? (s.manualBearing != null ? s.manualBearing : cs.bearing) : cs.bearing;
    updateStormMarkers(s.topSpots, active, !!s.manualMode);
    $('manualHint').textContent = !s.manualMode ? ''
      : (s.manualBearing != null ? `🔒 locked ${Math.round(s.manualBearing)}° ${compass(s.manualBearing)}` : 'auto-strongest (click a dot to lock)');
    $('st_last').textContent = s.lastFetch || '—';
    $('st_next').textContent = s.nextFetch || '—';
    $('st_count').textContent = s.fetchCount ?? 0;
    if ($('st_source')) $('st_source').textContent = s.source || '—';
    if (Array.isArray(s.log)) $('log').textContent = s.log.slice(-40).join('\n');
    if (s.lastError) msg('Last error: ' + s.lastError, 'err');
  } catch {}
}

// Autosave a draft on any edit to any setting field.
[...FIELDS.bool, ...FIELDS.num, ...FIELDS.str].forEach((k) => {
  const el = $(k);
  if (el) { el.addEventListener('input', saveDraft); el.addEventListener('change', saveDraft); }
});

// Info (i) icons — toggle the explanation panel right after each card header.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.infobtn');
  if (!btn) return;
  const info = btn.closest('h2').nextElementSibling;
  if (info && info.classList.contains('cardinfo')) info.classList.toggle('open');
});

// Export current settings to a JSON file the user can save/share.
function exportSettings() {
  const data = collect();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `storm_chaser_settings_${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  msg('Settings exported to JSON.', 'ok');
}

// Import settings from a JSON file → populate the form (then user clicks Save).
function importSettings(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!obj || typeof obj !== 'object') throw new Error('not an object');
      fill({ ...collect(), ...obj }); // keep current values for any missing keys
      saveDraft();
      msg('Settings imported — review, then "Save & restart" to apply.', 'ok');
    } catch (e) {
      msg('Import failed: invalid JSON (' + e.message + ')', 'err');
    }
  };
  reader.readAsText(file);
}

// ── Fetch CamSwitcher playlists from the camera ──────────────────────────────
let csPlaylists = [];
function populatePlaylistPickers() {
  const icon = (t) => t === 'camera' ? '📷' : (t === 'playlist' ? '🎬' : '•');
  const esc = (s) => String(s).replace(/"/g, '&quot;');
  const opts = '<option value="">— pick from camera —</option>' +
    csPlaylists.map((p) => `<option value="${p.id}" data-nice="${esc(p.niceName)}">${icon(p.type)} ${p.niceName} (${p.id.slice(0, 8)}…)</option>`).join('');
  document.querySelectorAll('.cspick').forEach((s) => {
    const cur = s.value; s.innerHTML = opts; s.value = cur; s.style.display = 'block';
  });
}
async function fetchPlaylists() {
  const c = connSettings();
  if (!c.use_cloud && !c.camera_ip) { $('csFetchMsg').textContent = 'Enter camera IP first.'; return; }
  $('csFetchMsg').textContent = 'Querying CamSwitcher…';
  $('fetchPlaylistsBtn').disabled = true;
  try {
    const r = await fetch(API('playlists.cgi'), { method: 'POST', body: JSON.stringify(c) });
    const j = await r.json();
    if (!j.ok) {
      $('csFetchMsg').innerHTML = j.notInstalled
        ? '<span style="color:var(--danger)">✗ CamSwitcher app not installed/running on this camera.</span>'
        : '✗ ' + (j.error || 'failed');
      return;
    }
    csPlaylists = j.playlists || [];
    populatePlaylistPickers();
    cacheLists({ playlists: csPlaylists });
    const cams = csPlaylists.filter((p) => p.type === 'camera').length;
    const pls = csPlaylists.filter((p) => p.type === 'playlist').length;
    $('csFetchMsg').textContent = `✓ ${csPlaylists.length} found (${cams} camera, ${pls} playlist)`;
  } catch (e) {
    $('csFetchMsg').textContent = '✗ ' + e;
  } finally {
    $('fetchPlaylistsBtn').disabled = false;
  }
}
$('fetchPlaylistsBtn').addEventListener('click', fetchPlaylists);
// Picking a playlist fills the matching URL/playlist_name field.
$('viewareaModeBox').addEventListener('change', (e) => {
  const sel = e.target.closest('.cspick');
  if (!sel) return;
  const t = $(sel.dataset.target);
  if (t && sel.value) {
    t.value = sel.value;
    // Capture the playlist's nice name so it shows on the overlay/status.
    const nameEl = sel.dataset.name && $(sel.dataset.name);
    if (nameEl) nameEl.value = sel.options[sel.selectedIndex].dataset.nice || '';
    refreshDerived(); saveDraft();
  }
});

$('exportBtn').addEventListener('click', exportSettings);
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) importSettings(e.target.files[0]);
  e.target.value = '';
});

$('saveBtn').addEventListener('click', save);
$('reloadBtn').addEventListener('click', discardAndReload);
$('refreshBtn').addEventListener('click', async () => { await fetch(API('refresh.cgi')); msg('Scan triggered.', 'ok'); setTimeout(poll, 1500); });
$('logBtn').addEventListener('click', poll);

// Move the Map and Live-status cards into the sticky right-hand monitor panel
// (map on top, log right beneath it) so they stay visible while editing.
(function buildMonitor() {
  const mon = $('monitor'), mapC = $('mapCard'), st = $('statusCard');
  if (mon && mapC) mon.appendChild(mapC);
  if (mon && st) mon.appendChild(st);
})();

initMap();
load().then(() => { if (mapReady) setTimeout(() => { map.invalidateSize(); updateMap(); }, 200); poll(); setInterval(poll, 5000); });

// Installed version is shown from status.cgi in poll() (works through the cloud
// proxy). Try the static manifest.json too as an early/local fast-path, but
// never blank the badge on failure — leave whatever poll() set.
(function showVersion() {
  const badge = document.getElementById('verBadge');
  if (!badge) return;
  fetch(`/local/camscripter/package/${PKG}/manifest.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((m) => { if (m.package_version) badge.textContent = 'v' + m.package_version; })
    .catch(() => {});
})();
