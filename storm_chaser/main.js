'use strict';
/**
 * storm_chaser — CamScripter microapp
 * =====================================================================
 * Points an Axis PTZ camera at the strongest nearby storm cell by calling
 * camera **preset positions**. The operator pre-aims a ring of presets around
 * the camera (e.g. 8 presets every 45° for full 360°, or N presets across a
 * 180° arc facing one direction). This script figures out *where* the strongest
 * convective activity / lightning is right now and tells the camera to go to
 * the preset that looks in that direction.
 *
 * DATA SOURCE — free Open-Meteo Forecast API (no API key):
 *   https://api.open-meteo.com/v1/forecast
 * Open-Meteo accepts comma-separated latitude/longitude lists, so the whole
 * grid of probe points is fetched in a SINGLE request and returned as an array.
 * We probe a fan of points (rings × bearings) around the camera location and
 * score each with a storm-intensity formula:
 *
 *   intensity = w_lightning · lightning_potential
 *             + w_cape      · cape
 *             + w_precip     · precipitation
 *             + w_gust       · wind_gusts_10m
 *
 *   lightning_potential (J/kg) and cape (J/kg) are hourly variables; we read
 *   the value for the current hour. precipitation (mm) and wind_gusts_10m
 *   (km/h) are current variables.
 *
 * MOVEMENT — bearing → preset sector mapping with hysteresis + dwell:
 *   • coverage_deg 360: N presets evenly spaced, preset i centered on
 *     center_bearing + i·(360/N).
 *   • coverage_deg 180: N presets across a 180° arc centered on
 *     center_bearing (i.e. center_bearing ± 90°). Storms outside the arc are
 *     ignored (camera holds / goes home).
 *   • Hysteresis: the camera only re-aims when the storm bearing leaves the
 *     current preset's sector by more than hysteresis_deg AND at least
 *     dwell_min minutes have passed since the last move. Prevents jitter
 *     between adjacent presets.
 *   • If the strongest cell is below intensity_threshold (no real storm), the
 *     camera goes to home_preset (set 0 to disable / hold position).
 *
 * VAPIX PTZ preset call (by number):
 *   /axis-cgi/com/ptz.cgi?camera=<ch>&gotoserverpresetno=<N>
 *
 * Optional CamOverlay InfoTicker shows live status (bearing, distance,
 * intensity, active preset).
 */

const fs = require('fs');
const path = require('path');
const { HttpServer } = require('camstreamerlib/HttpServer');
const { CameraVapix } = require('camstreamerlib/CameraVapix');

/** Strip HTML tags / collapse whitespace from camera error bodies for clean logs. */
function cleanErr(body) {
    return String(body).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/** True when the configured local camera should be reached over HTTPS. */
function cameraTls(conn) {
    return String((conn || settings).camera_protocol || 'http').toLowerCase() === 'https';
}

/** Effective TCP port: explicit override, else the protocol default (80/443). */
function cameraPort(conn) {
    const p = Number((conn || settings).camera_port) || 0;
    return p > 0 ? p : (cameraTls(conn) ? 443 : 80);
}

/**
 * CameraVapix client for the configured LOCAL camera (handles digest auth).
 * Honours the HTTP/HTTPS protocol and port settings. For HTTPS we set
 * tlsInsecure so cameras with self-signed / untrusted certificates still work
 * (the common case for Axis devices on a LAN).
 */
function localVapix(conn) {
    const tls = cameraTls(conn);
    const opts = {
        ip: (conn || settings).camera_ip || '127.0.0.1',
        port: cameraPort(conn),
        user: (conn || settings).camera_user || 'root',
        pass: (conn || settings).camera_pass || '',
        tls,
    };
    if (tls) opts.tlsInsecure = true;   // accept untrusted/self-signed HTTPS certs
    return new CameraVapix(opts);
}

const SETTINGS_PATH = path.join(process.env.PERSISTENT_DATA_PATH ?? '.', 'settings.json');
const PKG = process.env.PACKAGE_NAME ?? 'storm_chaser';

// Read our own version from the installed manifest so the UI can show it
// reliably — the browser can't always fetch manifest.json through the cloud
// (device-connect.net) proxy, but it can always reach status.cgi.
const PACKAGE_VERSION = (() => {
    for (const p of [path.join(process.env.INSTALL_PATH ?? '.', 'manifest.json'),
                     path.join(__dirname, 'manifest.json'), 'manifest.json']) {
        try { return JSON.parse(fs.readFileSync(p, 'utf8')).package_version || ''; } catch {}
    }
    return '';
})();

const DEFAULT_SETTINGS = {
    enabled: true,

    camera_ip: '127.0.0.1',
    camera_protocol: 'http',    // 'http' or 'https' (https accepts untrusted certs)
    camera_port: 0,             // 0 = use protocol default (80 for http, 443 for https)
    camera_user: 'root',
    camera_pass: '',
    use_cloud: false,
    cloud_url: '',
    device_access_token: '',
    ptz_channel: 1,

    latitude: 50.0686,
    longitude: 14.4030,
    location_name: 'CamStreamer HQ, Prague',
    unit_system: 'imperial',    // 'imperial' (miles) or 'metric' (km) — display only

    // Targeting mode: 'presets' (PTZ presets), 'camswitcher' (switch views), or
    // 'ptztrack' (continuous absolute pan/tilt/zoom toward the storm).
    target_mode: 'camswitcher',

    // PTZ tracking mode (continuous absolute positioning)
    ptz_ref_bearing: 180,       // compass bearing the camera faces at pan 0 (home)
    ptz_pan_flip: false,        // invert pan sign if the camera pans the other way
    ptz_tilt: 0,                // fixed tilt in degrees (0 = horizon)
    ptz_zoom_min_pct: 0,        // zoom % for the nearest storms (wide)
    ptz_zoom_max_pct: 80,       // zoom % for the farthest storms (tele)
    // Pan limits for PTZ tracking, measured from the reference bearing (pan 0).
    // "Left" = counter-clockwise (e.g. West when facing North), "right" =
    // clockwise (East when facing North). Storms outside [-left, +right] are
    // ignored and the camera holds/returns home. 180 + 180 = full circle.
    ptz_arc_left_deg: 90,
    ptz_arc_right_deg: 90,
    // CamSwitcher: up to 5 views, each with a facing bearing + full URL (or just
    // playlist_name). cs_home_url is called when there is no storm.
    cs_view_count: 3,
    cs_home_url: '', cs_home_name: '',
    cs_view_1_url: '', cs_view_1_bearing: 0, cs_view_1_name: '',
    cs_view_2_url: '', cs_view_2_bearing: 120, cs_view_2_name: '',
    cs_view_3_url: '', cs_view_3_bearing: 240, cs_view_3_name: '',
    cs_view_4_url: '', cs_view_4_bearing: 90, cs_view_4_name: '',
    cs_view_5_url: '', cs_view_5_bearing: 300, cs_view_5_name: '',

    // Preset geometry
    coverage_deg: 360,          // 360 (full circle) or 180 (one-sided arc)
    center_bearing_deg: 0,      // 360: bearing of preset #1; 180: center of the arc
    pp_count: 3,                // number of preset slots (max 8); each maps a direction → preset
    home_preset: 0,             // preset to use when no storm (0 = hold position)

    // Storm probe grid
    scan_radius_km: 80,
    scan_rings: 2,              // keep probe-point count modest to respect API quota
    samples_per_ring: 12,       // 2×12 = 24 points/scan
    top_spots: 5,               // how many strongest cells (red dots) to surface

    // Optional severe-weather alert source (US National Weather Service, no key).
    nws_enabled: false,         // fetch active NWS warnings near the camera
    nws_override: true,         // a tornado/severe/hurricane WARNING overrides storms

    // Global tropical-cyclone tracking via GDACS (free, keyless, worldwide —
    // covers Japan/Western Pacific typhoons, Atlantic/Pacific hurricanes, etc.).
    typhoon_enabled: false,
    typhoon_override: true,     // an in-range cyclone overrides the local storm score
    typhoon_range_km: 1500,     // aim at cyclones whose centre is within this distance

    // Intensity weights + trigger
    w_lightning: 1.0,
    w_cape: 0.002,
    w_precip: 0.15,
    w_gust: 0.02,
    intensity_threshold: 1.0,

    // Timing / smoothing
    update_interval_min: 5,     // how often to re-check (keeps daily API calls in budget)
    dwell_min: 2,               // min minutes on a preset before a routine switch
    hysteresis_deg: 10,
    switch_margin: 0.25,        // a storm this much stronger overrides dwell (0.25 = 25%)

    // Optional overlay
    overlay_enabled: false,
    infoticker_service_id: 6,
    infoticker_template:
        'STORM CHASER | {status} | bearing {bearing}° ({compass}) | {distance} {dist_unit} | intensity {intensity} | preset {preset}',

    // CamOverlay Custom Graphics: map each variable to a field name (blank = skip).
    cg_enabled: false,
    cg_service_id: 1,
    cg_field_status: '', cg_field_bearing: '', cg_field_compass: '', cg_field_distance: '',
    cg_field_dist_unit: '', cg_field_intensity: '', cg_field_preset: '', cg_field_location: '', cg_field_time: '',
};

const KM_PER_MI = 1.60934;

// PTZ-preset slot defaults (preset number, facing bearing, nice name) for 8 slots.
for (let i = 1; i <= 8; i++) {
    DEFAULT_SETTINGS[`pp_preset_${i}`] = 0;
    DEFAULT_SETTINGS[`pp_bearing_${i}`] = Math.round(((i - 1) * 360) / 3) % 360;
    DEFAULT_SETTINGS[`pp_name_${i}`] = '';
}

function loadSettings() {
    try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}
let settings = loadSettings();

// ─────────────────────────────────────────────────────────────────────────────
// Geo helpers
// ─────────────────────────────────────────────────────────────────────────────
const EARTH_R = 6371; // km
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const norm360 = (d) => ((d % 360) + 360) % 360;

/** Smallest absolute angular difference between two bearings (0..180). */
function angDiff(a, b) {
    const d = Math.abs(norm360(a) - norm360(b));
    return d > 180 ? 360 - d : d;
}

/** Destination point given start lat/lon, bearing (deg) and distance (km). */
function destPoint(lat, lon, bearingDeg, distKm) {
    const ang = distKm / EARTH_R;
    const br = toRad(bearingDeg);
    const lat1 = toRad(lat);
    const lon1 = toRad(lon);
    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(br)
    );
    const lon2 =
        lon1 +
        Math.atan2(
            Math.sin(br) * Math.sin(ang) * Math.cos(lat1),
            Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2)
        );
    return { lat: toDeg(lat2), lon: norm360(toDeg(lon2) + 180) - 180 };
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass = (deg) => COMPASS[Math.round(norm360(deg) / 22.5) % 16];

