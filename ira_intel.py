"""IRA live-intelligence layer — real public feeds, zero API keys.

Everything in this module is sourced from open, keyless endpoints:

    weather ....... open-meteo.com
    earthquakes ... earthquake.usgs.gov
    natural events  eonet.gsfc.nasa.gov  (NASA)
    headlines ..... news.google.com RSS
    flights ....... api.airplanes.live / api.adsb.lol / api.adsbexchange.com (ADS-B)
    military ...... same providers, military filter
    orbit ......... api.wheretheiss.at  (ISS)
    places ........ nominatim.openstreetmap.org + Wikipedia geosearch
    knowledge ..... <lang>.wikipedia.org REST API

If a provider is unreachable the feed reports ``ok: false`` and the rest of the
interface keeps working. Nothing here pretends a failed feed succeeded.

Two layers are explicitly simulated and labelled as such in the UI and in the API:
``traffic`` (junction signal phases, deterministic from the clock) and the
``system`` network nodes. Military/civil aircraft, cameras, quakes, events,
weather, orbit and news are real.
"""

from __future__ import annotations

import gzip
import json
import math
import re
import threading
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

USER_AGENT = "IRA-AI-GodsEye/1.0 (+https://github.com/keshavdixitxxx-creator/IRA-AI)"
HOME = {"lat": 28.6692, "lon": 77.4538, "label": "Ghaziabad"}

_lock = threading.Lock()
_cache: dict[str, dict] = {}


# --------------------------------------------------------------------------- #
# HTTP helpers
# --------------------------------------------------------------------------- #
def _http(url: str, timeout: float = 9.0, headers: dict | None = None) -> bytes:
    request_headers = {"User-Agent": USER_AGENT, "Accept": "*/*", "Accept-Encoding": "gzip"}
    request_headers.update(headers or {})
    request = Request(url, headers=request_headers)
    with urlopen(request, timeout=timeout) as response:
        data = response.read()
        if (response.headers.get("Content-Encoding") or "").lower() == "gzip":
            try:
                data = gzip.decompress(data)
            except OSError:
                pass
        return data


def _json(url: str, timeout: float = 9.0) -> Any:
    return json.loads(_http(url, timeout).decode("utf-8", "replace"))


def cached(key: str, ttl: float, producer):
    """Small thread-safe TTL cache so public feeds are not hammered."""
    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and now - hit["at"] < ttl:
            return hit["data"]
    data = producer()
    with _lock:
        _cache[key] = {"at": now, "data": data}
    return data


def feed_block(producer, label: str) -> dict:
    """Run one feed; never raise. Returns {'ok', 'data'|'error', 'ms'}."""
    started = time.time()
    try:
        data = producer()
        return {"ok": True, "data": data, "ms": int((time.time() - started) * 1000), "source": label}
    except Exception as exc:  # noqa: BLE001 - status is data here
        print(f"[IRA intel] {label}: {exc}")
        return {"ok": False, "error": str(exc)[:180], "ms": int((time.time() - started) * 1000),
                "source": label}


