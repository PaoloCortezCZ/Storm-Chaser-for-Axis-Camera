# Storm Chaser — User Guide

**Version 3.0.2** · CamScripter microapp for Axis IP cameras

Storm Chaser automatically points an Axis camera at the strongest nearby storm. Every
few minutes it scans the weather around the camera, finds the most active storm cell,
works out its compass direction and distance, and aims the camera there — by calling a
**PTZ preset**, switching a **CamSwitcher view**, or driving **continuous pan/tilt/zoom**.

---

## 1. Requirements

- Axis camera with **CamScripter** ACAP installed (ARTPEC‑6 or newer).
- For overlays (optional): **CamOverlay** ACAP.
- For view switching (optional): **CamSwitcher** ACAP.
- The camera (or the browser used for setup) needs internet access for weather data and map tiles.

## 2. Installation

1. In the camera web UI open **Apps → CamScripter → Open**.
2. Add a new package and upload `storm_chaser_3_0_2.zip`.
3. Open the Storm Chaser settings UI from the package, configure it (below), and click **Save & restart**.

> Settings are stored on the camera and survive restarts/upgrades. The settings page also
> keeps a local draft in your browser, so an accidental refresh won't lose un‑saved edits.

## 3. How it works

Each scan the app samples weather at a fan of points around the camera (the **probe grid**),
scores every point for storm strength, and picks the strongest as the target. It then moves
the camera to face that direction. Anti‑jitter logic (dwell + hysteresis) keeps it from
flipping back and forth, and a "switch margin" lets a clearly stronger storm jump the queue.

## 4. Settings reference

Each settings card has an **(i)** icon with a built‑in explanation. Summary:

### Camera connection
- **Local**: camera IP, user, password (digest auth handled automatically).
- **Cloud**: tick *Use CamStreamer Cloud* and paste the device‑connect.net URL + access token.
- **PTZ camera channel**: which video channel/view area PTZ commands target (usually 1).
- **Fetch view areas & presets**: reads the camera's view areas and preset names.

### Camera location
The exact spot the camera is mounted — the origin for all storm bearings. Use **Quick select**
for an Axis Experience Center / CamStreamer office, or type latitude/longitude. Bearings are
degrees clockwise from north (0 = N, 90 = E, 180 = S, 270 = W).

### Targeting mode
- **PTZ presets** — spread up to **8** presets around the compass; the app sends the camera to
  the preset nearest the storm.
- **CamSwitcher views** — switch between cameras/view areas configured in CamSwitcher; assign
  each a facing bearing (360°) or let them tile the arc (180°).
- **PTZ tracking** — continuous absolute pan/tilt/zoom toward the storm.

**Coverage**: 360° (full circle) or 180° (one‑sided arc centered on the arc‑center bearing).
**Home preset/view**: where it parks when there's no storm (0 = hold).

### Storm detection
- **Units**: Imperial (miles) or Metric (km) — display only.
- **Scan radius / Rings / Samples per ring**: how far and how densely to probe. An estimated
  daily API‑call count is shown — keep it under ~9,000 for the free Open‑Meteo tier.
- **Intensity trigger threshold**: minimum score before the camera chases; below it → Home.
- **Best spots to show**: number of red dots on the map.
- **Weights** — the intensity score blends:
  - *Lightning potential* (J/kg) — likelihood/strength of lightning (regional models only).
  - *CAPE* (J/kg) — thunderstorm "fuel": &lt;1000 weak, 1000–2500 moderate, &gt;2500 strong.
  - *Precipitation* (mm) — current rain (matches the radar overlay).
  - *Wind gusts* (km/h) — often mark a storm's leading edge.

> Tip: to follow the **rain you see on radar**, raise the precipitation weight and lower
> lightning/CAPE.

### Severe weather alerts — US (NWS)
Optional second source (free, no key, **US only**). Pulls active **Tornado / Severe
Thunderstorm / Hurricane / Tropical Storm** warnings from api.weather.gov and shows them as
**purple dots**. With *override* on, an active warning outranks the weather‑model score.

### Timing & smoothing
- **Scan interval** (min): how often to re‑check. 1–2 is responsive; data refreshes ~10–15 min.
- **Min dwell** (min): minimum time on a target before a routine switch.
- **Hysteresis** (°): how far a storm must move past a sector edge before switching.
- **Switch margin**: a storm this much stronger (0.25 = 25%) in another sector switches immediately.

### CamOverlay InfoTicker (optional)
Burns a scrolling status line onto the video. Set the InfoTicker **service ID** and a template.
Variables: `{status} {bearing} {compass} {distance} {dist_unit} {intensity} {preset} {location} {time}`.

### CamOverlay Custom Graphics (optional)
Pushes each value to a **field** of a Custom Graphics service (for a styled widget). Set the
service ID and the field name for each variable you want shown (blank = skip).

> Overlays are explicitly **shown or hidden on Save** according to their checkbox — unchecking
> one and saving turns it off on the video.

## 5. The map

- **Blue pin** = camera · **ring** = scan radius · **colored wedges** = each view/preset sector.
- **Red dots** = detected storm cells (biggest/pulsing = the one being followed).
- **Purple dots** = active NWS warnings.
- **Live storm radar** overlays RainViewer precipitation (raw rain — can differ from the score).
- **Manual pick**: tick it, then **click a red dot** to lock the camera onto that cell. It stays
  locked until you pick another or turn manual off (then it follows the strongest again).

## 6. Data sources & limits

- **Open‑Meteo** (primary) — rich data incl. CAPE & lightning potential. Free tier ≈ 10,000
  calls/day; cost = probe points × scans/day.
- **MET Norway** (automatic fallback) — keyless, no daily cap. Used when Open‑Meteo is
  unavailable or its quota is hit; provides precipitation + gusts (the threshold is relaxed so
  tracking continues). The active source is shown in **Live status**.
- **NWS** (optional, US) — severe‑weather warnings.

If the daily limit is reached, the app backs off and switches to the fallback until the quota
resets at the next UTC midnight, then resumes automatically.

## 7. Export / Import

Use **Export** to download all settings as JSON (backup or copy to another camera) and
**Import** to load them back. After importing, click **Save & restart** to apply.

## 8. Troubleshooting

- **Form is blank after saving** — the app is restarting; it retries automatically. Wait a moment.
- **PTZ HTTP 401** — the app uses digest auth for local cameras; confirm the user/password and
  that the account has PTZ rights.
- **No purple dots** — NWS is US‑only and only shows during active warnings.
- **Overlay won't turn off** — uncheck it and **Save** (visibility is applied on save).
- **"Daily API limit"** — lower rings/samples or raise the scan interval (watch the estimate),
  or rely on the MET Norway fallback.
- **Camera points the wrong way** — verify the camera location, the preset/view bearings, and in
  PTZ‑tracking mode the reference bearing and the *Flip pan* option.

---

*Storm Chaser is a community microapp built on CamScripter / CamStreamer APIs for Axis cameras.*
