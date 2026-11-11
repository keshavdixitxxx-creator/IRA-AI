"""IRA OSINT movement layer — ships, trains, vehicles (keyless).

Real keyless feeds exist for aircraft (ADS-B), ISS orbit, earthquakes,
natural events, news and weather — those come from ``ira_intel`` and are
live. There is **no** free keyless global live feed for ship AIS, train
GTFS-RT, or vehicle telematics, so this module provides honest,
deterministic *simulated* tracks along real-world corridors:

- Ships along major shipping lanes (Suez, Malacca, trans-Pacific, etc.)
- Trains along Indian + world rail corridors with timetable interpolation
- Vehicles on major highway corridors + city traffic flow

Every simulated item is labelled ``simulated: true`` in the API and in the
UI. Positions are deterministic functions of the wall clock, so tracks
move smoothly and identically for every viewer. Nothing here pretends to
be live AIS/GTFS data.
"""

from __future__ import annotations

import math
import time

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _interp_route(waypoints: list[tuple[float, float]], t: float) -> tuple[float, float, float]:
    """Interpolate along a polyline. Returns (lat, lon, heading_deg)."""
    if not waypoints:
        return 0.0, 0.0, 0.0
    if len(waypoints) == 1:
        return waypoints[0][0], waypoints[0][1], 0.0
    total = 0.0
    segs: list[float] = []
    for i in range(len(waypoints) - 1):
        lat1, lon1 = waypoints[i]
        lat2, lon2 = waypoints[i + 1]
        d = math.hypot(lat2 - lat1, lon2 - lon1)
        segs.append(d)
        total += d
    if total == 0:
        return waypoints[0][0], waypoints[0][1], 0.0
    dist = (t % 1.0) * total
    acc = 0.0
    for i, d in enumerate(segs):
        if acc + d >= dist:
            frac = 0.0 if d == 0 else (dist - acc) / d
            lat1, lon1 = waypoints[i]
            lat2, lon2 = waypoints[i + 1]
            lat = _lerp(lat1, lat2, frac)
            lon = _lerp(lon1, lon2, frac)
            heading = math.degrees(math.atan2(lon2 - lon1, lat2 - lat1)) % 360
            return lat, lon, heading
        acc += d
    lat, lon = waypoints[-1]
    return lat, lon, 0.0


# --------------------------------------------------------------------------- #
# Ships — major shipping lanes (simulated AIS)
# --------------------------------------------------------------------------- #
SHIP_LANES: list[dict] = [
    {"name": "Suez–Mumbai", "type": "container", "waypoints": [
        (31.26, 32.30), (30.42, 32.34), (27.72, 34.16), (21.48, 38.97),
        (15.60, 42.72), (12.58, 43.33), (11.20, 43.13), (12.00, 45.00),
        (13.50, 48.50), (15.00, 52.00), (16.50, 55.00), (19.00, 58.00),
        (20.50, 60.50), (22.00, 63.00), (23.50, 65.50), (24.50, 67.50),
        (24.80, 67.00), (23.00, 66.00), (21.00, 68.00), (19.50, 70.50),
        (19.00, 72.80), (18.90, 72.80)]},
    {"name": "Malacca–Singapore", "type": "container", "waypoints": [
        (13.50, 80.27), (10.00, 80.50), (7.00, 80.80), (5.50, 81.50),
        (4.50, 84.00), (4.00, 88.00), (3.50, 92.00), (3.00, 95.50),
        (2.50, 98.50), (2.00, 101.00), (1.50, 103.50), (1.30, 103.80)]},
    {"name": "Trans-Pacific East", "type": "bulk", "waypoints": [
        (35.68, 139.65), (36.50, 145.00), (38.00, 155.00), (39.50, 165.00),
        (40.00, 175.00), (39.00, -175.00), (38.00, -165.00), (37.50, -155.00),
        (37.00, -145.00), (36.50, -135.00), (35.00, -125.00), (34.05, -118.24)]},
    {"name": "Trans-Atlantic", "type": "container", "waypoints": [
        (51.50, -0.12), (50.00, -5.00), (49.00, -12.00), (47.00, -20.00),
        (45.00, -28.00), (43.00, -36.00), (41.00, -45.00), (40.71, -74.00)]},
    {"name": "Cape of Good Hope", "type": "tanker", "waypoints": [
        (19.07, 72.87), (15.00, 65.00), (10.00, 55.00), (5.00, 45.00),
        (0.00, 38.00), (-5.00, 35.00), (-10.00, 30.00), (-15.00, 25.00),
        (-20.00, 22.00), (-25.00, 20.00), (-30.00, 18.00), (-34.35, 18.47)]},
    {"name": "Indian Coastal", "type": "fishing", "waypoints": [
        (28.61, 77.20), (26.00, 76.00), (23.00, 72.50), (20.00, 72.80),
        (17.00, 73.00), (14.00, 74.00), (11.00, 75.50), (8.50, 76.50),
        (8.00, 77.50), (9.00, 79.00), (11.00, 80.00), (13.08, 80.27)]},
]