# --------------------------------------------------------------------------- #
# Gazetteer — used to place headlines and answer "where is ..." without a key
# --------------------------------------------------------------------------- #
GAZETTEER: dict[str, tuple[float, float, str]] = {
    "delhi": (28.6139, 77.2090, "India"), "new delhi": (28.6139, 77.2090, "India"),
    "ghaziabad": (28.6692, 77.4538, "India"), "noida": (28.5355, 77.3910, "India"),
    "gurugram": (28.4595, 77.0266, "India"), "mumbai": (19.0760, 72.8777, "India"),
    "kolkata": (22.5726, 88.3639, "India"), "chennai": (13.0827, 80.2707, "India"),
    "bengaluru": (12.9716, 77.5946, "India"), "hyderabad": (17.3850, 78.4867, "India"),
    "ahmedabad": (23.0225, 72.5714, "India"), "pune": (18.5204, 73.8567, "India"),
    "jaipur": (26.9124, 75.7873, "India"), "lucknow": (26.8467, 80.9462, "India"),
    "varanasi": (25.3176, 82.9739, "India"), "patna": (25.5941, 85.1376, "India"),
    "srinagar": (34.0837, 74.7973, "India"), "kashmir": (34.0837, 74.7973, "India"),
    "ladakh": (34.1526, 77.5771, "India"), "kerala": (10.8505, 76.2711, "India"),
    "tamil nadu": (11.1271, 78.6569, "India"), "gujarat": (22.2587, 71.1924, "India"),
    "assam": (26.2006, 92.9376, "India"), "odisha": (20.9517, 85.0985, "India"),
    "pakistan": (30.3753, 69.3451, "Pakistan"), "islamabad": (33.6844, 73.0479, "Pakistan"),
    "karachi": (24.8607, 67.0011, "Pakistan"), "lahore": (31.5204, 74.3587, "Pakistan"),
    "afghanistan": (33.9391, 67.7100, "Afghanistan"), "kabul": (34.5553, 69.2075, "Afghanistan"),
    "iran": (32.4279, 53.6880, "Iran"), "tehran": (35.6892, 51.3890, "Iran"),
    "iraq": (33.2232, 43.6793, "Iraq"), "baghdad": (33.3152, 44.3661, "Iraq"),
    "israel": (31.0461, 34.8516, "Israel"), "gaza": (31.5017, 34.4668, "Palestine"),
    "jerusalem": (31.7683, 35.2137, "Israel"), "lebanon": (33.8547, 35.8623, "Lebanon"),
    "beirut": (33.8938, 35.5018, "Lebanon"), "syria": (34.8021, 38.9968, "Syria"),
    "damascus": (33.5138, 36.2765, "Syria"), "yemen": (15.5527, 48.5164, "Yemen"),
    "saudi arabia": (23.8859, 45.0792, "Saudi Arabia"), "riyadh": (24.7136, 46.6753, "Saudi Arabia"),
    "uae": (23.4241, 53.8478, "UAE"), "dubai": (25.2048, 55.2708, "UAE"),
    "qatar": (25.3548, 51.1839, "Qatar"), "kuwait": (29.3117, 47.4818, "Kuwait"),
    "turkey": (38.9637, 35.2433, "Türkiye"), "istanbul": (41.0082, 28.9784, "Türkiye"),
    "russia": (61.5240, 105.3188, "Russia"), "moscow": (55.7558, 37.6173, "Russia"),
    "ukraine": (48.3794, 31.1656, "Ukraine"), "kyiv": (50.4501, 30.5234, "Ukraine"),
    "kyiv ": (50.4501, 30.5234, "Ukraine"), "crimea": (45.3453, 34.4997, "Ukraine"),
    "belarus": (53.7098, 27.9534, "Belarus"), "poland": (51.9194, 19.1451, "Poland"),
    "warsaw": (52.2297, 21.0122, "Poland"), "germany": (51.1657, 10.4515, "Germany"),
    "berlin": (52.5200, 13.4050, "Germany"), "france": (46.2276, 2.2137, "France"),
    "paris": (48.8566, 2.3522, "France"), "uk": (55.3781, -3.4360, "United Kingdom"),
    "london": (51.5072, -0.1276, "United Kingdom"), "britain": (55.3781, -3.4360, "United Kingdom"),
    "spain": (40.4637, -3.7492, "Spain"), "madrid": (40.4168, -3.7038, "Spain"),
    "italy": (41.8719, 12.5674, "Italy"), "rome": (41.9028, 12.4964, "Italy"),
    "greece": (39.0742, 21.8243, "Greece"), "netherlands": (52.1326, 5.2913, "Netherlands"),
    "amsterdam": (52.3676, 4.9041, "Netherlands"), "belgium": (50.5039, 4.4699, "Belgium"),
    "brussels": (50.8503, 4.3517, "Belgium"), "sweden": (60.1282, 18.6435, "Sweden"),
    "norway": (60.4720, 8.4689, "Norway"), "finland": (61.9241, 25.7482, "Finland"),
    "hungary": (47.1625, 19.5033, "Hungary"), "romania": (45.9432, 24.9668, "Romania"),
    "serbia": (44.0165, 21.0059, "Serbia"), "croatia": (45.1000, 15.2000, "Croatia"),
    "united states": (37.0902, -95.7129, "United States"), "usa": (37.0902, -95.7129, "United States"),
    "washington": (38.9072, -77.0369, "United States"), "new york": (40.7128, -74.0060, "United States"),
    "los angeles": (34.0522, -118.2437, "United States"), "chicago": (41.8781, -87.6298, "United States"),
    "texas": (31.9686, -99.9018, "United States"), "florida": (27.6648, -81.5158, "United States"),
    "california": (36.7783, -119.4179, "United States"), "canada": (56.1304, -106.3468, "Canada"),
    "toronto": (43.6532, -79.3832, "Canada"), "ottawa": (45.4215, -75.6972, "Canada"),
    "mexico": (23.6345, -102.5528, "Mexico"), "brazil": (-14.2350, -51.9253, "Brazil"),
    "sao paulo": (-23.5505, -46.6333, "Brazil"), "rio": (-22.9068, -43.1729, "Brazil"),
    "argentina": (-38.4161, -63.6167, "Argentina"), "buenos aires": (-34.6037, -58.3816, "Argentina"),
    "chile": (-35.6751, -71.5430, "Chile"), "colombia": (4.5709, -74.2973, "Colombia"),
    "venezuela": (6.4238, -66.5897, "Venezuela"), "peru": (-9.1900, -75.0152, "Peru"),
    "china": (35.8617, 104.1954, "China"), "beijing": (39.9042, 116.4074, "China"),
    "shanghai": (31.2304, 121.4737, "China"), "hong kong": (22.3193, 114.1694, "China"),
    "taiwan": (23.6978, 120.9605, "Taiwan"), "taipei": (25.0330, 121.5654, "Taiwan"),
    "japan": (36.2048, 138.2529, "Japan"), "tokyo": (35.6762, 139.6503, "Japan"),
    "osaka": (34.6937, 135.5023, "Japan"), "south korea": (35.9078, 127.7669, "South Korea"),
    "seoul": (37.5665, 126.9780, "South Korea"), "north korea": (40.3399, 127.5101, "North Korea"),
    "pyongyang": (39.0392, 125.7625, "North Korea"), "philippines": (12.8797, 121.7740, "Philippines"),
    "manila": (14.5995, 120.9842, "Philippines"), "vietnam": (14.0583, 108.2772, "Vietnam"),
    "hanoi": (21.0278, 105.8342, "Vietnam"), "thailand": (15.8700, 100.9925, "Thailand"),
    "bangkok": (13.7563, 100.5018, "Thailand"), "myanmar": (21.9162, 95.9560, "Myanmar"),
    "indonesia": (-0.7893, 113.9213, "Indonesia"), "jakarta": (-6.2088, 106.8456, "Indonesia"),
    "malaysia": (4.2105, 101.9758, "Malaysia"), "singapore": (1.3521, 103.8198, "Singapore"),
    "australia": (-25.2744, 133.7751, "Australia"), "sydney": (-33.8688, 151.2093, "Australia"),
    "melbourne": (-37.8136, 144.9631, "Australia"), "new zealand": (-40.9006, 174.8860, "New Zealand"),
    "egypt": (26.8206, 30.8025, "Egypt"), "cairo": (30.0444, 31.2357, "Egypt"),
    "libya": (26.3351, 17.2283, "Libya"), "sudan": (12.8628, 30.2176, "Sudan"),
    "ethiopia": (9.1450, 40.4897, "Ethiopia"), "kenya": (-0.0236, 37.9062, "Kenya"),
    "nairobi": (-1.2921, 36.8219, "Kenya"), "nigeria": (9.0820, 8.6753, "Nigeria"),
    "lagos": (6.5244, 3.3792, "Nigeria"), "south africa": (-30.5595, 22.9375, "South Africa"),
    "johannesburg": (-26.2041, 28.0473, "South Africa"), "morocco": (31.7917, -7.0926, "Morocco"),
    "algeria": (28.0339, 1.6596, "Algeria"), "tunisia": (33.8869, 9.5375, "Tunisia"),
    "somalia": (5.1521, 46.1996, "Somalia"), "congo": (-4.0383, 21.7587, "DR Congo"),
    "arctic": (82.0, 0.0, "Arctic"), "antarctica": (-82.0, 0.0, "Antarctica"),
    "atlantic": (25.0, -40.0, "Atlantic Ocean"), "pacific": (0.0, -160.0, "Pacific Ocean"),
    "indian ocean": (-20.0, 80.0, "Indian Ocean"), "mediterranean": (35.0, 18.0, "Mediterranean"),
    "red sea": (20.0, 38.0, "Red Sea"), "black sea": (43.0, 34.0, "Black Sea"),
    "suez": (30.5852, 32.2654, "Egypt"), "taiwan strait": (24.0, 119.5, "Taiwan Strait"),
    "south china sea": (12.0, 113.0, "South China Sea"), "himalaya": (28.0, 84.0, "Himalayas"),
}

