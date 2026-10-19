"""IRA web server with an optional OpenAI-compatible AI gateway.

Set environment variables before starting:
  IRA_LLM_ENDPOINT=https://api.openai.com/v1/chat/completions
  IRA_LLM_API_KEY=...
  IRA_LLM_MODEL=gpt-4o-mini

The browser never receives the API key. Any OpenAI-compatible provider can be used.
"""
from __future__ import annotations
import json
import mimetypes
import os
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent
HOST = os.getenv("IRA_HOST", "0.0.0.0")
PORT = int(os.getenv("IRA_PORT", "5173"))
ENDPOINT = os.getenv("IRA_LLM_ENDPOINT", "").strip()
API_KEY = os.getenv("IRA_LLM_API_KEY", "").strip()
MODEL = os.getenv("IRA_LLM_MODEL", "gpt-4o-mini")

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "bn": "Bengali", "ta": "Tamil",
    "te": "Telugu", "mr": "Marathi", "gu": "Gujarati", "pa": "Punjabi",
    "ur": "Urdu", "es": "Spanish", "fr": "French", "de": "German",
    "pt": "Portuguese", "ar": "Arabic", "ja": "Japanese", "ko": "Korean",
    "zh": "Chinese", "ru": "Russian",
}
REALTIME_CACHE: dict = {"at": 0.0, "data": None}

def fetch_bytes(url: str, timeout: int = 12) -> bytes:
    req = Request(url, headers={"User-Agent": "IRA-AI-Monitor/1.0"})
    with urlopen(req, timeout=timeout) as response:
        return response.read()

def get_realtime_data() -> dict:
    """Aggregate public live feeds, cached to be respectful of providers."""
    now = time.time()
    if REALTIME_CACHE["data"] and now - REALTIME_CACHE["at"] < 120:
        return REALTIME_CACHE["data"]
    result = {"updated": int(now), "weather": None, "earthquakes": [], "naturalEvents": [], "headlines": []}
    try:
        weather = json.loads(fetch_bytes("https://api.open-meteo.com/v1/forecast?latitude=28.6692&longitude=77.4538&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto"))
        current = weather.get("current", {})
        result["weather"] = {"temperature": current.get("temperature_2m", 0), "wind": current.get("wind_speed_10m", 0), "code": current.get("weather_code")}
    except Exception as exc:
        print("[IRA realtime] weather:", exc)
    try:
        quakes = json.loads(fetch_bytes("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"))
        for feature in quakes.get("features", [])[:120]:
            coordinates = feature.get("geometry", {}).get("coordinates", [0, 0])
            props = feature.get("properties", {})
            result["earthquakes"].append({"title": props.get("title", "Seismic event"), "lat": coordinates[1], "lon": coordinates[0], "mag": props.get("mag"), "time": props.get("time"), "url": props.get("url")})
    except Exception as exc:
        print("[IRA realtime] earthquakes:", exc)
    try:
        eonet = json.loads(fetch_bytes("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=120"))
        for event in eonet.get("events", []):
            geometries = event.get("geometry", [])
            if not geometries:
                continue
            coordinates = geometries[-1].get("coordinates", [])
            if not (isinstance(coordinates, list) and len(coordinates) >= 2 and isinstance(coordinates[0], (int, float))):
                continue
            categories = event.get("categories", [])
            result["naturalEvents"].append({
                "title": event.get("title", "Natural event"),
                "lat": coordinates[1], "lon": coordinates[0],
                "category": categories[0].get("title", "Natural event") if categories else "Natural event",
                "date": geometries[-1].get("date", ""),
                "url": (event.get("sources") or [{}])[0].get("url", "")
            })
    except Exception as exc:
        print("[IRA realtime] NASA EONET:", exc)
    try:
        root = ET.fromstring(fetch_bytes("https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en"))
        for item in root.findall("./channel/item")[:20]:
            raw_title = item.findtext("title", "Live headline")
            source = item.findtext("source", "Google News")
            result["headlines"].append({"title": raw_title, "url": item.findtext("link", "#"), "source": source, "published": item.findtext("pubDate", "")})
    except Exception as exc:
        print("[IRA realtime] headlines:", exc)
    REALTIME_CACHE.update(at=now, data=result)
    return result

class Handler(BaseHTTPRequestHandler):
    def send_json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/api/health":
            return self.send_json({"ok": True, "aiConfigured": bool(ENDPOINT and API_KEY)})
        if self.path == "/api/realtime":
            try:
                return self.send_json(get_realtime_data())
            except Exception as exc:
                return self.send_json({"error": str(exc)}, 502)
        clean = self.path.split("?", 1)[0].lstrip("/") or "index.html"
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
        self.send_header("Pragma", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        if self.path != "/api/chat":
            return self.send_json({"error": "Not found"}, 404)
        if not ENDPOINT or not API_KEY:
            return self.send_json({"error": "AI provider is not configured"}, 503)
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 20_000)
            data = json.loads(self.rfile.read(length))
            message = str(data.get("message", "")).strip()[:6000]
            locale = str(data.get("language", "en-IN"))
            title = str(data.get("title", "Commander"))[:40]
            if not message:
                return self.send_json({"error": "Message is required"}, 400)
            language = LANGUAGE_NAMES.get(locale.split("-")[0], "the user's language")
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
            req = Request(ENDPOINT, data=payload, method="POST", headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            })
            with urlopen(req, timeout=35) as response:
                result = json.loads(response.read())
            answer = result["choices"][0]["message"]["content"].strip()
            self.send_json({"answer": answer, "model": MODEL})
        except (HTTPError, URLError, TimeoutError) as exc:
            self.send_json({"error": f"AI provider unavailable: {exc}"}, 502)
        except Exception as exc:
            self.send_json({"error": str(exc)}, 500)

    def log_message(self, fmt: str, *args) -> None:
        print(f"[IRA] {self.address_string()} - {fmt % args}")

if __name__ == "__main__":
    print(f"IRA running at http://{HOST}:{PORT}")
    print("AI gateway:", "configured" if ENDPOINT and API_KEY else "not configured (Wikipedia fallback active)")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