SHIP_NAMES = ["MV Indian Star", "MV Ocean Bridge", "MV Silk Road", "MV Monsoon",
              "MV Coral", "MV Deccan", "MV Himalaya", "MV Ganga", "MV Kaveri",
              "MV Andaman", "MV Nicobar", "MV Malabar", "MV Vindhya", "MV Sahyadri",
              "MV Narmada", "MV Tapti", "MV Mahanadi", "MV Godavari", "MV Krishna",
              "MV Cauvery"]


def fetch_ships() -> list[dict]:
    now = time.time()
    ships: list[dict] = []
    for lane_idx, lane in enumerate(SHIP_LANES):
        # 3-4 vessels per lane, staggered phases.
        for k in range(4):
            phase = ((now / 900.0) + lane_idx * 0.23 + k * 0.27) % 1.0
            # Alternate direction for variety.
            t = phase if k % 2 == 0 else 1.0 - phase
            lat, lon, heading = _interp_route(lane["waypoints"], t)
            speed = 12 + (k * 3) + (lane_idx % 3)  # knots, plausible
            name = SHIP_NAMES[(lane_idx * 4 + k) % len(SHIP_NAMES)]
            ships.append({
                "id": f"ship-{lane_idx}-{k}",
                "name": name,
                "lane": lane["name"],
                "type": lane["type"],
                "lat": round(lat, 4), "lon": round(lon, 4),
                "heading": round(heading, 1),
                "speed": speed,  # knots
                "simulated": True,
                "source": "IRA simulated AIS (no keyless live feed)",
            })
    return ships


# --------------------------------------------------------------------------- #
# Trains — rail corridors (simulated GTFS-style)
# --------------------------------------------------------------------------- #
TRAIN_ROUTES: list[dict] = [
    {"name": "Delhi–Mumbai Rajdhani", "waypoints": [
        (28.61, 77.20), (27.50, 77.00), (26.20, 75.80), (24.50, 73.50),
        (23.02, 72.57), (21.00, 72.80), (19.07, 72.87)], "speedKmh": 95},
    {"name": "Delhi–Kolkata", "waypoints": [
        (28.61, 77.20), (27.15, 78.00), (26.84, 80.94), (25.59, 85.13),
        (22.57, 88.36)], "speedKmh": 88},
    {"name": "Delhi–Chennai", "waypoints": [
        (28.61, 77.20), (27.00, 78.50), (25.30, 79.00), (23.00, 79.50),
        (20.00, 79.00), (17.38, 78.48), (15.00, 79.50), (13.08, 80.27)], "speedKmh": 92},
    {"name": "Mumbai–Bengaluru", "waypoints": [
        (19.07, 72.87), (18.52, 73.85), (17.00, 74.50), (15.50, 75.50),
        (13.50, 76.50), (12.97, 77.59)], "speedKmh": 85},
    {"name": "Delhi–Lucknow Shatabdi", "waypoints": [
        (28.61, 77.20), (28.00, 78.00), (27.00, 79.50), (26.84, 80.94)], "speedKmh": 110},
    {"name": "Tokyo–Osaka Shinkansen", "waypoints": [
        (35.67, 139.65), (35.20, 138.50), (34.90, 137.00), (34.69, 135.50)], "speedKmh": 240},
    {"name": "Paris–Lyon TGV", "waypoints": [
        (48.85, 2.35), (47.50, 3.50), (46.50, 4.50), (45.76, 4.83)], "speedKmh": 260},
    {"name": "New York–Washington Acela", "waypoints": [
        (40.71, -74.00), (39.50, -75.50), (39.29, -76.61), (38.90, -77.03)], "speedKmh": 200},
]

TRAIN_NAMES = ["12951 Rajdhani", "12301 Howrah Rajdhani", "12621 Tamil Nadu Exp",
               "16595 Hampi Exp", "12004 Shatabdi", "Nozomi 214", "TGV 6612",
               "Acela 2150"]


def fetch_trains() -> list[dict]:
    now = time.time()
    trains: list[dict] = []
    for idx, route in enumerate(TRAIN_ROUTES):
        # Trains move continuously; period ~ route length / speed (scaled).
        period = 600 + idx * 60  # seconds for a full traverse (visual)
        phase = ((now / period) + idx * 0.31) % 1.0
        t = phase if idx % 2 == 0 else 1.0 - phase
        lat, lon, heading = _interp_route(route["waypoints"], t)
        trains.append({
            "id": f"train-{idx}",
            "name": TRAIN_NAMES[idx % len(TRAIN_NAMES)],
            "route": route["name"],
            "lat": round(lat, 4), "lon": round(lon, 4),
            "heading": round(heading, 1),
            "speed": route["speedKmh"],
            "simulated": True,
            "source": "IRA simulated rail tracks (no keyless GTFS-RT)",
        })
    return trains