CONFLICT_TERMS = ("war", "strike", "attack", "missile", "drone", "military", "troops", "ceasefire",
                  "conflict", "sanction", "protest", "coup", "border", "navy", "aircraft carrier")


def geo_tag(text: str) -> dict | None:
    """Attach an approximate map location to a headline using the gazetteer."""
    lowered = (text or "").lower()
    best = None
    for name, (lat, lon, country) in GAZETTEER.items():
        if re.search(rf"(?<![a-z]){re.escape(name.strip())}(?![a-z])", lowered):
            if best is None or len(name) > len(best[0]):
                best = (name, lat, lon, country)
    if not best:
        return None
    return {"name": best[0].strip().title(), "lat": best[1], "lon": best[2], "country": best[3],
            "precision": "approximate"}


# --------------------------------------------------------------------------- #
# Feeds
# --------------------------------------------------------------------------- #
def fetch_weather(lat: float = HOME["lat"], lon: float = HOME["lon"]) -> dict:
    url = ("https://api.open-meteo.com/v1/forecast?" + urlencode({
        "latitude": lat, "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,"
                   "wind_direction_10m,weather_code,visibility",
        "daily": "temperature_2m_max,temperature_2m_min,sunrise,sunset",
        "timezone": "auto",
    }))
    data = _json(url, 8)
    current = data.get("current", {})
    daily = data.get("daily", {})
    return {
        "label": HOME["label"], "lat": lat, "lon": lon,
        "temperature": current.get("temperature_2m"), "feelsLike": current.get("apparent_temperature"),
        "humidity": current.get("relative_humidity_2m"), "wind": current.get("wind_speed_10m"),
        "windDir": current.get("wind_direction_10m"), "code": current.get("weather_code"),
        "visibility": current.get("visibility"),
        "max": (daily.get("temperature_2m_max") or [None])[0],
        "min": (daily.get("temperature_2m_min") or [None])[0],
        "sunrise": (daily.get("sunrise") or [""])[0], "sunset": (daily.get("sunset") or [""])[0],
        "utcOffset": data.get("utc_offset_seconds", 0),
    }


def fetch_earthquakes() -> list[dict]:
    data = _json("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson", 10)
    events = []
    for feature in data.get("features", [])[:150]:
        coords = feature.get("geometry", {}).get("coordinates", [None, None])
        props = feature.get("properties", {})
        if coords[0] is None or coords[1] is None:
            continue
        events.append({
            "id": feature.get("id"), "title": props.get("place") or props.get("title") or "Seismic event",
            "lat": coords[1], "lon": coords[0], "depth": coords[2],
            "mag": props.get("mag"), "time": props.get("time"), "url": props.get("url"),
            "alert": props.get("alert") or "green",
        })
    events.sort(key=lambda item: item.get("mag") or 0, reverse=True)
    return events


def fetch_natural_events() -> list[dict]:
    data = _json("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=140", 12)
    events = []
    for event in data.get("events", []):
        geometries = event.get("geometry") or []
        if not geometries:
            continue
        coords = geometries[-1].get("coordinates") or []
        if not (isinstance(coords, list) and len(coords) >= 2 and isinstance(coords[0], (int, float))):
            continue
        categories = event.get("categories") or []
        events.append({
            "id": event.get("id"), "title": event.get("title", "Natural event"),
            "lat": coords[1], "lon": coords[0],
            "category": categories[0].get("title", "Natural event") if categories else "Natural event",
            "date": geometries[-1].get("date", ""),
            "url": (event.get("sources") or [{}])[0].get("url", ""),
        })
    return events


NEWS_FEEDS = {
    "world": "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en",
    "india": "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en",
    "technology": "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en",
    "business": "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en",
    "conflict": "https://news.google.com/rss/search?q=conflict+OR+war+OR+military+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
}


def _parse_feed(xml_bytes: bytes, topic: str) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    items = []
    for index, item in enumerate(root.findall("./channel/item")[:24]):
        title = (item.findtext("title") or "Live headline").strip()
        source = (item.findtext("source") or "Google News").strip()
        link = (item.findtext("link") or "#").strip()
        published = (item.findtext("pubDate") or "").strip()
        items.append({
            "id": f"{topic}-{index}", "title": title, "source": source, "url": link,
            "published": published, "topic": topic, "geo": geo_tag(title),
        })
    return items