/** Initial bearing from point 1 to point 2 (degrees). */
function bearingTo(lat1, lon1, lat2, lon2) {
    const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return norm360(toDeg(Math.atan2(y, x)));
}
/** Great-circle distance in km. */
function haversineKm(lat1, lon1, lat2, lon2) {
    const φ1 = toRad(lat1), φ2 = toRad(lat2), dφ = toRad(lat2 - lat1), dλ = toRad(lon2 - lon1);
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
    return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────────────────────
// US National Weather Service severe-weather alerts (free, no API key)
// ─────────────────────────────────────────────────────────────────────────────
/** Intensity weight for an NWS event so WARNINGS dominate the storm score. */
function nwsSeverity(event) {
    const e = String(event).toLowerCase();
    if (e.includes('tornado') && e.includes('warning')) return 100;
    if (e.includes('hurricane') && e.includes('warning')) return 95;
    if (e.includes('typhoon') && e.includes('warning')) return 95;
    if (e.includes('severe thunderstorm') && e.includes('warning')) return 80;
    if (e.includes('tropical storm') && e.includes('warning')) return 70;
    if (e.includes('tornado')) return 60;      // watch
    if (e.includes('hurricane') || e.includes('typhoon')) return 55;
    if (e.includes('severe thunderstorm')) return 50;
    if (e.includes('flash flood') && e.includes('warning')) return 45;
    return 0;                                   // ignore non-severe advisories
}
/** Average centroid of a GeoJSON geometry's coordinates. */
function geomCentroid(geom) {
    if (!geom || !geom.coordinates) return null;
    const pts = [];
    const walk = (a) => {
        if (typeof a[0] === 'number') pts.push(a);
        else a.forEach(walk);
    };
    walk(geom.coordinates);
    if (!pts.length) return null;
    let sx = 0, sy = 0;
    for (const [lon, lat] of pts) { sx += lon; sy += lat; }
    return { lon: sx / pts.length, lat: sy / pts.length };
}
/**
 * Fetch active NWS warnings near the camera and turn them into storm "spots".
 * US-only. Returns [{ bearing, dist, intensity, event, nws:true }] (may be []).
 */
async function fetchNwsAlerts(lat, lon) {
    const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}&status=actual`;
    const resp = await fetch(url, {
        headers: { 'User-Agent': 'StormChaser-CamScripter/4.0.0 (camstreamer)', Accept: 'application/geo+json' },
        signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error(`NWS HTTP ${resp.status}`);
    const data = await resp.json();
    const out = [];
    for (const f of (data.features || [])) {
        const event = (f.properties && f.properties.event) || '';
        const sev = nwsSeverity(event);
        if (sev <= 0) continue;
        const c = geomCentroid(f.geometry);
        // If the alert has no polygon it covers the camera's zone → treat as overhead.
        const bearing = c ? bearingTo(lat, lon, c.lat, c.lon) : 0;
        const dist = c ? haversineKm(lat, lon, c.lat, c.lon) : 0;
        out.push({ bearing, dist, intensity: sev, event, nws: true });
    }
    out.sort((a, b) => b.intensity - a.intensity);
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Global tropical cyclones (typhoons / hurricanes) via GDACS — free, keyless,
// worldwide. Unlike the US-only NWS feed this covers Japan and every other
// cyclone basin. Each event is a current-position point with an alert level
// (Green/Orange/Red) and max wind speed.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTropicalCyclones(lat, lon) {
    const url = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP?eventlist=TC';
    const resp = await fetch(url, {
        headers: { 'User-Agent': 'StormChaser-CamScripter/4.0.0 (camstreamer)', Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`GDACS HTTP ${resp.status}`);
    const data = await resp.json();
    const feats = Array.isArray(data && data.features) ? data.features : [];
    const range = Math.max(50, Number(settings.typhoon_range_km) || 1500);
    const out = [];
    for (const f of feats) {
        const p = (f && f.properties) || {};
        // The endpoint mixes hazard types; keep only current tropical cyclones.
        if (String(p.eventtype) !== 'TC' || String(p.iscurrent) !== 'true') continue;
        const c = f.geometry && f.geometry.coordinates;        // [lon, lat]
        if (!Array.isArray(c) || c.length < 2) continue;
        const tcLon = Number(c[0]), tcLat = Number(c[1]);
        if (!isFinite(tcLat) || !isFinite(tcLon)) continue;
        const dist = haversineKm(lat, lon, tcLat, tcLon);
        if (dist > range) continue;
        const bearing = bearingTo(lat, lon, tcLat, tcLon);
        const lvl = String(p.alertlevel || '').toLowerCase();
        const wind = Number(p.severitydata && p.severitydata.severity) || 0;   // km/h
        // High base intensity so a cyclone dominates the storm score, scaled by
        // alert level and max wind so a Red super-typhoon outranks a weak one.
        const base = lvl === 'red' ? 90 : lvl === 'orange' ? 75 : 60;
        const intensity = base + wind / 10;
        out.push({ bearing, dist, intensity, event: p.eventname || p.name || 'Tropical Cyclone', tc: true });
    }
    out.sort((a, b) => b.intensity - a.intensity);
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Probe grid construction
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Build the list of probe points. Each point carries its own bearing & distance
 * from the camera so we never have to recompute it from lat/lon afterwards.
 */
function buildProbeGrid() {
    const rings = Math.max(1, Number(settings.scan_rings) || 1);
    const perRing = Math.max(1, Number(settings.samples_per_ring) || 1);
    const radius = Math.max(1, Number(settings.scan_radius_km) || 1);

    const coverage = Number(settings.coverage_deg) === 180 ? 180 : 360;
    const center = norm360(Number(settings.center_bearing_deg) || 0);
    const arcStart = coverage === 360 ? 0 : center - 90;

    const points = [];
    for (let r = 1; r <= rings; r++) {
        const dist = (radius * r) / rings;
        for (let s = 0; s < perRing; s++) {
            // Spread samples across the covered arc.
            const frac = coverage === 360 ? s / perRing : s / Math.max(1, perRing - 1);
            const bearing = norm360(arcStart + frac * coverage);
            const { lat, lon } = destPoint(settings.latitude, settings.longitude, bearing, dist);
            points.push({ lat, lon, bearing, dist });
        }
    }
    return points;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset sector mapping
// ─────────────────────────────────────────────────────────────────────────────
/** Extract a CamSwitcher playlist_name from a full URL, or use the raw token. */
function extractPlaylistName(line) {
    const m = String(line).match(/playlist_name=([^&\s]+)/);
    return (m ? m[1] : String(line).trim());
}

const CS_MAX = 5;
function csViewCount() {
    return Math.max(1, Math.min(CS_MAX, Number(settings.cs_view_count) || 1));
}

/**
 * Configured CamSwitcher views with a non-empty URL: [{ name, bearing, slot }].
 * In 360° mode each view uses its explicit bearing. In 180° mode the active
 * views are distributed evenly across the arc by order (adjacent equal slices),
 * so e.g. two views tile the 180° half as two 90° quarters.
 */
function viewBearings() {
    const n = csViewCount();
    const active = [];
    for (let i = 1; i <= n; i++) {
        const name = extractPlaylistName(settings[`cs_view_${i}_url`] || '');
        if (name) active.push({ name, slot: i });
    }
    const arc180 = Number(settings.coverage_deg) === 180;
    const cnt = active.length || 1;
    return active.map((a, idx) => ({
        name: a.name,
        nice: (settings[`cs_view_${a.slot}_name`] || '').trim(),
        slot: a.slot,
        bearing: arc180 ? presetCenterBearing(idx, cnt) : norm360(Number(settings[`cs_view_${a.slot}_bearing`]) || 0),
    }));
}

/** Names only (for counting). */
function parseViews() {
    return viewBearings().map((v) => v.name);
}

/** Number of directional sectors, depending on the targeting mode. */
function sectorCount() {
    if (settings.target_mode === 'camswitcher') return Math.max(1, parseViews().length);
    return Math.max(1, ppViews().length);
}

/** Configured PTZ presets: [{ presetNo, name, bearing, slot }] (180° tiles by order). */
function ppViews() {
    const n = Math.max(1, Math.min(8, Number(settings.pp_count) || 1));
    const arc180 = Number(settings.coverage_deg) === 180;
    const active = [];
    for (let i = 1; i <= n; i++) {
        const no = Number(settings[`pp_preset_${i}`]) || 0;
        if (no) active.push({ slot: i, no, name: (settings[`pp_name_${i}`] || '').trim() });
    }
    const cnt = active.length || 1;
    return active.map((a, idx) => ({
        presetNo: a.no, name: a.name, slot: a.slot,
        bearing: arc180 ? presetCenterBearing(idx, cnt) : norm360(Number(settings[`pp_bearing_${a.slot}`]) || 0),
    }));
}

/** Center bearing of sector index i (0-based) given current geometry. */
function presetCenterBearing(i, n = sectorCount()) {
    const coverage = Number(settings.coverage_deg) === 180 ? 180 : 360;
    const center = norm360(Number(settings.center_bearing_deg) || 0);
    if (coverage === 360) {
        return norm360(center + (i * 360) / n);
    }
    const arcStart = center - 90;
    return norm360(arcStart + ((i + 0.5) * 180) / n);
}

/** Map a storm bearing to the nearest sector index. Returns {index, center, inArc}. */
function sectorForBearing(bearing) {
    const coverage = Number(settings.coverage_deg) === 180 ? 180 : 360;
    const n = sectorCount();
    if (coverage === 180) {
        const center = norm360(Number(settings.center_bearing_deg) || 0);
        if (angDiff(bearing, center) > 90) return { index: -1, center: null, inArc: false };
    }
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < n; i++) {
        const d = angDiff(bearing, presetCenterBearing(i, n));
        if (d < bestDiff) { bestDiff = d; best = i; }
    }
    return { index: best, center: presetCenterBearing(best, n), inArc: true };
}

/**
 * Resolve a storm bearing to a concrete PTZ target.
 *  - 'presets'  mode: rotate preset numbers within one view area (ptz_channel).
 *  - 'camswitcher' mode: pick the CamSwitcher view facing the storm and switch
 *    to its playlist via playlist_switch.cgi.
 * Returns { inArc, channel, presetNo, center, index, key, label }.
 */
function targetForBearing(bearing) {
    const coverage = Number(settings.coverage_deg) === 180 ? 180 : 360;
    if (coverage === 180) {
        const center = norm360(Number(settings.center_bearing_deg) || 0);
        if (angDiff(bearing, center) > 90) return { inArc: false };
    }
    if (settings.target_mode === 'camswitcher') {
        const vb = viewBearings();
        if (!vb.length) return { inArc: false };
        let best = 0, bestDiff = Infinity;
        for (let i = 0; i < vb.length; i++) {
            const d = angDiff(bearing, vb[i].bearing);
            if (d < bestDiff) { bestDiff = d; best = i; }
        }
        const v = vb[best];
        return { inArc: true, kind: 'cs', playlistName: v.name, center: v.bearing, index: best,
                 key: `cs.${v.name}`, label: v.nice || `CamSwitcher view ${best + 1}` };
    }
    // PTZ presets: pick the configured preset whose facing bearing is nearest.
    const pv = ppViews();
    if (!pv.length) return { inArc: false };
    const channel = Number(settings.ptz_channel) || 1;
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < pv.length; i++) {
        const d = angDiff(bearing, pv[i].bearing);
        if (d < bestDiff) { bestDiff = d; best = i; }
    }
    const p = pv[best];
    return { inArc: true, kind: 'ptz', channel, presetNo: p.presetNo, center: p.bearing, index: best,
             key: `p${channel}.${p.presetNo}`, label: p.name || `preset ${p.presetNo}` };
}

/** Parse CamSwitcher playlists.cgi?action=get → [{id, niceName, type}]. */
function parsePlaylists(json) {
    const data = (json && json.data) || {};
    return Object.keys(data).map((id) => ({
        id,
        niceName: (data[id] && data[id].niceName) || id,
        type: id.charAt(0) === 'c' ? 'camera' : (id.charAt(0) === 'p' ? 'playlist' : 'other'),
    }));
}

/**
 * Fetch the list of CamSwitcher playlists (cameras + true playlists) from the
 * camera. Returns { ok, playlists } or { ok:false, notInstalled, error }.
 */
async function queryCamSwitcherPlaylists(conn) {
    const path = '/local/camswitcher/api/playlists.cgi';
    const params = { action: 'get' };
    let status = 0, body = '';
    try {
        if (conn.use_cloud && conn.cloud_url) {
            const qp = new URLSearchParams(params);
            if (conn.device_access_token) qp.set('DEVICE_ACCESS_TOKEN', conn.device_access_token);
            const resp = await fetch(`${conn.cloud_url}${path}?${qp}`, { signal: AbortSignal.timeout(8000) });
            status = resp.status; body = await resp.text().catch(() => '');
        } else {
            const resp = await localVapix(conn).vapixGet(path, params);
            status = resp.status; body = await resp.text().catch(() => '');
        }
    } catch (err) {
        return { ok: false, error: String(err.message || err) };
    }
    // 404 (or auth/route miss) → the CamSwitcher ACAP isn't installed/running.
    if (status === 404) return { ok: false, notInstalled: true, error: 'CamSwitcher app not found on this camera (HTTP 404)' };
    if (!status || status >= 500) return { ok: false, error: `HTTP ${status}` };
    let json;
    try { json = JSON.parse(body); } catch { return { ok: false, notInstalled: true, error: 'No CamSwitcher response (app not installed?)' }; }
    if (!json || json.data === undefined) return { ok: false, notInstalled: true, error: 'CamSwitcher returned no playlist data (app not installed?)' };
    return { ok: true, playlists: parsePlaylists(json) };
}

/** Switch a CamSwitcher view/playlist (local digest auth or cloud token). */
async function switchCamSwitcher(playlistName) {
    if (!playlistName) {
        lastError = 'No CamSwitcher view configured for this sector';
        addLog(`✗ ${lastError}`);
        return false;
    }
    const params = { playlist_name: playlistName };
    const path = '/local/camswitcher/api/playlist_switch.cgi';
    try {
        if (settings.use_cloud && settings.cloud_url) {
            const { url, headers } = buildCgiRequest(path, params);
            const resp = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        } else {
            const resp = await localVapix(settings).vapixGet(path, params);
            const body = await resp.text().catch(() => '');
            if (!resp.ok) throw new Error(`HTTP ${resp.status} ${cleanErr(body)}`);
        }
        addLog(`➡ CamSwitcher view → ${playlistName}`);
        return true;
    } catch (err) {
        lastError = `CamSwitcher error: ${err.message}`;
        addLog(`✗ ${lastError}`);
        return false;
    }
}

/** Apply a resolved target — either a PTZ preset or a CamSwitcher view. */
async function applyTarget(t) {
    return t.kind === 'cs' ? switchCamSwitcher(t.playlistName) : gotoPreset(t.channel, t.presetNo);
}

// ─────────────────────────────────────────────────────────────────────────────
// CGI request builder (local + CamStreamer Cloud)
// ─────────────────────────────────────────────────────────────────────────────
function buildCgiRequest(apiPath, params = {}) {
    const qp = new URLSearchParams(params);
    if (settings.use_cloud && settings.cloud_url) {
        if (settings.device_access_token) qp.set('DEVICE_ACCESS_TOKEN', settings.device_access_token);
        return { url: `${settings.cloud_url}${apiPath}?${qp}`, headers: {} };
    }
    const auth = 'Basic ' + Buffer.from(`${settings.camera_user}:${settings.camera_pass}`).toString('base64');
    const scheme = cameraTls() ? 'https' : 'http';
    const port = cameraPort();
    const portPart = (scheme === 'https' && port === 443) || (scheme === 'http' && port === 80) ? '' : `:${port}`;
    return { url: `${scheme}://${settings.camera_ip}${portPart}${apiPath}?${qp}`, headers: { Authorization: auth } };
}

