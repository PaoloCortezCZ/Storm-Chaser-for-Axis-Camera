# ⛈ Storm Chaser

**Automatically point an Axis IP camera at the strongest nearby storm.**

Storm Chaser is a [CamScripter](https://camstreamer.com/camscripter) microapp for Axis
cameras. Every few minutes it scans the weather around the camera, finds the most active
storm cell, works out its compass bearing and distance, and aims the camera at it — by
calling a **PTZ preset**, switching a **CamSwitcher view**, or driving **continuous
pan/tilt/zoom**. It can also follow real **US National Weather Service** tornado / severe
warnings and track **tropical cyclones (typhoons / hurricanes) anywhere in the world**.

> ⚠️ Community project built on the CamStreamer / CamScripter and Axis VAPIX APIs. Not an
> official Axis or CamStreamer product.

<div align="center"> 
  <img width="50%" alt="Axis IP Camera Storm Chaser" src="https://github.com/user-attachments/assets/4865c696-a62f-4f84-acfd-519196f97a12" />
</div>
---

## Features

- **Three targeting modes**
  - **PTZ presets** — assign up to 8 of the camera's presets to compass directions.
  - **CamSwitcher views** — switch between cameras / view areas by direction.
  - **PTZ tracking** — continuous absolute pan/tilt/zoom; zoom scales with distance, with
    **asymmetric pan limits** (independent left/right reach, e.g. 90° left + 120° right).

<div align="center"> 
  <img width="1075" height="407" alt="3waystotrackstorms" src="https://github.com/user-attachments/assets/439b02ad-ab7e-4e40-ad3a-a7fed3e738a7" />
</div>
    
- **Storm scoring** from free [Open-Meteo](https://open-meteo.com) data — lightning
  potential, CAPE, precipitation and wind gusts, with adjustable weights. An **activity
  gate** keeps a clear-but-unstable sky (high CAPE, no lightning/rain) from registering as
  a phantom storm, so the "no storm" home state is reachable.
- **MET Norway fallback** — keeps working when Open-Meteo's daily quota is hit (no key, no cap).
- **US NWS severe-weather alerts** (optional) — tornado / severe thunderstorm / hurricane warnings.
- **Worldwide tropical cyclones** (optional) — tracks typhoons / hurricanes anywhere via
  keyless [GDACS](https://www.gdacs.org) data; aims at the in-range cyclone by bearing and
  shows it as a spinning 🌀 marker on the map. Covers **Japan / Western Pacific** and every
  other basin the US-only NWS feed misses.
- **HTTP / HTTPS camera connection** — choose protocol and port (auto 80/443 or custom);
  HTTPS accepts self-signed / untrusted certificates, and digest auth is handled automatically.
- **Live map** — camera, scan radius, colored sectors, RainViewer radar overlay, red storm
  dots, purple NWS markers, and 🌀 cyclone markers. **Manual pick**: click a dot to lock onto it.
- **CamOverlay output** — InfoTicker line and/or Custom Graphics fields.
- **Metric / Imperial** units, **360° / 180°** coverage, anti-jitter dwell & hysteresis,
  light/dark UI, settings **export / import**. Fetched presets, view areas and playlists are
  **remembered across reloads**; the installed version is shown in the header.

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
- [GDACS](https://www.gdacs.org) — global tropical-cyclone positions (UN/EU, keyless, worldwide).
- [RainViewer](https://www.rainviewer.com/) — radar tiles · [OpenStreetMap](https://www.openstreetmap.org/) — base map.

## License

MIT — see [`LICENSE`](LICENSE).