def fetch_headlines() -> list[dict]:
    errors: list[str] = []

    def one(topic_url: tuple[str, str]) -> list[dict]:
        topic, url = topic_url
        try:
            return _parse_feed(_http(url, 9), topic)
        except Exception as exc:  # noqa: BLE001
            print(f"[IRA intel] news/{topic}: {exc}")
            errors.append(str(exc))
            return []

    topics = list(NEWS_FEEDS.items())
    with ThreadPoolExecutor(max_workers=len(topics)) as pool:
        batches = list(pool.map(one, topics))
    if not any(batches) and errors:
        raise RuntimeError(f"News feeds unreachable: {errors[-1]}")
    seen, merged = set(), []
    for batch in batches:
        for item in batch:
            key = item["title"].lower()[:70]
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)
    merged.sort(key=lambda item: 0 if item["topic"] in ("conflict", "world") else 1)
    return merged[:60]


# ADS-B. Public, keyless mirrors. Region sweep keeps the globe covered without
# asking one provider for a full-world dump (none of them offer that for free).
FLIGHT_PROVIDERS = ("https://api.airplanes.live/v2", "https://api.adsb.lol/v2")
FLIGHT_REGIONS = [
    ("europe", 50.0, 8.0), ("us-east", 40.7, -74.0), ("us-west", 34.0, -118.2),
    ("india", 22.0, 78.0), ("middle-east", 25.2, 55.3), ("east-asia", 31.2, 121.5),
    ("se-asia", 1.3, 103.8), ("south-america", -23.5, -46.6), ("africa", -1.3, 36.8),
    ("oceania", -33.8, 151.2), ("north-atlantic", 55.0, -30.0), ("south-asia", 19.0, 73.0),
]
_MILITARY_HINTS = ("RCH", "FORTE", "JAKE", "NATO", "RAF", "IAF", "USAF", "SPAR", "MAGMA", "TITAN")


def _adsb(url_path: str, provider: str, timeout: float = 9.0) -> dict:
    return _json(provider.rstrip("/") + url_path, timeout)


def _normalise_aircraft(raw: dict, kind: str) -> dict | None:
    lat, lon = raw.get("lat"), raw.get("lon")
    if lat is None or lon is None:
        return None
    altitude = raw.get("alt_baro")
    if isinstance(altitude, str):
        altitude = None if altitude in ("ground", "NaN") else None
    return {
        "hex": raw.get("hex"), "flight": (raw.get("flight") or "").strip(),
        "callsign": (raw.get("call") or "").strip(), "lat": lat, "lon": lon,
        "alt": altitude, "altGeom": raw.get("alt_geom"), "speed": raw.get("gs"),
        "track": raw.get("track"), "type": raw.get("t"), "category": raw.get("category"),
        "operator": raw.get("ownOp") or raw.get("ownop") or "", "registration": raw.get("r") or "",
        "military": raw.get("mil") is True or kind == "military",
        "kind": kind, "squawk": raw.get("squawk"), "seen": raw.get("seen"),
        "onGround": raw.get("alt_baro") == "ground",
        "verticalRate": raw.get("baro_rate") or raw.get("geom_rate"),
    }


def fetch_military() -> list[dict]:
    errors = []
    for provider in FLIGHT_PROVIDERS:
        try:
            data = _adsb("/mil", provider)
            found = []
            for raw in data.get("ac") or []:
                aircraft = _normalise_aircraft(raw, "military")
                if aircraft:
                    aircraft["military"] = True
                    found.append(aircraft)
            if found:
                return found[:120]
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            errors.append(f"{provider}: {exc}")
    raise RuntimeError("; ".join(errors) or "Military feed unavailable")


