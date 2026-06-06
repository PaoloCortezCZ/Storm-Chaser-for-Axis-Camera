# 🌪️ Storm Chaser — User Guide 🌪️

**Version 4.0.0** · CamScripter microapp for Axis IP cameras

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
2. Add a new package and upload `storm_chaser_4_0_0.zip`.
3. Open the Storm Chaser settings UI from the package, configure it (below), and click **Save & restart**.

> Settings are stored on the camera and survive restarts/upgrades. The settings page also
> keeps a local draft in your browser, so an accidental refresh won't lose un‑saved edits.

## 3. How it works — the anatomy of automated tracking

Storm Chaser acts as an autonomous director in three stages:

1. **Input — weather API.** Each scan it samples weather at a structured fan of points around
   the camera (the **probe grid**): precipitation, wind gusts, CAPE and lightning potential.
2. **Brain — Storm Chaser logic.** It computes an aggregate **threat score** for every point,
   applies the camera‑behavior model and anti‑jitter rules, and decides the dominant target.
3. **Output — Axis PTZ & overlays.** It issues camera‑control commands for optimized framing
   and pipes live targeting data into CamOverlay broadcast graphics.

Anti‑jitter logic (dwell + hysteresis) keeps it from flipping between cells, and a **switch
margin** lets a clearly stronger storm jump the queue. Enabling **NWS severe‑weather
warnings** lets a confirmed tornado / severe thunderstorm / hurricane override the score.

### The threat matrix
The aggregate score is a weighted blend, biased toward active electrical storms and heavy
rain: **lightning potential ≈ 1.0**, **precipitation ≈ 0.15**, **wind gusts ≈ 0.02**,
**CAPE ≈ 0.002** (CAPE numbers are large, hence the small weight). Tune these weights to suit
your climate.

### The targeting decision loop
To avoid chaotic panning the app runs a disciplined cycle: **Scan interval** (how often radar
data refreshes) → **Switch margin** (a new storm must score this much higher to win) →
**Hysteresis** (angular jitter filter) → **Min dwell** (hold a stable shot before
recalculating).

### Reading the tactical map
The map shows: **blue pin** = camera anchor · **concentric ring** = scan radius ·
**colored wedges** = preset/view sectors · **red dot** = the dominant threat cell driving the
current switch · **purple dots** = active NWS warnings.

## 4. Settings reference

Each settings card has an **(i)** icon with a built‑in explanation. Summary:

### Camera connection
- **Local**: camera IP, user, password (digest auth handled automatically).
- **Protocol & port**: HTTP or HTTPS; leave the port blank for the default (80 / 443) or set
  a custom one. HTTPS accepts self‑signed / untrusted certificates (normal for Axis on a LAN).
- **Cloud**: tick *Use CamStreamer Cloud* and paste the device‑connect.net URL + access token.
- **PTZ camera channel**: which video channel/view area PTZ commands target (usually 1).
- **Fetch view areas & presets**: reads the camera's view areas and preset names (remembered
  across page reloads).

> On Axis OS 12 the VAPIX **root** user has no default password — create an Administrator
> account in the camera's *System → Accounts* and use those credentials here. Over plain
> HTTP the camera enforces Digest auth; over HTTPS it also accepts Basic. Both are handled.

### Camera location
The exact spot the camera is mounted — the origin for all storm bearings. Use **Quick select**
for an Axis Experience Center / CamStreamer office, or type latitude/longitude. Bearings are
degrees clockwise from north (0 = N, 90 = E, 180 = S, 270 = W).

### Targeting mode
- **PTZ presets** — spread up to **8** presets around the compass; the app sends the camera to
  the preset nearest the storm.
- **CamSwitcher views** — switch between cameras/view areas configured in CamSwitcher; assign
  each a facing bearing (360°) or let them tile the arc (180°).
- **PTZ tracking** — continuous absolute pan/tilt/zoom toward the storm. Set the **bearing the
  camera faces at pan 0**, then its **left/right pan reach** independently (e.g. 90° left +
  120° right for a lopsided 210° view); storms outside that arc are ignored. Set both to 180
  for a full 360° camera.

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

### Tropical cyclones — worldwide (typhoons)
Optional source for **typhoons and hurricanes anywhere on Earth**, using **GDACS** (UN/EU,
free, no key). This is the source to use for **Japan and the Western Pacific** and every
other cyclone basin the US‑only NWS feed doesn't cover. When enabled it fetches active
cyclone positions; any whose centre is within the **tracking range** is treated as a
high‑priority target, and the camera aims at its compass bearing.

- **Track tropical cyclones / typhoons** — turn the source on.
- **Override** — when on, an in‑range cyclone outranks the local weather‑model storm score
  (same idea as the NWS override). When off, the cyclone competes on intensity like any cell.
- **Cyclone tracking range** (km) — how far away a cyclone's centre may be and still be
  tracked. Typhoons are huge, so **1000–2000 km** is reasonable; the camera only needs the
  bearing, and zoom is capped for distant systems. Default 1500 km.

Active cyclones appear on the map as a spinning **🌀 marker** (the followed one spins faster
and is larger); hover for its name, bearing, distance and intensity. If several are active,
the one with the higher **alert level** (Green/Orange/Red) and max wind wins. Because a
cyclone can sit far outside the scan ring, **zoom the map out** to see distant ones.

> **Tornadoes outside the US:** there is no global keyless tornado‑warning feed. The camera
> still finds tornadic supercells through the normal lightning / CAPE / precipitation
> scoring — it just won't have a dedicated warning to override with, as the US NWS feed
> provides. Inside the US, NWS tornado warnings are fully supported.

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
- **🌀 spinning markers** = active tropical cyclones (typhoons / hurricanes); may sit far
  outside the ring — zoom out to see them.
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
- **GDACS** (optional, worldwide) — tropical‑cyclone positions (typhoons / hurricanes),
  keyless, updated every few hours. Covers Japan, the Atlantic/Pacific, Indian Ocean and
  South Pacific basins.

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

## 9. Deployment readiness checklist

Run these phases in order for stable autonomous tracking:

1. **Lock the base** — verify the camera IP handshake and enter hyper‑accurate site latitude/longitude.
2. **Cast the net** — set the scan radius and probe grid (rings × samples); keep an eye on the estimated daily API calls.
3. **Tune the matrix** — set the threat weights and enable NWS severe‑weather overrides.
4. **Dictate the strategy** — choose PTZ presets, PTZ tracking, or CamSwitcher for your deployment.
5. **Verify the map** — confirm the blue anchor pin, colored geometry and red threat dots align with the physical horizon.

---

*Storm Chaser is a community microapp built on CamScripter / CamStreamer APIs for Axis cameras.*
