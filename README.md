# IRA AI — Immersive Responsive Assistant

A polished browser prototype for a multimodal personal assistant with three visual modes:

1. **Liquid Orb** — animated voice-reactive visualizer
2. **Anime Persona** — cinematic avatar presentation
3. **VRM Studio** — local `.vrm` file loader shell (privacy-first; files stay in the browser)

## Run the interface

```bash
cd ira-ai
python ira_server.py
```

Open `http://localhost:5173`.

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
- Three switchable visual experiences
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