def fetch_flights(regions: int = 8) -> list[dict]:
    """Sweep a rotating set of regions so the map always has fresh live traffic."""
    offset = int(time.time() // 45) % len(FLIGHT_REGIONS)
    chosen = [FLIGHT_REGIONS[(offset + i) % len(FLIGHT_REGIONS)] for i in range(regions)]

    def one(region: tuple[str, float, float]) -> list[dict]:
        name, lat, lon = region
        for provider in FLIGHT_PROVIDERS:
            try:
                data = _adsb(f"/point/{lat}/{lon}/250", provider, 8)
                planes = []
                for raw in (data.get("ac") or [])[:70]:
                    aircraft = _normalise_aircraft(raw, "civil")
                    if aircraft:
                        planes.append(aircraft)
                if planes:
                    return planes
            except (HTTPError, URLError, TimeoutError, OSError, ValueError):
                continue
        return []

    if not chosen:
        return []
    with ThreadPoolExecutor(max_workers=len(chosen)) as pool:
        batches = list(pool.map(one, chosen))
    if not any(batches):
        raise RuntimeError("No ADS-B provider responded (airplanes.live / adsb.lol)")
    seen, merged = set(), []
    for batch in batches:
        for aircraft in batch:
            key = aircraft.get("hex") or f'{aircraft["lat"]},{aircraft["lon"]}'
            if key in seen:
                continue
            seen.add(key)
            merged.append(aircraft)
    merged.sort(key=lambda item: item.get("alt") or 0, reverse=True)
    return merged[:260]


def fetch_iss() -> dict:
    data = _json("https://api.wheretheiss.at/v1/satellites/25544", 8)
    return {"lat": data.get("latitude"), "lon": data.get("longitude"),
            "alt": data.get("altitude"), "velocity": data.get("velocity"),
            "visibility": data.get("visibility"), "name": "ISS (ZARYA)",
            "timestamp": data.get("timestamp")}


def fetch_cameras() -> list[dict]:
    """Curated, publicly embeddable live feeds. No key, no scraping, no stored video."""
    return [
        {"id": "dw", "name": "DW News", "city": "Berlin", "country": "Germany",
         "lat": 52.5200, "lon": 13.4050, "kind": "broadcast",
         "channel": "UCknLrEdhRCp1aegoMqRaCZg", "watch": "https://www.youtube.com/@dwnews/live"},
        {"id": "aljazeera", "name": "Al Jazeera English", "city": "Doha", "country": "Qatar",
         "lat": 25.2854, "lon": 51.5310, "kind": "broadcast",
         "channel": "UCNye-wNBqNL5ZzHSJj3l8Bg", "watch": "https://www.youtube.com/@aljazeeraenglish/live"},
        {"id": "sky", "name": "Sky News", "city": "London", "country": "United Kingdom",
         "lat": 51.5072, "lon": -0.1276, "kind": "broadcast",
         "channel": "UCoMdktPbSTixAyNGwb-UYkQ", "watch": "https://www.youtube.com/@SkyNews/live"},
        {"id": "nasa", "name": "NASA Live", "city": "Low Earth Orbit", "country": "Space",
         "lat": 28.5729, "lon": -80.6490, "kind": "space",
         "channel": "UCLA_DiR1FfKNvjuUpBHmylQ", "watch": "https://www.youtube.com/@NASA/live"},
        {"id": "france24", "name": "France 24 English", "city": "Paris", "country": "France",
         "lat": 48.8566, "lon": 2.3522, "kind": "broadcast",
         "channel": "UCQfwfsi5VrQ8yKZ-UWmAEFg", "watch": "https://www.youtube.com/@FRANCE24English/live"},
        {"id": "bloomberg", "name": "Bloomberg TV", "city": "New York", "country": "United States",
         "lat": 40.7128, "lon": -74.0060, "kind": "markets",
         "channel": "UCIALMKvObZNtJ6AmdCLP7Lg", "watch": "https://www.youtube.com/@markets/live"},
    ]


# --------------------------------------------------------------------------- #
# Simulated layer: city junction signal phases (clearly labelled everywhere)
# --------------------------------------------------------------------------- #
TRAFFIC_CITIES = [
    {"city": "Delhi NCR", "junctions": [
        ("ITO Crossing", 28.6289, 77.2410), ("Connaught Place", 28.6315, 77.2167),
        ("AIIMS Chowk", 28.5672, 77.2100), ("Dhaula Kuan", 28.5921, 77.1610),
        ("Kashmere Gate", 28.6675, 77.2274), ("Ashram Chowk", 28.5726, 77.2588),
        ("Mukarba Chowk", 28.7020, 77.1570), ("Ghaziabad ABES", 28.6692, 77.4538)]},
    {"city": "Mumbai", "junctions": [
        ("Bandra Junction", 19.0607, 72.8362), ("Sion Circle", 19.0430, 72.8610),
        ("Dadar TT", 19.0186, 72.8441), ("Haji Ali", 18.9825, 72.8090),
        ("Andheri East", 19.1136, 72.8697)]},
    {"city": "Bengaluru", "junctions": [
        ("Silk Board", 12.9172, 77.6229), ("Hebbal Flyover", 13.0358, 77.5970),
        ("KR Circle", 12.9634, 77.5855), ("Marathahalli", 12.9560, 77.7010)]},
    {"city": "New York", "junctions": [
        ("Times Square", 40.7580, -73.9855), ("Columbus Circle", 40.7681, -73.9819),
        ("Herald Square", 40.7505, -73.9870)]},
    {"city": "London", "junctions": [
        ("Oxford Circus", 51.5152, -0.1419), ("Piccadilly Circus", 51.5101, -0.1340),
        ("Bank Junction", 51.5133, -0.0886)]},
    {"city": "Tokyo", "junctions": [
        ("Shibuya Crossing", 35.6595, 139.7005), ("Shinjuku", 35.6938, 139.7034),
        ("Ginza", 35.6717, 139.7650)]},
]

TRAFFIC_CYCLE = 84  # seconds: green -> amber -> all-red


def traffic_signals() -> dict:
    """Deterministic signal phases derived from the wall clock (simulation)."""
    now = time.time()
    signals = []
    for city_index, city in enumerate(TRAFFIC_CITIES):
        for junction_index, (name, lat, lon) in enumerate(city["junctions"]):
            offset = (city_index * 17 + junction_index * 11) % TRAFFIC_CYCLE
            phase = (now + offset) % TRAFFIC_CYCLE
            if phase < 44:
                state, remaining = "green", 44 - phase
            elif phase < 52:
                state, remaining = "amber", 52 - phase
            else:
                state, remaining = "red", TRAFFIC_CYCLE - phase
            load = 35 + 55 * abs(math.sin((now / 260) + junction_index + city_index))
            signals.append({
                "id": f"{city_index}-{junction_index}", "name": name, "city": city["city"],
                "lat": lat, "lon": lon, "state": state, "remaining": round(remaining, 1),
                "load": round(load, 1),
            })
    return {
        "simulated": True, "cycle": TRAFFIC_CYCLE, "generatedAt": int(now),
        "note": "Signal phases are a deterministic simulation, not live municipal data.",
        "signals": signals,
    }


# --------------------------------------------------------------------------- #
# Lookups + knowledge
# --------------------------------------------------------------------------- #
def lookup_place(query: str) -> dict | None:
    query = (query or "").strip()
    if not query:
        return None
    lowered = query.lower()
    if lowered in GAZETTEER:
        lat, lon, country = GAZETTEER[lowered]
        return {"name": query.title(), "lat": lat, "lon": lon, "country": country,
                "source": "IRA gazetteer", "precision": "approximate"}
    try:
        data = _json("https://nominatim.openstreetmap.org/search?" + urlencode({
            "q": query, "format": "jsonv2", "limit": 1, "addressdetails": 1}), 9)
        if data:
            hit = data[0]
            return {"name": hit.get("display_name", query), "lat": float(hit["lat"]),
                    "lon": float(hit["lon"]), "type": hit.get("type", ""),
                    "country": (hit.get("address") or {}).get("country", ""),
                    "source": "OpenStreetMap Nominatim", "precision": "exact"}
    except Exception as exc:  # noqa: BLE001
        print("[IRA intel] nominatim:", exc)
    try:
        data = _json("https://en.wikipedia.org/w/api.php?" + urlencode({
            "action": "query", "list": "geosearch", "gssearch": query, "gslimit": 1,
            "format": "json", "origin": "*"}), 8)
        hits = ((data.get("query") or {}).get("geosearch") or [])
        if hits:
            hit = hits[0]
            return {"name": hit.get("title", query), "lat": hit["lat"], "lon": hit["lon"],
                    "source": "Wikipedia geosearch", "precision": "approximate"}
    except Exception as exc:  # noqa: BLE001
        print("[IRA intel] geosearch:", exc)
    tagged = geo_tag(query)
    if tagged:
        return {"name": tagged["name"], "lat": tagged["lat"], "lon": tagged["lon"],
                "country": tagged["country"], "source": "IRA gazetteer", "precision": "approximate"}
    return None


def wikipedia_summary(query: str, lang: str = "en") -> dict | None:
    lang = (lang or "en").split("-")[0][:6] or "en"
    try:
        search = _json(f"https://{lang}.wikipedia.org/w/api.php?" + urlencode({
            "action": "query", "list": "search", "srsearch": query, "format": "json",
            "srlimit": 1, "origin": "*"}), 8)
        hit = ((search.get("query") or {}).get("search") or [])
        if not hit:
            return None
        title = hit[0]["title"]
        page = _json(f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/" + quote(title), 8)
        extract = (page.get("extract") or "").strip()
        if not extract:
            return None
        return {"title": title, "extract": extract,
                "url": ((page.get("content_urls") or {}).get("desktop") or {}).get("page", ""),
                "thumbnail": ((page.get("thumbnail") or {}).get("source"))}
    except Exception as exc:  # noqa: BLE001
        print("[IRA intel] wikipedia:", exc)
        return None


# --------------------------------------------------------------------------- #
# Aggregation
# --------------------------------------------------------------------------- #
def get_intel(full: bool = True) -> dict:
    started = time.time()
    jobs = {
        "weather": lambda: feed_block(fetch_weather, "open-meteo"),
        "earthquakes": lambda: feed_block(fetch_earthquakes, "USGS"),
        "naturalEvents": lambda: feed_block(fetch_natural_events, "NASA EONET"),
        "headlines": lambda: feed_block(fetch_headlines, "Google News RSS"),
        "iss": lambda: feed_block(fetch_iss, "wheretheiss.at"),
    }
    if full:
        jobs["flights"] = lambda: feed_block(fetch_flights, "ADS-B (airplanes.live / adsb.lol)")
        jobs["military"] = lambda: feed_block(fetch_military, "ADS-B military filter")
    with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
        results = dict(zip(jobs, pool.map(lambda fn: fn(), jobs.values())))

    def payload(name: str, empty):
        block = results.get(name, {"ok": False, "error": "not fetched", "ms": 0})
        return {"ok": block["ok"], "data": block.get("data", empty),
                "error": block.get("error", ""), "ms": block["ms"], "source": block.get("source", "")}

    weather = payload("weather", None)
    quakes = payload("earthquakes", [])
    natural = payload("naturalEvents", [])
    news = payload("headlines", [])
    iss = payload("iss", None)
    flights = payload("flights", []) if full else {"ok": False, "data": [], "error": "not requested", "ms": 0}
    military = payload("military", []) if full else {"ok": False, "data": [], "error": "not requested", "ms": 0}

    headlines = news["data"][:40]
    quakes_data = quakes["data"][:60]
    natural_data = natural["data"][:60]
    brief_bits = []
    if headlines:
        brief_bits.append(f"Top signal: {headlines[0]['title']}")
    if quakes_data:
        strongest = quakes_data[0]
        brief_bits.append(f"{len(quakes_data)} seismic events, strongest M{strongest.get('mag')} near {strongest.get('title')}")
    if natural_data:
        brief_bits.append(f"{len(natural_data)} active NASA-tracked natural events")
    if flights["ok"]:
        brief_bits.append(f"{len(flights['data'])} aircraft tracked live")

    return {
        "generatedAt": int(time.time()),
        "home": HOME,
        "brief": ". ".join(brief_bits) or "Live feeds are still connecting.",
        "weather": weather,
        "earthquakes": quakes,
        "naturalEvents": natural,
        "headlines": news,
        "iss": iss,
        "flights": flights,
        "military": military,
        "traffic": {"ok": True, "data": traffic_signals(), "ms": 0, "source": "IRA simulation"},
        "cameras": {"ok": True, "data": fetch_cameras(), "ms": 0, "source": "public broadcasters"},
        "systemNodes": {"ok": True, "source": "IRA simulation", "data": [
            {"name": "New Delhi", "lat": 28.6139, "lon": 77.2090},
            {"name": "Frankfurt", "lat": 50.1109, "lon": 8.6821},
            {"name": "Ashburn", "lat": 39.0438, "lon": -77.4874},
            {"name": "Singapore", "lat": 1.3521, "lon": 103.8198},
            {"name": "Tokyo", "lat": 35.6762, "lon": 139.6503},
            {"name": "Sydney", "lat": -33.8688, "lon": 151.2093},
            {"name": "São Paulo", "lat": -23.5505, "lon": -46.6333},
        ]},
        "elapsedMs": int((time.time() - started) * 1000),
        "disclaimer": ("Aircraft, orbit, seismic, weather, news and cameras are live public feeds. "
                       "Traffic signals and network nodes are clearly labelled simulations."),
    }


# --------------------------------------------------------------------------- #
# Local answer composer — used when the hosted brain is unreachable
# --------------------------------------------------------------------------- #
def _fmt(value, suffix="") -> str:
    return "unknown" if value is None else f"{value}{suffix}"


def _match_headlines(query: str, headlines: list[dict], limit: int = 4) -> list[dict]:
    words = [w for w in re.findall(r"[a-z]{3,}", query.lower())
             if w not in {"the", "and", "for", "with", "about", "what", "news", "today", "latest",
                          "tell", "give", "show", "have", "from", "this", "that", "are", "you"}]
    if not words:
        return headlines[:limit]
    scored = []
    for item in headlines:
        text = item.get("title", "").lower()
        score = sum(2 if word in text else 0 for word in words)
        if score:
            scored.append((score, item))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in scored[:limit]]


def compose_answer(question: str, intel: dict | None = None, lang: str = "en") -> dict:
    """Deterministic, data-grounded answer. Returns {'text','source','markers'}."""
    question = (question or "").strip()
    lowered = question.lower()
    intel = intel or get_intel(full=True)
    markers: list[dict] = []
    weather = intel["weather"]["data"] if intel["weather"]["ok"] else None
    headlines = intel["headlines"]["data"] if intel["headlines"]["ok"] else []
    quakes = intel["earthquakes"]["data"] if intel["earthquakes"]["ok"] else []
    natural = intel["naturalEvents"]["data"] if intel["naturalEvents"]["ok"] else []
    flights = intel["flights"]["data"] if intel["flights"]["ok"] else []
    military = intel["military"]["data"] if intel["military"]["ok"] else []
    iss = intel["iss"]["data"] if intel["iss"]["ok"] else None

    def headline_lines(items: list[dict], count: int = 4) -> str:
        lines = []
        for item in items[:count]:
            source = item.get("source") or "live feed"
            lines.append(f"• {item['title']} — {source}")
            geo = item.get("geo")
            if geo:
                markers.append({"type": "news", "title": item["title"], "lat": geo["lat"],
                                "lon": geo["lon"], "meta": source, "url": item.get("url")})
        return "\n".join(lines)

    if re.search(r"\b(hi|hello|hey|namaste|namaskar|good (morning|evening|afternoon))\b", lowered):
        return {"text": "Hello. My live feeds are connected: news, aircraft, orbits, seismic and weather. "
                        "Ask me about any of them, or say “what's happening in the world”.", "source": None}

    if any(word in lowered for word in ("who are you", "your name", "what are you", "about you")):
        return {"text": "I am IRA — your Immersive Responsive Assistant, built by Keshav Dixit Sir. "
                        "I run a live intelligence grid: aircraft, military traffic, orbit, seismic events, "
                        "weather, news, cameras and maps. Ask me anything and I will pull it onto the map.",
                "source": None}

    if any(word in lowered for word in ("where is", "locate", "find on map", "coordinates of")):
        target = re.sub(r"^.*?(where is|locate|find on map|coordinates of)\s*", "", lowered).strip(" ?.")
        place = lookup_place(target)
        if place:
            markers.append({"type": "place", "title": place["name"], "lat": place["lat"],
                            "lon": place["lon"], "meta": place.get("source", "map lookup")})
            return {"text": f"{place['name']} is at {place['lat']:.4f}, {place['lon']:.4f}. "
                            f"I have pinned it on the map. Source: {place.get('source')}.",
                    "source": None, "markers": markers}
        return {"text": f"I could not resolve “{target}” to a map position right now.", "source": None}

    if any(word in lowered for word in ("military", "army", "navy", "air force", "fighter jet", "war plane")):
        if not intel["military"]["ok"]:
            return {"text": "The military tracking feed is not responding right now. "
                            "Civil air traffic and the rest of the grid are still live.", "source": None}
        if not military:
            return {"text": "No military aircraft are visible on the public ADS-B feeds this minute.", "source": None}
        sample = ", ".join((a.get("flight") or a.get("callsign") or a.get("hex") or "unknown") for a in military[:5])
        for aircraft in military[:12]:
            markers.append({"type": "military", "title": aircraft.get("flight") or aircraft.get("hex"),
                            "lat": aircraft["lat"], "lon": aircraft["lon"],
                            "meta": f'{aircraft.get("type") or "military"} · {_fmt(aircraft.get("alt"))} ft'})
        return {"text": f"I am tracking {len(military)} military aircraft on public ADS-B. "
                        f"Nearest callsigns: {sample}. They are marked on the map in amber — tap one for details.",
                "source": None, "markers": markers}

    if any(word in lowered for word in ("flight", "aircraft", "plane", "ads-b", "adsb", "air traffic")):
        if not intel["flights"]["ok"]:
            return {"text": "The live aircraft feed is unreachable at the moment. I will keep retrying.", "source": None}
        busiest = sorted(flights, key=lambda a: a.get("speed") or 0, reverse=True)[:5]
        sample = ", ".join((a.get("flight") or a.get("hex") or "unknown") for a in busiest)
        for aircraft in busiest:
            markers.append({"type": "flight", "title": aircraft.get("flight") or aircraft.get("hex"),
                            "lat": aircraft["lat"], "lon": aircraft["lon"],
                            "meta": f'{_fmt(aircraft.get("speed"))} kt · {_fmt(aircraft.get("alt"))} ft'})
        return {"text": f"{len(flights)} aircraft are live on my scope right now. Fastest: {sample}. "
                        "Tap any aircraft on the map for altitude, speed and heading.",
                "source": None, "markers": markers}

    if any(word in lowered for word in ("earthquake", "seismic", "quake", "tremor")):
        if not intel["earthquakes"]["ok"]:
            return {"text": "The USGS seismic feed is not responding right now.", "source": None}
        if not quakes:
            return {"text": "No magnitude 2.5+ earthquakes in the last 24 hours on the USGS feed.", "source": None}
        top = quakes[0]
        for quake in quakes[:10]:
            markers.append({"type": "earthquake", "title": quake["title"], "lat": quake["lat"],
                            "lon": quake["lon"], "meta": f'M{quake.get("mag")}'})
        return {"text": f"{len(quakes)} earthquakes above magnitude 2.5 in the past 24 hours. "
                        f"Strongest is M{top.get('mag')} near {top.get('title')}. "
                        f"Locations are plotted on the map.", "source": top.get("url")}

    if any(word in lowered for word in ("natural event", "wildfire", "volcano", "storm", "cyclone", "flood")):
        if not intel["naturalEvents"]["ok"] or not natural:
            return {"text": "NASA's natural-event feed has nothing new, or is offline right now.", "source": None}
        for event in natural[:12]:
            markers.append({"type": "natural", "title": event["title"], "lat": event["lat"],
                            "lon": event["lon"], "meta": event.get("category")})
        return {"text": f"NASA reports {len(natural)} open natural events, led by {natural[0]['category']}: "
                        f"{natural[0]['title']}. All are pinned on the map.", "source": natural[0].get("url")}

    if any(word in lowered for word in ("iss", "orbit", "satellite", "space station")):
        if not intel["iss"]["ok"] or not iss:
            return {"text": "The orbital relay is offline right now.", "source": None}
        markers.append({"type": "orbit", "title": "ISS (ZARYA)", "lat": iss["lat"], "lon": iss["lon"],
                        "meta": f'{round(iss.get("alt") or 0)} km'})
        return {"text": f"The ISS is over {round(iss['lat'], 2)}°, {round(iss['lon'], 2)}° at "
                        f"{round(iss.get('alt') or 0)} km, moving {round(iss.get('velocity') or 0)} km/h. "
                        "It is marked on the map.", "source": None}

    if any(word in lowered for word in ("traffic", "signal", "junction", "jam", "congestion")):
        signals = intel["traffic"]["data"]["signals"]
        red = sum(1 for s in signals if s["state"] == "red")
        green = sum(1 for s in signals if s["state"] == "green")
        busiest = max(signals, key=lambda s: s["load"])
        for signal in signals[:16]:
            markers.append({"type": "traffic", "title": f'{signal["name"]} · {signal["state"].upper()}',
                            "lat": signal["lat"], "lon": signal["lon"],
                            "meta": f'{int(signal["remaining"])}s · load {int(signal["load"])}%'})
        return {"text": f"Across {len(signals)} junctions: {green} green, {red} red. "
                        f"Highest load right now is {busiest['name']} at {int(busiest['load'])}%. "
                        "Signal phases are a live simulation, not municipal data.",
                "source": None, "markers": markers}

    if any(word in lowered for word in ("weather", "temperature", "rain", "humidity", "wind")):
        if not weather:
            return {"text": "The weather feed is offline right now.", "source": None}
        return {"text": f"{weather['label']} is {_fmt(weather['temperature'], '°C')} "
                        f"(feels like {_fmt(weather['feelsLike'], '°C')}), wind {_fmt(weather['wind'], ' km/h')}, "
                        f"humidity {_fmt(weather['humidity'], '%')}. Today ranges {_fmt(weather['min'], '°')} to "
                        f"{_fmt(weather['max'], '°')}.", "source": None}

    if any(word in lowered for word in ("camera", "cameras", "live feed", "broadcast", "watch")):
        cameras = intel["cameras"]["data"]
        names = ", ".join(f'{c["name"]} ({c["city"]})' for c in cameras[:5])
        return {"text": f"I can open {len(cameras)} public live feeds: {names}. "
                        "Open the CAMERAS module to watch them side by side, or give me a camera name.",
                "source": None}

    if any(word in lowered for word in ("news", "headline", "happening", "briefing", "world", "latest")) \
            or "what's going on" in lowered:
        if not intel["headlines"]["ok"]:
            return {"text": "The news feed is offline right now. Live aircraft, orbit and weather layers still work.",
                    "source": None}
        matched = _match_headlines(question, headlines)
        body = headline_lines(matched, 5)
        return {"text": f"Here is what my news grid is showing right now:\n{body}\n"
                        "Tap any pin on the map to open the story and ask me for more.",
                "source": matched[0].get("url") if matched else None, "markers": markers}

    # Topic search across headlines, then a place pin, then Wikipedia.
    matched = _match_headlines(question, headlines)
    if matched and len(question.split()) > 1:
        body = headline_lines(matched, 4)
        return {"text": f"Live headlines that match “{question}”:\n{body}", "source": matched[0].get("url"),
                "markers": markers}

    place = lookup_place(re.sub(r"^(where\s+is|tell\s+me\s+about|about|what\s+is)\s+", "", lowered).strip(" ?."))
    if place and len(question.split()) <= 4:
        markers.append({"type": "place", "title": place["name"], "lat": place["lat"],
                        "lon": place["lon"], "meta": place.get("source", "map lookup")})
        return {"text": f"{place['name']} is plotted at {place['lat']:.4f}, {place['lon']:.4f}. "
                        f"Source: {place.get('source')}. Ask me for detail and I will pull its profile.",
                "source": None, "markers": markers}

    wiki = wikipedia_summary(question, lang)
    if wiki:
        text = wiki["extract"]
        if len(text) > 700:
            text = text[:697] + "…"
        return {"text": text, "source": wiki.get("url"), "markers": markers}

    return {
        "text": ("I could not ground that in the live grid yet. The hosted cloud brain is unreachable from this "
                 "machine, and Wikipedia has no matching article. Try a news, flight, military, camera, traffic, "
                 "weather, orbit or place question — those run on feeds inside this app."),
        "source": None,
    }