/**
 * Fire-and-forget CamOverlay CGI call. Local cameras go through CameraVapix so
 * the HTTP/HTTPS protocol, port and self-signed-cert handling all apply; the
 * cloud path keeps using the device-connect.net URL + access token.
 */
async function camOverlayGet(apiPath, params) {
    try {
        if (settings.use_cloud && settings.cloud_url) {
            const { url, headers } = buildCgiRequest(apiPath, params);
            await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
        } else {
            await localVapix(settings).vapixGet(apiPath, params);
        }
    } catch { /* overlay updates are best-effort */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// PTZ control
// ─────────────────────────────────────────────────────────────────────────────
/** Send a ptz.cgi request (cloud token or local digest). Returns response text. */
async function ptzCgi(params) {
    if (settings.use_cloud && settings.cloud_url) {
        const { url, headers } = buildCgiRequest('/axis-cgi/com/ptz.cgi', params);
        const resp = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
        const body = await resp.text().catch(() => '');
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${cleanErr(body)}`);
        return body;
    }
    const resp = await localVapix(settings).vapixGet('/axis-cgi/com/ptz.cgi', params);
    const body = await resp.text().catch(() => '');
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${cleanErr(body)}`);
    return body;
}

async function gotoPreset(channel, presetNo) {
    try {
        await ptzCgi({ camera: String(channel || settings.ptz_channel || 1), gotoserverpresetno: String(presetNo) });
        addLog(`➡ PTZ camera ${channel || settings.ptz_channel || 1} → preset ${presetNo}`);
        return true;
    } catch (err) {
        lastError = `PTZ error: ${err.message}`;
        addLog(`✗ ${lastError}`);
        return false;
    }
}

/** Absolute pan/tilt/zoom move (PTZ tracking mode). pan/tilt in degrees, zoom 1–9999. */
async function ptzAbsolute(channel, pan, tilt, zoom) {
    try {
        await ptzCgi({ camera: String(channel || settings.ptz_channel || 1),
                       pan: String(pan), tilt: String(tilt), zoom: String(zoom) });
        addLog(`➡ PTZ camera ${channel || settings.ptz_channel || 1} → pan ${pan}° tilt ${tilt}° zoom ${zoom}`);
        return true;
    } catch (err) {
        lastError = `PTZ error: ${err.message}`;
        addLog(`✗ ${lastError}`);
        return false;
    }
}

/** Read the camera's current pan/tilt/zoom via ptz.cgi?query=position. */
async function queryPtzPosition(conn) {
    const params = { query: 'position', camera: String(conn.ptz_channel || 1) };
    let body;
    if (conn.use_cloud && conn.cloud_url) {
        const qp = new URLSearchParams(params);
        if (conn.device_access_token) qp.set('DEVICE_ACCESS_TOKEN', conn.device_access_token);
        const resp = await fetch(`${conn.cloud_url}/axis-cgi/com/ptz.cgi?${qp}`, { signal: AbortSignal.timeout(8000) });
        body = await resp.text().catch(() => '');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    } else {
        const resp = await localVapix(conn).vapixGet('/axis-cgi/com/ptz.cgi', params);
        body = await resp.text().catch(() => '');
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${cleanErr(body)}`);
    }
    const out = {};
    for (const line of String(body).split(/[\r\n]+/)) {
        const m = line.match(/^(pan|tilt|zoom)\s*=\s*(-?[\d.]+)/i);
        if (m) out[m[1].toLowerCase()] = Number(m[2]);
    }
    return out;
}

/** Compute absolute pan/tilt/zoom for a storm bearing & distance (km). */
function computePtz(bearing, distKm) {
    const ref = Number(settings.ptz_ref_bearing) || 0;
    let pan = ((bearing - ref + 540) % 360) - 180;   // -180..180, 0 = camera home
    if (settings.ptz_pan_flip) pan = -pan;
    const tilt = Number(settings.ptz_tilt) || 0;
    const radius = Math.max(1, Number(settings.scan_radius_km) || 80);
    const zMin = Number(settings.ptz_zoom_min_pct) || 0;
    const zMax = Number(settings.ptz_zoom_max_pct) || 0;
    const frac = Math.max(0, Math.min(1, (Number(distKm) || 0) / radius));
    const pct = zMin + (zMax - zMin) * frac;          // near = wide, far = tele
    const zoom = Math.max(1, Math.min(9999, Math.round(1 + (pct / 100) * 9998)));
    return { pan: Number(pan.toFixed(1)), tilt, zoom, pct: Math.round(pct) };
}

/**
 * Parse the plain-text output of VAPIX `ptz.cgi?query=presetposall`.
 * Groups presets by camera / view area. Tolerant of firmware variations.
 *
 * Typical output:
 *   Preset Positions for camera 1
 *   presetposno1=Home
 *   presetposno2=Gate
 *   Preset Positions for camera 2
 *   presetposno1=Yard
 */
function parsePresetPosAll(text) {
    const cams = [];
    let cur = null;
    for (const raw of String(text).split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        let m = line.match(/Preset Positions for camera\s+(\d+)/i);
        if (m) {
            cur = { camera: Number(m[1]), presets: [] };
            cams.push(cur);
            continue;
        }
        m = line.match(/^presetposno(\d+)\s*=\s*(.*)$/i);
        if (m) {
            if (!cur) { cur = { camera: 1, presets: [] }; cams.push(cur); }
            cur.presets.push({ no: Number(m[1]), name: (m[2] || '').trim() });
        }
    }
    cams.forEach((c) => c.presets.sort((a, b) => a.no - b.no));
    return cams;
}

/**
 * Query a camera for its preset positions across all view areas. Accepts an
 * explicit connection object so the settings UI can probe BEFORE saving.
 */
async function queryCameraPresets(conn) {
    let body;
    if (conn.use_cloud && conn.cloud_url) {
        const qp = new URLSearchParams({ query: 'presetposall' });
        if (conn.device_access_token) qp.set('DEVICE_ACCESS_TOKEN', conn.device_access_token);
        const resp = await fetch(`${conn.cloud_url}/axis-cgi/com/ptz.cgi?${qp}`, { signal: AbortSignal.timeout(8000) });
        body = await resp.text().catch(() => '');
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${cleanErr(body)}`);
    } else {
        // Local: digest auth via CameraVapix.
        const resp = await localVapix(conn).vapixGet('/axis-cgi/com/ptz.cgi', { query: 'presetposall' });
        body = await resp.text().catch(() => '');
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${cleanErr(body)}`);
    }
    return parsePresetPosAll(body);
}

// ─────────────────────────────────────────────────────────────────────────────
// CamOverlay InfoTicker (optional)
// ─────────────────────────────────────────────────────────────────────────────
async function pushInfoTicker(serviceId, text) {
    await camOverlayGet('/local/camoverlay/api/infoticker.cgi', { service_id: String(serviceId), text });
}
async function setServiceVisible(serviceId, on) {
    await camOverlayGet('/local/camoverlay/api/enabled.cgi', { [`id_${serviceId}`]: on ? '1' : '0' });
}

/** Available overlay variables formatted as display strings. */
const CG_VARS = ['status', 'bearing', 'compass', 'distance', 'dist_unit', 'intensity', 'preset', 'location', 'time'];
function statusVars(s) {
    const imperial = settings.unit_system !== 'metric';
    const distVal = s.distance == null ? null : (imperial ? s.distance / KM_PER_MI : s.distance);
    return {
        status: String(s.status ?? '—'),
        bearing: s.bearing == null ? '—' : String(Math.round(s.bearing)),
        compass: s.bearing == null ? '—' : compass(s.bearing),
        distance: distVal == null ? '—' : distVal.toFixed(0),
        dist_unit: imperial ? 'mi' : 'km',
        intensity: s.intensity == null ? '—' : Number(s.intensity).toFixed(1),
        preset: s.preset == null ? '—' : String(s.preset),
        location: settings.location_name || `${settings.latitude},${settings.longitude}`,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
}

function renderTicker(s) {
    const v = statusVars(s);
    let out = settings.infoticker_template || '';
    for (const k of Object.keys(v)) out = out.replace(new RegExp(`{${k}}`, 'g'), v[k]);
    return out;
}

/** Push one or more text fields to a CamOverlay Custom Graphics service. */
async function pushCustomGraphics(serviceId, fields) {
    await camOverlayGet('/local/camoverlay/api/customGraphics.cgi', { service_id: String(serviceId), ...fields });
}

/**
 * Explicitly show or hide each overlay service according to its enabled flag.
 * Called on startup (i.e. after every Save) so unchecking a box actually turns
 * the overlay OFF on the camera instead of leaving it visible.
 */
async function applyOverlayVisibility() {
    try { await setServiceVisible(settings.infoticker_service_id, !!settings.overlay_enabled); } catch {}
    try { await setServiceVisible(settings.cg_service_id, !!settings.cg_enabled); } catch {}
    addLog(`Overlay visibility set — InfoTicker ${settings.overlay_enabled ? 'ON' : 'OFF'}, Custom Graphics ${settings.cg_enabled ? 'ON' : 'OFF'}`);
}

async function updateOverlay(s) {
    const v = statusVars(s);
    // InfoTicker (scrolling text line)
    if (settings.overlay_enabled) {
        await pushInfoTicker(settings.infoticker_service_id, renderTicker(s));
        await setServiceVisible(settings.infoticker_service_id, true);
    }
    // Custom Graphics (map each variable to a named field)
    if (settings.cg_enabled) {
        const fields = {};
        for (const key of CG_VARS) {
            const f = String(settings[`cg_field_${key}`] || '').trim();
            if (f) fields[f] = v[key];
        }
        if (Object.keys(fields).length) {
            await pushCustomGraphics(settings.cg_service_id, fields);
            await setServiceVisible(settings.cg_service_id, true);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging & status
// ─────────────────────────────────────────────────────────────────────────────
const LOG_LIMIT = 100;
const recentLogs = [];
let lastFetchTime = '';
let nextFetchTime = '';
let fetchCount = 0;
let lastError = '';

let lastTopSpots = [];          // top-N strongest storm cells from the last scan
let currentPtzPan = null;       // last commanded pan (ptztrack mode)
let currentPtzPct = null;       // last commanded zoom %
let manualMode = false;         // when on, the user picks the target spot
let manualBearing = null;       // user-selected bearing (null = auto-pick strongest)
let currentPreset = null;       // preset number the camera is currently aimed at
let currentKey = null;          // unique key of the current target (channel+preset)
let currentLabel = '';          // human label of the current target
let currentPresetCenter = null; // its center bearing
let lastMoveMs = 0;             // timestamp of last PTZ move
let lastMoveIntensity = 0;      // storm intensity at the time of the last move
let forceNextMove = false;      // force a re-aim on next scan (after save / manual refresh)
let lastStatus = { status: 'idle', bearing: null, distance: null, intensity: null, preset: null };

function addLog(msg) {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${PKG}] ${msg}`);
    recentLogs.push(`${ts} ${msg}`);
    if (recentLogs.length > LOG_LIMIT) recentLogs.shift();
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch + decide
// ─────────────────────────────────────────────────────────────────────────────
let updateTimer = null;

// A cell only counts as a storm if there is genuine convective ACTIVITY:
// measurable lightning potential or actual rainfall. CAPE and wind gusts are
// instability/wind that are routinely high on perfectly clear days, so they may
// only *amplify* an already-active cell — they can never, on their own, register
// as a storm. Without this gate the score is dominated by ambient CAPE and the
// camera can never reach the "no storm" state (every probe point clears the
// trigger threshold). See intensity_threshold.
const PRECIP_FLOOR_MM = 0.1;   // mm of rain in the current hour to count as activity
const LIGHTNING_FLOOR = 0.1;   // J/kg lightning potential to count as activity

function scoreIntensity(lightning, cape, precip, gust) {
    const l = lightning || 0, p = precip || 0;
    // Activity gate: no lightning and no meaningful rain → not a storm (score 0).
    if (l < LIGHTNING_FLOOR && p < PRECIP_FLOOR_MM) return 0;
    return (
        (Number(settings.w_lightning) || 0) * l +
        (Number(settings.w_cape) || 0) * (cape || 0) +
        (Number(settings.w_precip) || 0) * p +
        (Number(settings.w_gust) || 0) * (gust || 0)
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather providers — primary Open-Meteo (rich, multi-point) with a keyless
// MET Norway fallback so the app keeps working when Open-Meteo's daily quota is
// hit. Both return a `scored` array: [{ intensity, bearing, dist }].
// ─────────────────────────────────────────────────────────────────────────────
let omExhaustedUntil = 0;       // skip Open-Meteo until this time (quota backoff)
let lastSource = '';            // which provider produced the last scan
let currentThreshold = 0;       // effective intensity threshold for this scan's source

async function scoreOpenMeteo(grid) {
    const lats = grid.map((p) => p.lat.toFixed(4)).join(',');
    const lons = grid.map((p) => p.lon.toFixed(4)).join(',');
    const qp = new URLSearchParams({
        latitude: lats, longitude: lons,
        current: 'precipitation,wind_gusts_10m',
        hourly: 'cape,lightning_potential',
        forecast_days: '1', timezone: 'UTC',
    });
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${qp}`, { signal: AbortSignal.timeout(20000) });
    if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 160)}`);
    }
    const data = await resp.json();
    const locsArr = Array.isArray(data) ? data : [data];
    if (locsArr[0] && locsArr[0].error) throw new Error(locsArr[0].reason ?? 'Open-Meteo error');
    const nowHourIso = new Date().toISOString().slice(0, 13);
    const scored = [];
    for (let i = 0; i < grid.length && i < locsArr.length; i++) {
        const pt = grid[i], d = locsArr[i];
        if (!d || !d.current) continue;
        const precip = Number(d.current.precipitation ?? 0);
        const gust = Number(d.current.wind_gusts_10m ?? 0);
        let cape = 0, lightning = 0;
        if (d.hourly && Array.isArray(d.hourly.time)) {
            let idx = d.hourly.time.findIndex((t) => String(t).slice(0, 13) === nowHourIso);
            if (idx < 0) idx = 0;
            cape = Number((d.hourly.cape && d.hourly.cape[idx]) ?? 0);
            lightning = Number((d.hourly.lightning_potential && d.hourly.lightning_potential[idx]) ?? 0);
        }
        scored.push({ intensity: scoreIntensity(lightning, cape, precip, gust), bearing: pt.bearing, dist: pt.dist });
    }
    return scored;
}

/**
 * MET Norway fallback. One request per point (no multi-point API), so we cap the
 * grid to keep it light. No CAPE/lightning available → score uses precip + gust.
 * Free, no API key, no hard daily cap (requires a User-Agent + caching etiquette).
 */
async function scoreMetNo(grid) {
    const cap = 14;
    const step = Math.max(1, Math.ceil(grid.length / cap));
    const pts = grid.filter((_, i) => i % step === 0).slice(0, cap);
    const headers = { 'User-Agent': 'StormChaser-CamScripter/4.0.0 (camstreamer)' };
    const results = await Promise.all(pts.map(async (pt) => {
        try {
            const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${pt.lat.toFixed(4)}&lon=${pt.lon.toFixed(4)}`;
            const resp = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
            if (!resp.ok) return null;
            const j = await resp.json();
            const ts = j.properties && j.properties.timeseries && j.properties.timeseries[0];
            if (!ts) return null;
            const inst = (ts.data.instant && ts.data.instant.details) || {};
            const next1 = (ts.data.next_1_hours && ts.data.next_1_hours.details) || {};
            const precip = Number(next1.precipitation_amount ?? 0);
            const gustMs = Number(inst.wind_speed_of_gust ?? inst.wind_speed ?? 0);
            const gust = gustMs * 3.6; // m/s → km/h to match Open-Meteo units
            return { intensity: scoreIntensity(0, 0, precip, gust), bearing: pt.bearing, dist: pt.dist };
        } catch { return null; }
    }));
    const scored = results.filter(Boolean);
    if (!scored.length) throw new Error('MET Norway returned no data');
    return scored;
}

async function fetchAndUpdate() {
    const grid = buildProbeGrid();
    const loc = settings.location_name || `${settings.latitude},${settings.longitude}`;

    try {
        let scored;
        // Use the fallback while Open-Meteo is in quota backoff; else try primary
        // and fall back to MET Norway on any failure.
        if (Date.now() < omExhaustedUntil) {
            addLog(`Scanning via MET Norway fallback (Open-Meteo quota cooling down) — ${loc}`);
            scored = await scoreMetNo(grid);
            lastSource = 'MET Norway (fallback)';
        } else {
            addLog(`Scanning ${grid.length} probe points around ${loc} (r≤${settings.scan_radius_km} km)`);
            try {
                scored = await scoreOpenMeteo(grid);
                lastSource = 'Open-Meteo';
            } catch (e) {
                if (/\b429\b/.test(String(e.message))) {
                    const now = new Date();
                    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
                    omExhaustedUntil = reset.getTime();
                    addLog(`⏳ Open-Meteo daily limit reached — switching to MET Norway fallback until ${reset.toISOString().slice(11, 16)} UTC.`);
                } else {
                    addLog(`Open-Meteo failed (${e.message}) — trying MET Norway fallback`);
                }
                scored = await scoreMetNo(grid);
                lastSource = 'MET Norway (fallback)';
            }
        }
        scored.sort((a, b) => b.intensity - a.intensity);

        // Top N strongest spots (red dots). Spread them out a bit so they aren't
        // all clustered on one cell — require ≥15° bearing separation.
        const topN = Math.max(1, Math.min(12, Number(settings.top_spots) || 5));

        // Optional: pull active US NWS severe-weather warnings and merge them in
        // (they carry high intensity so a Tornado/Severe warning wins).
        let alertSpots = [];
        if (settings.nws_enabled) {
            try {
                alertSpots = await fetchNwsAlerts(Number(settings.latitude), Number(settings.longitude));
                if (alertSpots.length) addLog(`⚠ NWS: ${alertSpots.map((a) => a.event).join(', ')}`);
            } catch (e) {
                addLog(`NWS alerts unavailable: ${e.message}`);
            }
        }

        // Optional: global tropical cyclones (typhoons/hurricanes) via GDACS.
        let tcSpots = [];
        if (settings.typhoon_enabled) {
            try {
                tcSpots = await fetchTropicalCyclones(Number(settings.latitude), Number(settings.longitude));
                if (tcSpots.length) addLog(`🌀 Cyclones in range: ${tcSpots.map((t) => `${t.event} (${Math.round(t.dist)} km)`).join(', ')}`);
            } catch (e) {
                addLog(`Tropical-cyclone feed unavailable: ${e.message}`);
            }
        }

        // Build the red-dot list. Overriding sources (NWS warnings, tropical
        // cyclones) are placed first so they win; otherwise everything is just
        // sorted by intensity.
        const overrideSpots = [
            ...(settings.nws_enabled && settings.nws_override ? alertSpots : []),
            ...(settings.typhoon_enabled && settings.typhoon_override ? tcSpots : []),
        ].sort((a, b) => b.intensity - a.intensity);
        const restSpots = [
            ...scored,
            ...(settings.nws_enabled && !settings.nws_override ? alertSpots : []),
            ...(settings.typhoon_enabled && !settings.typhoon_override ? tcSpots : []),
        ].sort((a, b) => b.intensity - a.intensity);
        const merged = [...overrideSpots, ...restSpots];
        lastTopSpots = [];
        for (const s of merged) {
            if (s.intensity <= 0) break;
            if (lastTopSpots.some((t) => angDiff(t.bearing, s.bearing) < 15)) continue;
            lastTopSpots.push(s);
            if (lastTopSpots.length >= topN) break;
        }

        const best = lastTopSpots[0] || scored[0] || null;
        // The user's intensity_threshold is now honoured for BOTH providers. The
        // activity gate in scoreIntensity already filters out clear-sky cells, so
        // a quiet MET-Norway scan correctly reads "no storm" instead of being
        // forced past a hardcoded relaxed value. Note: MET scores are on a smaller
        // scale (precip + gust only, no CAPE/lightning), so a threshold tuned for
        // Open-Meteo may rarely trip on the fallback — lower it if needed.
        const fallback = lastSource.startsWith('MET');
        currentThreshold = Number(settings.intensity_threshold) || 0;
        if (fallback) addLog(`(fallback: MET Norway — precip/gust only, your threshold ${currentThreshold} applies)`);
        fetchCount++;
        lastFetchTime = new Date().toLocaleString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        lastError = '';
        addLog(`✓ ${scored.length} cells scored via ${lastSource}`);

        await decideAndMove(resolveTarget(best));
        scheduleNextUpdate();
    } catch (err) {
        // Both providers failed — keep the camera where it is and retry soon.
        lastError = err.message;
        addLog(`✗ All weather sources failed: ${lastError} — retry in 5 min`);
        updateTimer = setTimeout(fetchAndUpdate, 5 * 60000);
        nextFetchTime = 'retry in 5 min';
    }
}

/** Nearest known top-spot to a bearing (for distance/intensity of a manual pick). */
function nearestSpot(bearing) {
    let best = null, bd = Infinity;
    for (const s of lastTopSpots) {
        const d = angDiff(s.bearing, bearing);
        if (d < bd) { bd = d; best = s; }
    }
    return best;
}

/**
 * Decide the cell the camera should chase. In manual mode the user's selected
 * bearing wins (or the strongest spot if nothing is selected yet). The returned
 * object carries a `manual` flag so the threshold/home logic can be bypassed.
 */
function resolveTarget(best) {
    if (!manualMode) return best;
    const b = manualBearing != null ? manualBearing : (best ? best.bearing : null);
    if (b == null) return best;
    const near = nearestSpot(b);
    return { bearing: b, dist: near ? near.dist : (best ? best.dist : 0),
             intensity: near ? near.intensity : (best ? best.intensity : 0), manual: true };
}

/** Continuous PTZ tracking: aim absolute pan/tilt/zoom at the storm. */
async function decidePtzTrack(best, force, threshold, hyst, now) {
    const channel = Number(settings.ptz_channel) || 1;

    // No storm → return to the reference/home view (pan 0, fixed tilt, min zoom).
    if (!best || best.intensity < threshold) {
        const z = computePtz(Number(settings.ptz_ref_bearing) || 0, 0); // dist 0 → min zoom
        if (force || currentPtzPan !== 0) {
            if (await ptzAbsolute(channel, 0, Number(settings.ptz_tilt) || 0, z.zoom)) {
                currentPtzPan = 0; currentPtzPct = z.pct; currentPresetCenter = null; lastMoveMs = now;
                currentLabel = 'home (PTZ ref)';
            }
        }
        lastStatus = { status: 'no storm', bearing: null, distance: null, intensity: best ? best.intensity : 0, preset: currentLabel || 'home' };
        await updateOverlay(lastStatus);
        return;
    }

    // Asymmetric pan limit relative to the reference bearing. rel is the storm's
    // signed offset from where the camera faces at pan 0: negative = left
    // (counter-clockwise), positive = right (clockwise). Reach left/right are
    // configurable, so e.g. 90° left + 120° right covers a 210° lopsided view.
    const ref = norm360(Number(settings.ptz_ref_bearing) || 0);
    const rel = ((best.bearing - ref + 540) % 360) - 180;   // -180..180, 0 = ref
    const left = Math.max(0, Math.min(180, Number(settings.ptz_arc_left_deg) || 0));
    const right = Math.max(0, Math.min(180, Number(settings.ptz_arc_right_deg) || 0));
    if (rel < -left - 1e-6 || rel > right + 1e-6) {
        const side = rel < 0 ? `${Math.round(-rel)}° left (limit ${left}°)` : `${Math.round(rel)}° right (limit ${right}°)`;
        addLog(`Storm at ${Math.round(best.bearing)}° is ${side} — outside pan limits, holding`);
        lastStatus = { status: 'out of arc', bearing: best.bearing, distance: best.dist, intensity: best.intensity, preset: currentLabel || '—' };
        await updateOverlay(lastStatus);
        return;
    }

    const t = computePtz(best.bearing, best.dist);
    const panMoved = currentPtzPan == null || angDiff(((t.pan + 360) % 360), ((currentPtzPan + 360) % 360)) > hyst;
    const zoomMoved = currentPtzPct == null || Math.abs(t.pct - currentPtzPct) >= 5;

    if (force || panMoved || zoomMoved) {
        if (await ptzAbsolute(channel, t.pan, t.tilt, t.zoom)) {
            currentPtzPan = t.pan; currentPtzPct = t.pct; currentPresetCenter = best.bearing; lastMoveMs = now;
            currentLabel = `PTZ ${Math.round(best.bearing)}° (${compass(best.bearing)}) z${t.pct}%`;
            addLog(`★ Tracking storm: ${Math.round(best.bearing)}° (${compass(best.bearing)}), ~${best.dist.toFixed(0)} km → pan ${t.pan}° zoom ${t.pct}%`);
        }
    }
    lastStatus = { status: 'tracking', bearing: best.bearing, distance: best.dist, intensity: best.intensity, preset: currentLabel || '—' };
    await updateOverlay(lastStatus);
}

async function decideAndMove(best) {
    const manual = !!(best && best.manual);
    const threshold = manual ? -Infinity : currentThreshold;
    const dwellMs = (Number(settings.dwell_min) || 0) * 60000;
    const hyst = Number(settings.hysteresis_deg) || 0;
    const now = Date.now();

    const force = forceNextMove;
    forceNextMove = false; // consume the one-shot force flag

    if (settings.target_mode === 'ptztrack') return decidePtzTrack(best, force, threshold, hyst, now);

    // No meaningful storm → home / hold.
    if (!best || best.intensity < threshold) {
        addLog(`No storm above threshold (max intensity ${best ? best.intensity.toFixed(2) : '0'})`);
        if (settings.target_mode === 'camswitcher') {
            // Switch to the configured Home view (if any) when there's no storm.
            const homeName = extractPlaylistName(settings.cs_home_url || '');
            const homeKey = `cshome.${homeName}`;
            if (homeName && (force || currentKey !== homeKey)) {
                if (await switchCamSwitcher(homeName)) {
                    currentKey = homeKey;
                    currentLabel = (settings.cs_home_name || '').trim() ? `home: ${settings.cs_home_name.trim()}` : 'home view';
                    currentPresetCenter = null;
                    lastMoveMs = now;
                    lastMoveIntensity = 0;
                }
            }
        } else {
            const home = Number(settings.home_preset) || 0;
            const homeChannel = Number(settings.ptz_channel) || 1;
            const homeKey = `home${homeChannel}.${home}`;
            if (home > 0 && (force || currentKey !== homeKey)) {
                if (await gotoPreset(homeChannel, home)) {
                    currentKey = homeKey;
                    currentPreset = home;
                    currentLabel = `home ${home}`;
                    currentPresetCenter = null;
                    lastMoveMs = now;
                    lastMoveIntensity = 0;
                }
            }
        }
        lastStatus = { status: 'no storm', bearing: null, distance: null, intensity: best ? best.intensity : 0, preset: currentLabel || '—' };
        await updateOverlay(lastStatus);
        return;
    }

    const target = targetForBearing(best.bearing);

    // Storm outside a 180° arc.
    if (!target.inArc) {
        addLog(`Storm at ${Math.round(best.bearing)}° (${compass(best.bearing)}) is outside the ${settings.coverage_deg}° arc — holding`);
        lastStatus = { status: 'out of arc', bearing: best.bearing, distance: best.dist, intensity: best.intensity, preset: currentLabel || '—' };
        await updateOverlay(lastStatus);
        return;
    }

    // Hysteresis + dwell: only move if the storm clearly left the current sector.
    const driftedOut =
        currentPresetCenter != null && angDiff(best.bearing, currentPresetCenter) > hyst;
    const dwellOk = now - lastMoveMs >= dwellMs;

    // A clearly STRONGER storm in a different sector overrides the dwell timer.
    const margin = Number(settings.switch_margin) || 0;
    const muchStronger = best.intensity >= lastMoveIntensity * (1 + margin);

    let willMove;
    let reason = '';
    if (force) {
        willMove = true; reason = 'forced re-aim';
    } else if (currentKey == null) {
        willMove = true; reason = 'first acquisition';
    } else if (target.key === currentKey) {
        willMove = false; // already aimed there
    } else if (!driftedOut) {
        willMove = false; // still within hysteresis band of current sector
    } else if (dwellOk) {
        willMove = true; reason = 'storm moved to new sector';
    } else if (muchStronger) {
        willMove = true; reason = `stronger storm (${best.intensity.toFixed(1)} ≥ ${(lastMoveIntensity * (1 + margin)).toFixed(1)})`;
    } else {
        willMove = false;
        addLog(`Storm at ${compass(best.bearing)} but dwell not met & not much stronger — holding ${currentLabel}`);
    }

    if (willMove) {
        if (await applyTarget(target)) {
            currentKey = target.key;
            currentPreset = target.presetNo;
            currentLabel = target.label;
            currentPresetCenter = target.center;
            lastMoveMs = now;
            lastMoveIntensity = best.intensity;
            addLog(`★ Chasing storm (${reason}): ${Math.round(best.bearing)}° (${compass(best.bearing)}), ` +
                   `~${best.dist.toFixed(0)} km, intensity ${best.intensity.toFixed(1)} → ${target.label}`);
        }
    }

    lastStatus = {
        status: willMove ? 'tracking' : 'holding',
        bearing: best.bearing,
        distance: best.dist,
        intensity: best.intensity,
        preset: currentLabel || '—',
    };
    await updateOverlay(lastStatus);
}

function scheduleNextUpdate() {
    if (updateTimer) clearTimeout(updateTimer);
    const ms = (Number(settings.update_interval_min) || 10) * 60000;
    updateTimer = setTimeout(fetchAndUpdate, ms);
    const next = new Date(Date.now() + ms);
    nextFetchTime = next.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    addLog(`Next scan at ${nextFetchTime} (+${settings.update_interval_min} min)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP server (settings UI backend)
// ─────────────────────────────────────────────────────────────────────────────
function buildPresetTable() {
    const rows = [];
    if (settings.target_mode === 'camswitcher') {
        viewBearings().forEach((v, i) => {
            rows.push({ presetNo: `view ${i + 1} (${(v.nice || v.name || '?').slice(0, 10)}…)`, centerBearing: Math.round(v.bearing), compass: compass(v.bearing) });
        });
        return rows;
    }
    ppViews().forEach((p) => {
        rows.push({ presetNo: `#${p.presetNo}${p.name ? ' ' + p.name : ''}`, centerBearing: Math.round(p.bearing), compass: compass(p.bearing) });
    });
    return rows;
}

function startHttpServer() {
    const server = new HttpServer();

    server.onRequest('/settings.cgi', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'GET') {
            try {
                // Always merge over DEFAULT_SETTINGS so newly-added keys are never
                // missing/blank when reading an older saved settings file.
                let stored = {};
                if (fs.existsSync(SETTINGS_PATH)) {
                    try { stored = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch {}
                }
                res.end(JSON.stringify({ ...DEFAULT_SETTINGS, ...stored }, null, 2));
            } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(err) }));
            }
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c.toString('utf8')));
            req.on('end', () => {
                try {
                    const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(body) };
                    const dir = path.dirname(SETTINGS_PATH);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf8');
                    res.end(JSON.stringify({ ok: true }));
                    setTimeout(() => {
                        console.log(`[${PKG}] Settings saved — restarting`);
                        process.kill(process.pid, 'SIGINT');
                    }, 300);
                } catch (err) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: String(err) }));
                }
            });
            return;
        }
        res.statusCode = 405;
        res.end('{}');
    });

    server.onRequest('/status.cgi', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            running: true,
            version: PACKAGE_VERSION,
            enabled: settings.enabled,
            lastFetch: lastFetchTime,
            nextFetch: nextFetchTime,
            fetchCount,
            source: lastSource,
            lastError,
            location: settings.location_name || `${settings.latitude},${settings.longitude}`,
            coverage_deg: settings.coverage_deg,
            currentPreset,
            currentStatus: lastStatus,
            presets: buildPresetTable(),
            topSpots: lastTopSpots.map((s) => ({ bearing: Math.round(s.bearing), distance: Math.round(s.dist), intensity: Number(s.intensity.toFixed(2)), event: s.event || null, tc: !!s.tc })),
            manualMode,
            manualBearing,
            log: [...recentLogs],
        }));
    });

    server.onRequest('/refresh.cgi', (_req, res) => {
        res.end(JSON.stringify({ ok: true }));
        addLog('Manual scan triggered — forcing full refresh & re-aim');
        forceNextMove = true;
        if (updateTimer) clearTimeout(updateTimer);
        fetchAndUpdate().catch(console.error);
    });

    // Manual mode: toggle on/off and pick a target bearing (a "red dot").
    server.onRequest('/manual.cgi', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return; }
        let body = '';
        req.on('data', (c) => (body += c.toString('utf8')));
        req.on('end', () => {
            try {
                const b = JSON.parse(body || '{}');
                if (Object.prototype.hasOwnProperty.call(b, 'mode')) {
                    manualMode = !!b.mode;
                    if (!manualMode) manualBearing = null;
                }
                if (Object.prototype.hasOwnProperty.call(b, 'bearing')) {
                    manualBearing = (b.bearing == null) ? null : Number(b.bearing);
                }
                addLog(`Manual mode ${manualMode ? 'ON' : 'OFF'}${manualBearing != null ? ` · locked ${Math.round(manualBearing)}° (${compass(manualBearing)})` : ' · auto-strongest'}`);
                forceNextMove = true;
                if (updateTimer) clearTimeout(updateTimer);
                fetchAndUpdate().catch(console.error);
                res.end(JSON.stringify({ ok: true, manualMode, manualBearing }));
            } catch (err) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: String(err) }));
            }
        });
    });

    // Probe the camera for its view areas + preset positions. POST a connection
    // object so the UI can fetch before the settings are even saved.
    server.onRequest('/presets.cgi', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return; }
        let body = '';
        req.on('data', (c) => (body += c.toString('utf8')));
        req.on('end', async () => {
            try {
                const conn = JSON.parse(body || '{}');
                addLog(`Querying preset positions from ${conn.use_cloud ? conn.cloud_url : conn.camera_ip}`);
                const viewAreas = await queryCameraPresets(conn);
                const total = viewAreas.reduce((n, v) => n + v.presets.length, 0);
                addLog(`✓ Found ${viewAreas.length} view area(s), ${total} preset(s)`);
                res.end(JSON.stringify({ ok: true, viewAreas }));
            } catch (err) {
                // 200 + ok:false so the UI can show a friendly message.
                res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
            }
        });
    });

    // Read current PTZ position (for the "read current" button in PTZ-track mode).
    server.onRequest('/ptzpos.cgi', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return; }
        let body = '';
        req.on('data', (c) => (body += c.toString('utf8')));
        req.on('end', async () => {
            try {
                const pos = await queryPtzPosition(JSON.parse(body || '{}'));
                res.end(JSON.stringify({ ok: true, position: pos }));
            } catch (err) {
                res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
            }
        });
    });

    // List CamSwitcher playlists (cameras + true playlists) from the camera.
    server.onRequest('/playlists.cgi', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return; }
        let body = '';
        req.on('data', (c) => (body += c.toString('utf8')));
        req.on('end', async () => {
            try {
                const conn = JSON.parse(body || '{}');
                const r = await queryCamSwitcherPlaylists(conn);
                if (r.ok) addLog(`✓ CamSwitcher: ${r.playlists.length} playlist(s)`);
                else addLog(`✗ CamSwitcher playlists: ${r.error}`);
                res.end(JSON.stringify(r));
            } catch (err) {
                res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
            }
        });
    });

    server.onRequest('/preview.cgi', (_req, res) => {
        // Returns the preset table without scanning — used by the UI compass widget.
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ presets: buildPresetTable(), coverage_deg: settings.coverage_deg, center_bearing_deg: settings.center_bearing_deg }));
    });

    server.onRequest('/crash.cgi', (_req, res) => {
        res.setHeader('Content-Type', 'text/plain');
        const p = path.join(process.env.PERSISTENT_DATA_PATH ?? '.', 'crash.log');
        res.end(fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : 'No crash log.');
    });

    console.log(`[${PKG}] HTTP server started`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
const CRASH_LOG = path.join(process.env.PERSISTENT_DATA_PATH ?? '.', 'crash.log');
process.on('uncaughtException', (err) => {
    const msg = `${new Date().toISOString()} UNCAUGHT: ${err.stack ?? err.message}`;
    console.error(`[${PKG}]`, msg);
    try { fs.writeFileSync(CRASH_LOG, msg + '\n', 'utf8'); } catch {}
    process.exit(1);
});

async function main() {
    console.log(`[${PKG}] ── Storm Chaser v3.0.3 starting ──`);
    console.log(`[${PKG}] Settings: ${SETTINGS_PATH}`);

    process.on('SIGINT', () => {
        console.log(`[${PKG}] SIGINT — shutting down`);
        if (updateTimer) clearTimeout(updateTimer);
        process.exit(0);
    });

    startHttpServer();

    // Apply overlay show/hide on every launch (i.e. after each Save) so toggling
    // a checkbox off actually removes the overlay from the video.
    await applyOverlayVisibility();

    if (!settings.enabled) {
        addLog('⏸ Disabled. Enable via Settings UI.');
        await new Promise(() => {});
        return;
    }

    const loc = settings.location_name || `${settings.latitude},${settings.longitude}`;
    addLog(`Starting — ${loc}, mode ${settings.target_mode}, coverage ${settings.coverage_deg}°, ` +
           `scan every ${settings.update_interval_min} min`);
    // After every save the app restarts and lands here — force a full re-scan
    // and re-aim so geometry/location changes take effect immediately.
    forceNextMove = true;
    await fetchAndUpdate();
}

main().catch((err) => {
    const msg = `${new Date().toISOString()} FATAL: ${err.stack ?? String(err)}`;
    console.error(`[${PKG}]`, msg);
    try { fs.writeFileSync(CRASH_LOG, msg + '\n', 'utf8'); } catch {}
    process.exit(1);
});
