# ⛈ Storm Chaser for Axis IP cameras - Powered by CamScripter ⛈

**Automatically point an Axis IP camera at the strongest nearby storm.**

Storm Chaser is a [CamScripter](https://camstreamer.com/camscripter) microapp for Axis
cameras. Every few minutes it scans the weather around the camera, finds the most active
storm cell, works out its compass bearing and distance, and aims the camera at it — by
calling a **PTZ preset**, switching a **CamSwitcher view**, or driving **continuous
pan/tilt/zoom**. It can also follow real **US National Weather Service** tornado / severe
warnings.

> ⚠️ Community project built on the CamStreamer / CamScripter and Axis VAPIX APIs. Not an
> official Axis or CamStreamer product.

---

<img width="100%" alt="Storm-Chaser-—-Settings-06-06-2026_03_52_PM" src="https://github.com/user-attachments/assets/67244c0d-0caf-4a54-beef-c17df173d5c6" />

## Features

- **Three targeting modes**
  - **PTZ presets** — assign up to 8 of the camera's presets to compass directions.
  - **CamSwitcher views** — switch between cameras / view areas by direction.
  - **PTZ tracking** — continuous absolute pan/tilt/zoom; zoom scales with distance.
- **Storm scoring** from free [Open-Meteo](https://open-meteo.com) data — lightning
  potential, CAPE, precipitation and wind gusts, with adjustable weights.
- **MET Norway fallback** — keeps working when Open-Meteo's daily quota is hit (no key, no cap).
- **US NWS severe-weather alerts** (optional) — tornado / severe thunderstorm / hurricane warnings.
- **Live map** — camera, scan radius, colored sectors, RainViewer radar overlay, and red
  storm dots. **Manual pick**: click a dot to lock the camera onto it.
- **CamOverlay output** — InfoTicker line and/or Custom Graphics fields.
- **Metric / Imperial** units, **360° / 180°** coverage, anti-jitter dwell & hysteresis,
  light/dark UI, settings **export / import**.

## Quick start

1. Install the **CamScripter** ACAP on your Axis camera (ARTPEC-6 or newer).
2. Download the latest [`storm_chaser_x.y.z.zip`](releases) and upload it via
   **CamScripter → Add package**.
3. Open the settings UI, set the camera connection, location, a targeting mode, then
   **Save & restart**.

Full instructions: see [`UserGuide.md`](storm_chaser/UserGuide.md) (also bundled in the package)
and the illustrated [Operations guide (PDF)](Storm_Chaser_OperationsHD.pdf).

## Build from source

```bash
cd storm_chaser
npm install
npm run create-package   # produces storm_chaser_<version>.zip (bundles node_modules)
```

The package ships files at the archive root (`main.js`, `manifest.json`, `html/`,
`localdata/`, `node_modules/`) as required by CamScripter.

## Repository layout

```
storm_chaser/            CamScripter package (the app)
  main.js                backend logic
  html/                  settings UI (index.html, index.js)
  localdata/settings.json default settings
  UserGuide.md           in-package user guide
docs/                    GitHub Pages site
Storm_Chaser_OperationsHD.pdf   illustrated operations guide
README.md
```

## Data sources

- [Open-Meteo](https://open-meteo.com) — primary weather model (CAPE, lightning, precip, gusts).
- [MET Norway](https://api.met.no) — keyless fallback (precip + gusts).
- [US NWS](https://www.weather.gov/documentation/services-web-api) — severe-weather warnings (US only).
- [RainViewer](https://www.rainviewer.com/) — radar tiles · [OpenStreetMap](https://www.openstreetmap.org/) — base map.

## License

MIT — see [`LICENSE`](LICENSE).
