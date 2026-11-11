"""IRA web server — static UI, live intelligence, and a keyless cloud brain.

Routes
------
GET  /api/health              server + brain + gateway status
GET  /api/status              brain status, feed health, feature flags
GET  /api/intel               full live-intelligence snapshot (all layers)
GET  /api/intel/flights       live aircraft only (civil + military)
GET  /api/intel/place?q=      geocode a place to lat/lon
GET  /api/intel/news?q=       headlines, optionally filtered
GET  /api/cameras             curated public live camera feeds
GET  /api/diagnostics         live CPU, memory, process, and network diagnostics
GET  /api/osint               ARGUS movement snapshot (flights/ships/trains/vehicles)
GET  /api/osint/ships         simulated ship tracks (labelled)
GET  /api/osint/trains        simulated train tracks (labelled)
GET  /api/osint/vehicles      simulated vehicle flow (labelled)
GET  /api/hermes/status       Hermes persistent memory + resume message
POST /api/hermes/learn        record one interaction (Hermes learns)
POST /api/brain               IRA's answer: cloud brain -> live intel -> Wikipedia
POST /api/chat                your own OpenAI-compatible provider (optional)

No API key is required for any of the above. The optional OpenAI-compatible
gateway still works when IRA_LLM_ENDPOINT and IRA_LLM_API_KEY are set.
"""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

import ira_brain
import ira_diagnostics
import ira_hermes
import ira_intel
import ira_office
import ira_office_files
import ira_osint
import ollama_brain

ROOT = Path(__file__).resolve().parent
HOST = os.getenv("IRA_HOST", "0.0.0.0")
PORT = int(os.getenv("IRA_PORT", "5173"))
ENDPOINT = os.getenv("IRA_LLM_ENDPOINT", "").strip()
API_KEY = os.getenv("IRA_LLM_API_KEY", "").strip()
MODEL = os.getenv("IRA_LLM_MODEL", "gpt-4o-mini")
MAX_BODY = 250_000

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "bn": "Bengali", "ta": "Tamil",
    "te": "Telugu", "mr": "Marathi", "gu": "Gujarati", "pa": "Punjabi",
    "ur": "Urdu", "es": "Spanish", "fr": "French", "de": "German",
    "pt": "Portuguese", "ar": "Arabic", "ja": "Japanese", "ko": "Korean",
    "zh": "Chinese", "ru": "Russian",
}

LIVE_INTENT = re.compile(
    r"\b(news|headline|briefing|earthquake|seismic|quake|tremor|natural event|wildfire|volcano|"
    r"cyclone|storm|flood|flight|flights|aircraft|plane|planes|ads-?b|air traffic|military|"
    r"air force|navy|fighter|jet|warplane|traffic|signal|junction|congestion|jam|camera|"
    r"cameras|broadcast|iss|orbit|satellite|iss|weather|temperature|rain|humidity|wind|"
    r"where is|locate|coordinates|on the map|map|live|radar|scope|grid|surveillance|"
    r"what'?s happening|what is happening)\b",
    re.IGNORECASE,
)


def language_name(locale: str) -> str:
    return LANGUAGE_NAMES.get((locale or "en").split("-")[0], "the user's language")


