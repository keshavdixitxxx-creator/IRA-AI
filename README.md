# IRA AI — Immersive Responsive Assistant

A polished browser prototype for a multimodal personal assistant with seven visual modes:

1. **Liquid Orb** — animated voice-reactive visualizer
2. **Anime Persona** — cinematic avatar presentation
3. **VRM Studio** — local `.vrm` file loader shell (privacy-first; files stay in the browser)
4. **Global Monitor** — live news / seismic / weather wall
5. **Starship Cockpit** — flight-deck HUD
6. **Holo Deck (UI 4)** — holographic data wall modelled on the reference HUD: arc gauges,
   notched teal panels, rotating arc lattice and a live feed behind every readout
7. **God's Eye (UI 5)** — Argus/Atlas style global surveillance grid: a clickable world map
   with live aircraft, military tracks, cameras, orbital position, seismic and natural events,
   geo-pinned news, simulated traffic signals, dossiers, and a search box that asks IRA
   about anything on the map

## Run the interface

```bash
cd IRA-AI
python ira_server.py
```

Open `http://localhost:5173`.

## Cloud brain — no API key required

IRA now ships with `ira_brain.py`, the same keyless hosted-brain design used by Weronika.
The model key stays on the hosted app; this repository only relays the conversation.

```bash
python ira_server.py     # /api/brain is live immediately
```

Order of answering in `/api/brain`:

1. **Live-intent questions** (news, flights, military, cameras, traffic, weather, orbit,
   places, “where is…”) are answered from the live feed data, so numbers are true.
2. **Everything else** goes to the hosted cloud brain through `ira_brain.py`.
3. If that host is unreachable, IRA answers from the live-intelligence composer
   (`ira_intel.py`) and then Wikipedia. The UI reports the engine that answered.

Optional switches (environment variables):

```bash
export IRA_BRAIN=0                        # disable the hosted brain
export IRA_BRAIN_ORIGINS=https://your-own-published-app.lovable.app
export IRA_BRAIN_AS_IRA=0                 # keep the shared host's own persona
```

Point `IRA_BRAIN_ORIGINS` at your own published IRA project when you have one.

## Live intelligence — no API keys anywhere

`ira_intel.py` aggregates open, keyless feeds. Every layer reports its own health, so a
dead provider never fakes data:

| Layer | Source |
|---|---|
| Civil aircraft | ADS-B via airplanes.live / adsb.lol |
| Military aircraft | same providers, military filter |
| News | Google News RSS (world, India, tech, business, conflict) |
| Earthquakes | USGS M2.5+ / 24 h |
| Natural events | NASA EONET |
| Weather | Open-Meteo |
| Orbit | wheretheiss.at (ISS) |
| Places | OpenStreetMap Nominatim + Wikipedia geosearch |
| Cameras | public broadcaster live embeds + your own local camera |
| Traffic signals | **deterministic simulation** (labelled SIM in the UI) |
| Network nodes | **simulation** (labelled) |

Endpoints: `/api/intel`, `/api/intel/flights`, `/api/intel/place?q=`, `/api/intel/news?q=`,
`/api/cameras`, `/api/status`, and `POST /api/brain`.

## Connect a generative AI provider

IRA includes a secure server-side gateway for any OpenAI-compatible chat API. Keys never enter the browser.

```bash
export IRA_LLM_ENDPOINT="https://api.openai.com/v1/chat/completions"
export IRA_LLM_API_KEY="your-key"
export IRA_LLM_MODEL="gpt-4o-mini"
python ira_server.py
```

Without these variables, IRA automatically falls back to language-specific Wikipedia answers and built-in local responses.

## Features

- Speech-to-text through the browser Web Speech API (best in Chrome/Edge)
- Female text-to-speech using the browser's available system voices
- 82-entry offline English quick-answer knowledge file with 180 recognized phrases
- Wikipedia-backed knowledge fallback with source links
- Safe built-in arithmetic parser for addition, subtraction, multiplication, division, decimals, negatives, and parentheses
- Chat history and quick actions
- Seven switchable visual experiences, including the Holo Deck and God's Eye grid
- Keyless cloud brain with live-intelligence and Wikipedia fallbacks
- Drag/drop VRM loader with model metadata and local-only handling
- Automation control panel with explicit confirmation gates
- Companion Python automation bridge template following failsafe, dynamic-delay, process-control, and cross-platform standards

## Optional automation bridge

Install dependencies:

```bash
pip install pyautogui psutil pynput
```

Then run:

```bash
python automation_bridge.py
```

The bridge listens only on `127.0.0.1:8765`. For safety, it uses an allowlist and requires confirmation for impactful actions. Browsers may block a hosted page from calling a localhost service; for a packaged desktop release, connect the UI through Tauri/Electron IPC instead.

## Production roadmap

- Connect `/api/chat` to your chosen LLM provider from a secure server (never expose keys in the browser).
- Bundle `three`, `@pixiv/three-vrm`, and animation retargeting for full VRM rendering.
- Replace browser speech with streaming STT/TTS for lower latency and consistent voice.
- Package with Tauri for secure, permission-scoped desktop automation.