# --------------------------------------------------------------------------- #
# Vehicles — highway corridors (simulated flow)
# --------------------------------------------------------------------------- #
VEHICLE_CORRIDORS: list[dict] = [
    {"name": "NH-48 Delhi–Jaipur", "waypoints": [
        (28.61, 77.20), (28.40, 77.00), (27.90, 76.50), (27.00, 75.80),
        (26.91, 75.78)], "flow": 4200},
    {"name": "NH-19 Delhi–Agra", "waypoints": [
        (28.61, 77.20), (28.20, 77.50), (27.50, 78.00), (27.17, 78.01)], "flow": 3800},
    {"name": "Mumbai–Pune Expressway", "waypoints": [
        (19.07, 72.87), (18.90, 73.30), (18.52, 73.85)], "flow": 5100},
    {"name": "Delhi Ring Road", "waypoints": [
        (28.61, 77.20), (28.65, 77.25), (28.60, 77.30), (28.55, 77.25),
        (28.55, 77.15), (28.60, 77.10), (28.65, 77.15)], "flow": 6800},
    {"name": "I-95 New York–Boston", "waypoints": [
        (40.71, -74.00), (41.00, -73.50), (41.50, -72.50), (42.36, -71.05)], "flow": 5900},
    {"name": "M1 London–Birmingham", "waypoints": [
        (51.50, -0.12), (51.80, -0.50), (52.20, -1.00), (52.48, -1.89)], "flow": 4700},
]

VEHICLE_TYPES = ["car", "truck", "bus", "car", "truck"]


def fetch_vehicles() -> list[dict]:
    now = time.time()
    vehicles: list[dict] = []
    for idx, corr in enumerate(VEHICLE_CORRIDORS):
        for k in range(5):
            phase = ((now / 240.0) + idx * 0.19 + k * 0.21) % 1.0
            t = phase if k % 2 == 0 else 1.0 - phase
            lat, lon, heading = _interp_route(corr["waypoints"], t)
            # Congestion varies sinusoidally (deterministic).
            congestion = 0.5 + 0.5 * math.sin(now / 300.0 + idx + k)
            speed = round(28 + 55 * (1 - congestion * 0.7), 1)  # km/h
            vehicles.append({
                "id": f"veh-{idx}-{k}",
                "type": VEHICLE_TYPES[k % len(VEHICLE_TYPES)],
                "corridor": corr["name"],
                "lat": round(lat, 4), "lon": round(lon, 4),
                "heading": round(heading, 1),
                "speed": speed,
                "congestion": round(congestion, 2),
                "flow": corr["flow"],
                "simulated": True,
                "source": "IRA simulated traffic flow (not live telematics)",
            })
    return vehicles


# --------------------------------------------------------------------------- #
# Snapshot
# --------------------------------------------------------------------------- #
def get_osint_snapshot() -> dict:
    """Movement snapshot for the ARGUS globe. Real + simulated, labelled."""
    import ira_intel

    flights = ira_intel.feed_block(ira_intel.fetch_flights, "ADS-B civil")
    military = ira_intel.feed_block(ira_intel.fetch_military, "ADS-B military")
    iss = ira_intel.feed_block(ira_intel.fetch_iss, "wheretheiss.at")
    quakes = ira_intel.feed_block(ira_intel.fetch_earthquakes, "USGS")
    natural = ira_intel.feed_block(ira_intel.fetch_natural_events, "NASA EONET")
    traffic = ira_intel.traffic_signals()

    return {
        "generatedAt": int(time.time()),
        "flights": flights,
        "military": military,
        "iss": iss,
        "earthquakes": quakes,
        "naturalEvents": natural,
        "traffic": {"ok": True, "data": traffic, "source": "IRA simulation"},
        "ships": {"ok": True, "data": fetch_ships(), "source": "IRA simulated AIS"},
        "trains": {"ok": True, "data": fetch_trains(), "source": "IRA simulated rail"},
        "vehicles": {"ok": True, "data": fetch_vehicles(), "source": "IRA simulated flow"},
        "disclaimer": (
            "Flights, military, ISS, earthquakes and natural events are live public feeds. "
            "Ships, trains and vehicles are deterministic simulations along real corridors "
            "(no keyless live AIS/GTFS/telematics feed exists)."
        ),
    }