def safe_text(value, limit: int = 6000) -> str:
    return str(value or "").strip()[:limit]


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # ------------------------------------------------------------------ utils
    def send_json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        try:
            length = min(int(self.headers.get("Content-Length", "0")), MAX_BODY)
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, OSError):
            return {}

    def query(self) -> dict[str, str]:
        parsed = parse_qs(urlparse(self.path).query)
        return {key: values[-1] for key, values in parsed.items() if values}

    # -------------------------------------------------------------------- GET
    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path

        if path == "/api/health":
            return self.send_json({
                "ok": True,
                "aiConfigured": bool(ENDPOINT and API_KEY),
                "cloudBrain": ira_brain.ENABLED,
                "ollama": ollama_brain.brain_status(),
                "keyRequired": False,
            })

        if path == "/api/status":
            return self.send_json({
                "ok": True,
                "brain": ira_brain.brain_status(),
                "ollama": ollama_brain.brain_status(),
                "hermes": ira_hermes.get_status(),
                "gateway": {"configured": bool(ENDPOINT and API_KEY), "model": MODEL if API_KEY else None},
                "layers": {
                    "flights": "ADS-B public feeds (live)",
                    "military": "ADS-B military filter (live)",
                    "news": "Google News RSS (live)",
                    "earthquakes": "USGS (live)",
                    "naturalEvents": "NASA EONET (live)",
                    "weather": "Open-Meteo (live)",
                    "orbit": "wheretheiss.at (live)",
                    "cameras": "public broadcaster embeds (live)",
                    "traffic": "simulation (clearly labelled)",
                    "ships": "simulated AIS along real lanes (labelled)",
                    "trains": "simulated rail tracks (labelled)",
                    "vehicles": "simulated traffic flow (labelled)",
                    "hermes": "persistent local memory (data/hermes-memory.json)",
                },
            })

        if path == "/api/brain/status":
            return self.send_json(ira_brain.brain_status())

        if path == "/api/office/agents":
            return self.send_json({"agents": [ira_office.agent_public(agent) for agent in ira_office.AGENTS],
                                   "planner": "user-controlled-boss-rules"})

        if path == "/api/diagnostics":
            try:
                return self.send_json(ira_diagnostics.get_diagnostics())
            except Exception as exc:  # noqa: BLE001 - the UI has a labelled simulation fallback
                return self.send_json({"ok": False, "error": str(exc)}, 500)

        if path == "/api/cameras":
            return self.send_json({"cameras": ira_intel.fetch_cameras()})

        if path == "/api/hermes/status":
            return self.send_json(ira_hermes.get_status())

        if path == "/api/osint":
            try:
                return self.send_json(ira_osint.get_osint_snapshot())
            except Exception as exc:  # noqa: BLE001
                return self.send_json({"error": str(exc)}, 502)

        if path == "/api/osint/ships":
            return self.send_json({"ships": ira_osint.fetch_ships(),
                                   "simulated": True,
                                   "source": "IRA simulated AIS (no keyless live feed)"})

        if path == "/api/osint/trains":
            return self.send_json({"trains": ira_osint.fetch_trains(),
                                   "simulated": True,
                                   "source": "IRA simulated rail (no keyless GTFS-RT)"})

        if path == "/api/osint/vehicles":
            return self.send_json({"vehicles": ira_osint.fetch_vehicles(),
                                   "simulated": True,
                                   "source": "IRA simulated flow (not live telematics)"})

        if path == "/api/intel":
            params = self.query()
            full = params.get("full", "1") not in ("0", "false")
            try:
                data = ira_intel.get_intel(full=full)
            except Exception as exc:  # noqa: BLE001
                return self.send_json({"error": str(exc)}, 502)
            return self.send_json(data)

        if path == "/api/intel/flights":
            flights = ira_intel.feed_block(ira_intel.fetch_flights, "ADS-B civil")
            military = ira_intel.feed_block(ira_intel.fetch_military, "ADS-B military")
            return self.send_json({"flights": flights, "military": military,
                                   "generatedAt": int(ira_intel.time.time())})

        if path == "/api/intel/place":
            query = self.query().get("q", "").strip()
            if not query:
                return self.send_json({"error": "Query is required"}, 400)
            place = ira_intel.lookup_place(query)
            if not place:
                return self.send_json({"error": "Place not found", "query": query}, 404)
            return self.send_json(place)

        if path == "/api/intel/news":
            query = self.query().get("q", "").strip()
            news = ira_intel.feed_block(ira_intel.fetch_headlines, "Google News")
            items = news.get("data") or []
            if query:
                items = ira_intel._match_headlines(query, items, limit=20)
            return self.send_json({"ok": news["ok"], "error": news.get("error", ""),
                                   "headlines": items, "count": len(items)})

        # Static files (repo root only).
        clean = path.lstrip("/") or "index.html"
        target = (ROOT / clean).resolve()
        if ROOT not in target.parents and target != ROOT:
            return self.send_error(403)
        if not target.is_file():
            return self.send_error(404)
        data = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.end_headers()
        self.wfile.write(data)

    # ------------------------------------------------------------------- POST
    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/hermes/learn":
            data = self.read_json()
            status = ira_hermes.record_interaction(
                safe_text(data.get("question"), 2000),
                safe_text(data.get("answer"), 8000),
                safe_text(data.get("engine"), 40),
                safe_text(data.get("mode"), 20),
            )
            return self.send_json(status)
        if path == "/api/brain":
            return self.answer_brain()
        if path == "/api/office/plan":
            data = self.read_json()
            goal = safe_text(data.get("goal"), 4000)
            if not goal:
                return self.send_json({"error": "A boss objective is required"}, 400)
            return self.send_json({"planner": "user-controlled-boss-rules", "goal": goal,
                                   "tasks": ira_office.plan_office(goal)})
        if path == "/api/office/task":
            data = self.read_json()
            agent = safe_text(data.get("agent") or "atlas", 30)
            if agent not in ira_office.AGENTS:
                return self.send_json({"error": "Unknown office agent"}, 400)
            data["mode"] = "office"
            return self.answer_brain(data, ira_office.role_prompt(agent))
        if path == "/api/office/file":
            return self.answer_office_file()
        if path == "/api/chat":
            return self.answer_gateway()
        return self.send_json({"error": "Not found"}, 404)

    def answer_office_file(self) -> None:
        data = self.read_json()
        kind = safe_text(data.get("kind"), 20)
        title = safe_text(data.get("title") or "IRA Office Work", 120)
        content = str(data.get("content") or "")[:180_000]
        try:
            filename, mime, payload = ira_office_files.create_office_file(kind, title, content)
            return self.send_json({"filename": filename, "mime": mime, "size": len(payload),
                                   "content": base64.b64encode(payload).decode("ascii")})
        except ValueError as exc:
            return self.send_json({"error": str(exc)}, 400)
        except Exception as exc:  # noqa: BLE001
            return self.send_json({"error": f"Could not generate Office file: {exc}"}, 500)

    def _learn(self, question: str, answer: str, engine: str, mode: str) -> None:
        """Hermes learns from every answer (best-effort, never breaks replies)."""
        try:
            ira_hermes.record_interaction(question, answer, engine, mode)
        except Exception as exc:  # noqa: BLE001
            print(f"[Hermes] learn failed: {exc}")

    def answer_brain(self, supplied_data: dict | None = None, role_prompt: str = "") -> None:
        data = supplied_data if supplied_data is not None else self.read_json()
        message = safe_text(data.get("message"))
        if not message:
            return self.send_json({"error": "Message is required"}, 400)
        history = data.get("history") if isinstance(data.get("history"), list) else []
        history = [{"role": item["role"], "content": safe_text(item.get("content"))}
                   for item in history[-12:] if isinstance(item, dict)
                   and item.get("role") in ("user", "assistant") and safe_text(item.get("content"))]
        lang = safe_text(data.get("language") or data.get("lang") or "en", 12)
        title = safe_text(data.get("title") or "Commander", 40)
        mode = safe_text(data.get("mode") or "auto", 12)
        wants_live = mode == "live" or (mode == "auto" and bool(LIVE_INTENT.search(message)))

        intel_context = None
        if wants_live:
            try:
                intel_context = ira_intel.get_intel(full=True)
            except Exception as exc:  # noqa: BLE001
                print("[IRA] intel error:", exc)

        errors: list[str] = []

        # Local Ollama is preferred for every question when a selected model is ready.
        # Current events are grounded with verified feed text rather than model guesses.
        if ollama_brain.ENABLED:
            try:
                local_message = message
                if wants_live:
                    briefing = "Live feed context is unavailable; do not invent current values."
                    if intel_context:
                        try:
                            briefing = ira_intel.compose_answer(message, intel_context, lang).get("text") or briefing
                        except Exception as exc:  # noqa: BLE001
                            errors.append(f"live grounding: {exc}")
                    local_message = ("Use only the verified IRA live-feed context below for current values; "
                                     "say when a requested value is absent.\n\n" + briefing[:12_000] +
                                     "\n\nUser question: " + message)
                result = ollama_brain.ask_ollama(local_message, history, lang, title, role_prompt)
                self._learn(message, result["answer"], "ollama", mode)
                return self.send_json({"answer": result["answer"], "engine": "ollama",
                                       "model": result.get("model"), "source": None, "markers": []})
            except Exception as exc:  # noqa: BLE001 - optional sidecar must not break IRA
                errors.append(f"ollama: {exc}")

        # Without Ollama, live questions still answer directly from the feeds themselves.
        if wants_live and intel_context:
            try:
                composed = ira_intel.compose_answer(message, intel_context, lang)
                self._learn(message, composed["text"], "live-intel", mode)
                return self.send_json({
                    "answer": composed["text"], "engine": "live-intel",
                    "source": composed.get("source"), "markers": composed.get("markers", []),
                    "generatedAt": intel_context["generatedAt"],
                })
            except Exception as exc:  # noqa: BLE001
                errors.append(f"live intelligence: {exc}")

        # Existing hosted cloud remains available when the local brain is not running.
        if ira_brain.ENABLED:
            try:
                outgoing = (f"[IRA Office assignment instructions: {role_prompt}]\n" if role_prompt else "") + message
                reply = ira_brain.ask_brain(outgoing, history, lang, title)
                self._learn(message, reply, "cloud-brain", mode)
                return self.send_json({"answer": reply, "engine": "cloud-brain",
                                       "source": None, "markers": []})
            except Exception as exc:  # noqa: BLE001
                errors.append(f"cloud brain: {exc}")

        if not intel_context and mode != "office":
            try:
                intel_context = ira_intel.get_intel(full=False)
            except Exception:  # noqa: BLE001
                intel_context = None
        if intel_context:
            try:
                composed = ira_intel.compose_answer(message, intel_context, lang)
                if composed.get("text"):
                    self._learn(message, composed["text"], "live-intel", mode)
                    return self.send_json({
                        "answer": composed["text"], "engine": "live-intel",
                        "source": composed.get("source"), "markers": composed.get("markers", []),
                        "generatedAt": intel_context["generatedAt"],
                        "degraded": True, "errors": errors[-2:],
                    })
            except Exception as exc:  # noqa: BLE001
                errors.append(f"local composer: {exc}")

        wiki = ira_intel.wikipedia_summary(message, lang)
        if wiki:
            self._learn(message, wiki["extract"], "wikipedia", mode)
            return self.send_json({"answer": wiki["extract"], "engine": "wikipedia",
                                   "source": wiki.get("url"), "markers": [],
                                   "degraded": True, "errors": errors[-2:]})

        duckduckgo = ira_intel.duckduckgo_summary(message, lang)
        if duckduckgo:
            self._learn(message, duckduckgo["extract"], "duckduckgo", mode)
            return self.send_json({"answer": duckduckgo["extract"], "engine": "duckduckgo",
                                   "source": duckduckgo.get("url"), "markers": [],
                                   "degraded": True, "errors": errors[-2:]})

        return self.send_json({
            "answer": "Ollama and my other knowledge connections are unreachable right now. "
                      "Start ollama_brain.py for local answers, or reconnect and try again.",
            "engine": "offline", "source": None, "markers": [],
            "errors": errors[-3:],
        }, 200)

    def answer_gateway(self) -> None:
        if not ENDPOINT or not API_KEY:
            return self.send_json({"error": "AI provider is not configured"}, 503)
        try:
            data = self.read_json()
            message = safe_text(data.get("message"))
            if not message:
                return self.send_json({"error": "Message is required"}, 400)
            language = language_name(safe_text(data.get("language") or "en", 12))
            title = safe_text(data.get("title") or "Commander", 40)
            system = (
                "You are IRA, a warm, capable female-voiced personal AI assistant. "
                f"Address the user as {title}. Reply in {language}, matching the language "
                "and script used by the user. Be concise but useful. Never claim an action "
                "was performed unless the automation system confirms it."
            )
            payload = json.dumps({
                "model": MODEL,
                "messages": [{"role": "system", "content": system},
                             {"role": "user", "content": message}],
                "temperature": 0.65,
            }).encode()
            request = Request(ENDPOINT, data=payload, method="POST", headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            })
            with urlopen(request, timeout=35) as response:
                result = json.loads(response.read())
            answer = result["choices"][0]["message"]["content"].strip()
            self.send_json({"answer": answer, "model": MODEL, "engine": "gateway"})
        except (HTTPError, URLError, TimeoutError) as exc:
            self.send_json({"error": f"AI provider unavailable: {exc}"}, 502)
        except Exception as exc:  # noqa: BLE001
            self.send_json({"error": str(exc)}, 500)

    def log_message(self, fmt: str, *args) -> None:
        print(f"[IRA] {self.address_string()} - {fmt % args}")


def _hermes_heartbeat() -> None:
    """Hermes self-upgrade heartbeat: +1 XP per second, persisted every 5s."""
    while True:
        time.sleep(5)
        try:
            ira_hermes.tick(5)
        except Exception as exc:  # noqa: BLE001 - never kill the server
            print(f"[Hermes] heartbeat tick failed: {exc}")


if __name__ == "__main__":
    _hermes_boot = ira_hermes.boot_session()
    print(f"IRA running at http://{HOST}:{PORT}")
    print("Ollama     : optional local brain (run python ollama_brain.py)")
    print("Cloud brain :", "enabled (no API key)" if ira_brain.ENABLED else "disabled")
    print("AI gateway  :", "configured" if ENDPOINT and API_KEY else "not configured (keyless brain active)")
    print(f"Hermes     : level {_hermes_boot['level']} · {_hermes_boot['totalInteractions']} interactions · session #{_hermes_boot['sessionCount']}")
    print(f"Hermes says: {_hermes_boot['resumeMessage']}")
    threading.Thread(target=_hermes_heartbeat, daemon=True, name="hermes-heartbeat").start()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
