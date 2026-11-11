# IRA AI — Immersive Responsive Assistant

A polished browser prototype for a multimodal personal assistant with **six visual modes**:

1. **Liquid Orb** — animated voice-reactive visualizer
2. **Anime Persona** — cinematic avatar presentation
3. **VRM Studio** — local `.vrm` avatar loader with an interactive 3D viewport
4. **EDEX Command Deck** — a sci-fi command center inspired by eDEX-UI, with an IRA conversation
   terminal, interactive globe, live system diagnostics and line graphs, application shortcuts,
   and an automatic YouTube news-video manager
5. **IRA Office** — a blue high-tech office with ten seated specialists, one user-controlled boss,
   individual workspaces, research/coding tools, a browser, and real Word/Excel/PowerPoint downloads
6. **IRA Jarvis Helmet** — an Iron Man-style helmet HUD with live news boxes, an OSINT globe tracking
   flights, military aircraft, the ISS, quakes and natural events alongside moving ship, train and
   vehicle tracks, public live camera embeds, and **Hermes**, a persistent learning agent

VRM files stay in the browser and are never uploaded.

## Run the interface

```bash
cd IRA-AI
python ira_server.py
```

Open `http://localhost:5173`. The server binds to `0.0.0.0` by default; optionally set
`IRA_HOST` or `IRA_PORT` to change that. The main interface and Office file generator use only
Python's standard library.

## Ollama local brain — no API key

