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
GET  /api/realtime            legacy monitor feed (kept for older clients)
POST /api/brain               IRA's answer: cloud brain -> live intel -> Wikipedia
POST /api/chat                your own OpenAI-compatible provider (optional)
POST /api/intel/ask           alias of /api/brain for the God's Eye console

No API key is required for any of the above. The optional OpenAI-compatible
gateway still works when IRA_LLM_ENDPOINT and IRA_LLM_API_KEY are set.
"""

from __future__ import annotations

import json
import mimetypes
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

import ira_brain
import ira_intel

ROOT = Path(__file__).resolve().parent
HOST = os.getenv("IRA_HOST", "0.0.0.0")
PORT = int(os.getenv("IRA_PORT", "5173"))
ENDPOINT = os.getenv("IRA_LLM_ENDPOINT", "").strip()
API_KEY = os.getenv("IRA_LLM_API_KEY", "").strip()
MODEL = os.getenv("IRA_LLM_MODEL", "gpt-4o-mini")
MAX_BODY = 60_000

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
                "keyRequired": False,
            })

        if path == "/api/status":
            return self.send_json({
                "ok": True,
                "brain": ira_brain.brain_status(),
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
                },
            })

        if path == "/api/brain/status":
            return self.send_json(ira_brain.brain_status())

        if path == "/api/cameras":
            return self.send_json({"cameras": ira_intel.fetch_cameras()})

        if path in ("/api/intel", "/api/realtime"):
            params = self.query()
            full = params.get("full", "1") not in ("0", "false")
            try:
                data = ira_intel.get_intel(full=full)
            except Exception as exc:  # noqa: BLE001
                return self.send_json({"error": str(exc)}, 502)
            if path == "/api/realtime":
                # Legacy shape used by the original Global Monitor.
                legacy = {
                    "updated": data["generatedAt"],
                    "weather": data["weather"]["data"],
                    "earthquakes": data["earthquakes"]["data"],
                    "naturalEvents": data["naturalEvents"]["data"],
                    "headlines": data["headlines"]["data"],
                    "flights": data["flights"]["data"],
                    "military": data["military"]["data"],
                    "iss": data["iss"]["data"],
                    "traffic": data["traffic"]["data"],
                    "cameras": data["cameras"]["data"],
                    "systemNodes": data["systemNodes"]["data"],
                    "feeds": {
                        "weather": data["weather"]["ok"],
                        "earthquakes": data["earthquakes"]["ok"],
                        "naturalEvents": data["naturalEvents"]["ok"],
                        "headlines": data["headlines"]["ok"],
                        "flights": data["flights"]["ok"],
                        "military": data["military"]["ok"],
                    },
                    "brief": data["brief"],
                }
                return self.send_json(legacy)
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
        if path in ("/api/brain", "/api/intel/ask"):
            return self.answer_brain()
        if path == "/api/chat":
            return self.answer_gateway()
        return self.send_json({"error": "Not found"}, 404)

    def answer_brain(self) -> None:
        data = self.read_json()
        message = safe_text(data.get("message"))
        if not message:
            return self.send_json({"error": "Message is required"}, 400)
        history = data.get("history") if isinstance(data.get("history"), list) else []
        history = [item for item in history[-12:] if isinstance(item, dict)
                   and item.get("role") in ("user", "assistant") and item.get("content")]
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

        # Live questions are answered from the feed data itself so numbers stay true.
        if wants_live and intel_context:
            try:
                composed = ira_intel.compose_answer(message, intel_context, lang)
                return self.send_json({
                    "answer": composed["text"], "engine": "live-intel",
                    "source": composed.get("source"), "markers": composed.get("markers", []),
                    "generatedAt": intel_context["generatedAt"],
                })
            except Exception as exc:  # noqa: BLE001
                errors.append(f"live intelligence: {exc}")

        # General conversation / knowledge -> hosted cloud brain (no key).
        if ira_brain.ENABLED:
            try:
                reply = ira_brain.ask_brain(message, history, lang, title)
                return self.send_json({"answer": reply, "engine": "cloud-brain",
                                       "source": None, "markers": []})
            except Exception as exc:  # noqa: BLE001
                errors.append(f"cloud brain: {exc}")

        if not intel_context:
            try:
                intel_context = ira_intel.get_intel(full=False)
            except Exception:  # noqa: BLE001
                intel_context = None
        if intel_context:
            try:
                composed = ira_intel.compose_answer(message, intel_context, lang)
                if composed.get("text"):
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
            return self.send_json({"answer": wiki["extract"], "engine": "wikipedia",
                                   "source": wiki.get("url"), "markers": [],
                                   "degraded": True, "errors": errors[-2:]})

        return self.send_json({
            "answer": "My cloud brain and live feeds are both unreachable from this machine right now. "
                      "The interface is still fully interactive; reconnect and ask again.",
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


if __name__ == "__main__":
    print(f"IRA running at http://{HOST}:{PORT}")
    print("Cloud brain :", "enabled (no API key)" if ira_brain.ENABLED else "disabled")
    print("AI gateway  :", "configured" if ENDPOINT and API_KEY else "not configured (keyless brain active)")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