IRA can prefer a local [Ollama](https://ollama.com/) model in every interface, including all Office
staff. No Ollama API key or cloud credential is required. The browser never connects directly to
the model: `ira_server.py` performs the local `/api/tags` health check and `/api/chat` request.

Install Ollama separately, then use two terminals:

```bash
# Terminal 1 — IRA web interface and API
python ira_server.py

# Terminal 2 — activate an already-installed Ollama service/model
python ollama_brain.py
```

`ollama_brain.py` starts `ollama serve` if needed, detects installed models, saves the selected
model in ignored `data/ollama-runtime.json`, and reports the active endpoint/model. If it started
the Ollama service itself, keep that terminal open; press Ctrl+C to stop the service it owns.
If Ollama was already running, the launcher can exit while the existing service remains available.

If no model is installed, pull a small starter model explicitly (this is a large download):

```bash
python ollama_brain.py --model qwen2.5:1.5b --pull
```

If the `ollama` executable is absent, the launcher prints installation instructions and exits.
It never claims that a local model is active. `GET /api/health` exposes the actual `connected`,
`ready`, selected-model, and reason fields; health results are cached briefly to avoid probing on
every keystroke.

Optional environment switches:

```bash
export IRA_OLLAMA=1                              # set 0 to disable local routing
export IRA_OLLAMA_HOST=http://127.0.0.1:11434
export IRA_OLLAMA_MODEL=qwen2.5:1.5b             # optional installed-model preference
export IRA_OLLAMA_TIMEOUT=120                    # generation timeout in seconds
```

### Answering order and honest fallback

Local arithmetic and built-in quick answers still resolve immediately in the browser. For other
questions, `/api/brain` uses this order:

1. **Ollama**, when its health check finds the selected installed model. Live-intent questions
   include verified feed context so the model does not invent current numbers.
2. Without Ollama, **live-intent answers** continue to come directly from the live feed composer.
3. General questions use the existing **Weronika-style hosted cloud brain** in `ira_brain.py`.
4. IRA then tries live intelligence, **Wikipedia**, and the keyless **DuckDuckGo Instant Answer**
   fallback in `ira_intel.py`. The browser retains its Wikipedia fallback if Python is unreachable.
5. If every connection is unavailable, IRA says so honestly; it does not invent a model response.

The top bar identifies Ollama, hosted cloud, live knowledge, DuckDuckGo, or offline status.
Starting `ollama_brain.py` is optional: existing chat and knowledge behavior remains available
without it.

Hosted-brain environment switches:

```bash
export IRA_BRAIN=0                        # disable the hosted brain
export IRA_BRAIN_ORIGINS=https://your-own-published-app.lovable.app
export IRA_BRAIN_AS_IRA=0                 # keep the shared host's own persona
export IRA_BRAIN_TIMEOUT=25               # hosted request timeout in seconds
```

`IRA_BRAIN_ORIGINS` accepts a comma-separated list. The hosted model key remains on its published
host; neither this repository nor browser code contains that provider key.

## IRA Office

Choose **OFFICE** under **Settings → Interface mode**. The original four modes remain available.
The fifth interface is an architectural **top-down office room**, not a generic agent card grid:
seated staff work at detailed monitor/keyboard desks inside department bays, alongside a glass
executive cabin, conference room, coffee bar, lounge, plants, windows, and entrance. Working,
selected, complete, and error states appear on the staff member's actual workstation. The complete
room fits shorter laptop viewports and remains scrollable on narrow screens.

### Boss and staff

You control **IRA Prime**, the boss. Enter an objective in the command bar or use voice input.
A deterministic, rule-based boss planner assigns up to five relevant tasks; it does not pretend
that planning came from an LLM. Staff tasks execute sequentially through the same `/api/brain`
pipeline, with role-specific instructions, Ollama-first routing, and the same honest fallbacks.
Select any staff member on the floor or in the workspace's staff selector for a direct assignment,
or open a delegated task to inspect its result. Every specialized app includes an assignment box:
type or edit the artifact yourself, then ask its owner to revise the current shared work. Subsequent
assignments include that app state as context, and IRA's delegated answers return to the owning app.

| Agent | Dedicated workspace |
|---|---|
| Atlas | Research Desk |
| Pixel | Shared VS Code-style engineering editor — implementation |
| Byte | The same engineering files — QA review in `qa-review.md` |
| Worden | Editable Word document studio |
| Grid | Editable Excel-style workbook |
| Slides | Editable PowerPoint-style slide deck |
| Archie | OneNote-style shared notebook |
| Sage | Drawable whiteboard with editable sticky notes |
| Echo | Local Classroom stream |
| Scout | Embedded/external browser and research findings |

The operations sidebar shows queued/running/completed/error states, progress, and an activity log.
Editable artifacts persist locally in `localStorage` under `iraOfficeSectorWorkspacesV1`; task-run
history is session state. The agents are coordinated interfaces over one connected brain—not claims
of separate autonomous employees.

### Applications and real files

- **Research:** grounded answers through the shared brain and knowledge fallbacks.
- **Code:** multiple editable files, language selection, file download, and separate Pixel/Byte
  controls over the same source and QA documents. This is a VS Code-style editor, not a claim that
  code ran; review generated code before executing it.
- **Word:** an editable page with basic formatting controls and a real `.docx` download.
- **Excel:** editable cells, a formula bar, row/column controls, and a real `.xlsx` download. CSV,
  tab-separated, Markdown tables, and JSON rows are supported; numbers retain numeric types. A small
  allowlist of `SUM`, `AVERAGE`, `MIN`, `MAX`, and `COUNT` cell-range formulas is preserved.
- **PowerPoint:** editable slide titles/bullets, thumbnails, add/delete controls, and a real `.pptx`
  download. Agent outlines use `Slide: Title` followed by bullets.
- **OneNote:** persistent editable pages and notebook navigation. **DOCX** exports the notebook; IRA
  does not claim to produce Microsoft's proprietary `.one` format.
- **Classroom:** publish local announcements/assignments and export a text stream. This is **not
  synchronized with Google Classroom** and the interface labels that limitation explicitly.
- **Whiteboard:** draw with mouse/touch, edit sticky notes, clear drawings, and export a real PNG.
- **Browser:** enter a URL/search, use embedded browsing where the destination permits it, or open
  the page externally. Scout records research findings and source links beside the browser. Sites
  with `X-Frame-Options`/CSP frame restrictions require **OPEN EXTERNAL**; embedding does not bypass
  cross-origin page-access rules.

Office packages are generated in memory on the server with standard-library OOXML packaging and
returned as downloads. Generated work is **not** written into the Git repository. The packages
have been reopened during development with `python-docx`, `openpyxl`, and `python-pptx`; those
libraries are not runtime dependencies.

Office API routes:

- `GET /api/office/agents`
- `POST /api/office/plan` with `{ "goal": "…" }`
- `POST /api/office/task` with `{ "agent": "atlas", "message": "…" }`
- `POST /api/office/file` with `{ "kind": "word|excel|powerpoint", "title": "…", "content": "…" }`

## Live intelligence used by answers

`ira_intel.py` aggregates open, keyless feeds. Every layer reports its own health, so a dead
provider is never presented as live data.

| Layer | Source |
|---|---|
| Civil aircraft | ADS-B via airplanes.live / adsb.lol |
| Military aircraft | Same providers, military filter |
| News | Google News RSS |
| Earthquakes | USGS M2.5+ / 24 h |
| Natural events | NASA EONET |
| Weather | Open-Meteo |
| Orbit | wheretheiss.at (ISS) |
| Places | OpenStreetMap Nominatim + Wikipedia geosearch |
| Cameras | Public broadcaster live embeds |
| Traffic signals | **Deterministic simulation**, labelled as simulated |
| Network nodes | **Simulation**, labelled as simulated |

Available API routes include `/api/intel`, `/api/intel/flights`, `/api/intel/place?q=`,
`/api/intel/news?q=`, `/api/cameras`, `/api/diagnostics`, `/api/status`, `/api/health`, and
`POST /api/brain`.

## EDEX Command Deck

Choose **EDEX** under **Settings → Interface mode**. It is intentionally not pinned to the top bar.

- **Main terminal:** talk to the same connected assistant as the other interfaces, use voice input,
  and run `/help`, `/news`, `/status`, or `/clear`.
- **World view:** drag the rotating globe to inspect it, pause/resume rotation, and view IRA's
  Delhi node plus live seismic, natural-event, and orbital markers when feeds are reachable.
- **Diagnostics:** watch 60-second CPU, memory, and network line graphs. `/api/diagnostics` uses
  `psutil` when installed and a zero-dependency `/proc` reader on Linux. If the endpoint is
  unavailable, the UI explicitly labels its animated fallback as **SIMULATION**.
- **Applications:** launch the browser, calculator, WhatsApp Web, or close the active app through
  the existing local automation bridge. Every action still requires explicit confirmation.
- **News manager:** play DW News, Al Jazeera English, Sky News, or NDTV 24×7 live embeds. Videos
  start muted to satisfy browser autoplay policies. The queue advances on stream end, embed errors,
  unavailable feeds, or connection timeout; a manual pause stays paused. Channel selection,
  previous/next, play/pause, mute, and opening the channel on YouTube are available.

YouTube playback depends on network access, current channel livestreams, and each provider's
embedding policy. Unavailable embeds are skipped automatically; **OPEN ↗** remains available as
a direct fallback.

## IRA Jarvis Helmet (UI 6)

Choose **JARVIS** under **Settings → Interface mode**. It is intentionally not pinned to the top bar.

- **Iron-helmet HUD:** original IRA artwork of an Iron Man-style helmet with glowing eyes that react
  while IRA speaks, a HUD command bar, and a built-in ask box — answers render inside the helmet view.
- **Live news boxes:** world, technology and business headlines via Google News RSS (no key), with a
  scrolling headline ticker; cards link out to the source story.
- **OSINT globe:** a draggable orthographic globe rendering live, keyless public feeds — ADS-B civil and
  military aircraft (airplanes.live / adsb.lol), the ISS orbit (wheretheiss.at), USGS earthquakes and NASA
  EONET natural events — alongside **simulated** tracks for 24 ships on six real lanes, 8 trains (Rajdhani,
  Shinkansen, TGV, Acela), 30 vehicles on six Indian and global corridors, and simulated Delhi/Mumbai/Bengaluru/
  New York/London/Tokyo traffic signals. Ships, trains, vehicles and traffic are clearly labelled **SIM** in the
  legend and stats bar; no keyless live AIS/GTFS/telematics feed exists, so these layers are deterministic
  simulations along real corridors — never presented as live data.
- **Cameras:** curated publicly embeddable live feeds (DW News, Al Jazeera English, Sky News, NASA Live and
  more) — no key, no scraping, no stored video.
- **Hermes — persistent learning agent:** she remembers every session in `data/hermes-memory.json`
  (git-ignored), learns from each answer IRA gives, tracks the topics you ask about, and gains XP/levels
  (+1 XP per second, +10–30 per interaction). On restart she restores the session — "Welcome back. Last
  time we left off at …" — with her level, interaction count and favourite topics intact. The XP/level
  system is a transparent memory counter, **not** neural-network training; nothing about it is hidden.

Live feeds require outbound network access to their public endpoints; if a feed is unreachable the UI
shows an honest offline/partial-feed state instead of fabricated data.

## Optional OpenAI-compatible provider

A secure server-side gateway is also available at `POST /api/chat`. Keys never enter the browser.
If configured, the core interface tries this gateway when the primary brain and server-side
knowledge fallbacks are unavailable.

```bash
export IRA_LLM_ENDPOINT="https://api.openai.com/v1/chat/completions"
export IRA_LLM_API_KEY="your-key"
export IRA_LLM_MODEL="gpt-4o-mini"
python ira_server.py
```

## Other features

- Speech-to-text through the browser Web Speech API (best in Chrome/Edge)
- Text-to-speech using the browser's available system voices, with a manual Orb **SPEAK** replay
  button, speaking state, and playback error feedback. The Orb response and text composer remain
  clearly separated.
- Automatic language detection and matching spoken responses
- 82-entry offline English quick-answer knowledge file with 180 recognized phrases
- Wikipedia-backed knowledge fallback with source links
- Safe local arithmetic parser for decimals, negatives, parentheses, and common operations
- Text chat, voice chat, and quick actions
- Drag/drop VRM loader with model metadata and local-only processing
- Automation control panel with explicit confirmation gates

## Optional automation bridge

Install dependencies:

```bash
pip install -r requirements.txt
```

Then run:

```bash
python automation_bridge.py
```

The bridge listens only on `127.0.0.1:8765`. For safety, it uses an allowlist and requires
confirmation for impactful actions. Browsers may block a hosted page from calling a localhost
service; for a packaged desktop release, connect the UI through Tauri/Electron IPC instead.

## Development and tests

Run the dependency-free server, planner, Ollama-routing, OOXML, Hermes persistence, and OSINT-simulation tests:

```bash
python -m unittest discover -s tests -v
```

The tests mock model/network responses; they do not claim that Ollama is installed or that a hosted
provider is reachable. Rebuild the bundled local VRM engine after changing its source/dependencies:

```bash
npm install
npm run bundle:vrm
```

## Data and design credits

- The EDEX mode is an original IRA browser implementation inspired by the layout of
  [GitSquared/eDEX-UI](https://github.com/GitSquared/edex-ui); it does not copy its terminal code.
- Globe boundaries use the public-domain Natural Earth dataset packaged by
  [johan/world.geo.json](https://github.com/johan/world.geo.json). Its UNLICENSE is included at
  `data/world-geo-UNLICENSE.txt`.
- The top-down Office room is original IRA DOM/CSS. [floor/agents](https://github.com/floor/agents)
  was reviewed only as an agent-orchestration reference; its README states that it has no UI, and
  no code or visual assets were copied from it.
