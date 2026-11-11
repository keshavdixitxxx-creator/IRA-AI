"""UI 6 (Jarvis) + Hermes persistence tests. Run: python -m unittest discover -s tests"""
from __future__ import annotations

import json
import tempfile
import threading
import time
import unittest
import urllib.request
from pathlib import Path
from unittest import mock

import ira_hermes
import ira_osint
import ira_server


class HermesMemoryTests(unittest.TestCase):
    """Hermes learns, upgrades, and resumes across restarts — in a temp memory file."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.memory_file = Path(self._tmp.name) / "hermes-memory.json"
        self._patches = [
            mock.patch.object(ira_hermes, "MEMORY_PATH", self.memory_file),
            mock.patch.object(ira_hermes, "_memory", None),
            mock.patch.object(ira_hermes, "_started_at", time.time()),
        ]
        for patch in self._patches:
            patch.start()

    def tearDown(self):
        for patch in reversed(self._patches):
            patch.stop()
        self._tmp.cleanup()

    def test_boot_bumps_session_and_starts_at_level_one(self):
        status = ira_hermes.boot_session()
        self.assertEqual(1, status["sessionCount"])
        self.assertEqual(1, status["level"])
        self.assertEqual("Hermes", status["name"])
        self.assertTrue(status["resumeMessage"])

    def test_interaction_teaches_topic_xp_and_resume_point(self):
        ira_hermes.boot_session()
        ira_hermes.record_interaction(
            "Show me ships in the Malacca strait", "Ships are simulated here.", engine="test",
        )
        status = ira_hermes.get_status()
        self.assertEqual(1, status["totalInteractions"])
        self.assertGreaterEqual(status["xp"], 10)
        self.assertIn("Malacca", status["lastLeftOff"])
        self.assertEqual(1, status["topics"]["ships"])
        self.assertEqual("ships", status["topTopics"][0]["topic"])

    def test_tick_grows_xp_every_second(self):
        ira_hermes.boot_session()
        before = ira_hermes.get_status()["xp"]
        ira_hermes.tick(5)
        after = ira_hermes.get_status()["xp"]
        self.assertEqual(before + 5, after)

    def test_restart_resumes_exactly_where_it_left_off(self):
        ira_hermes.boot_session("session-a")
        ira_hermes.record_interaction(
            "Track flights over India right now", "Let me check the ADS-B feed.", engine="test",
        )
        # Simulate a full restart: drop in-memory state, keep the file.
        ira_hermes._memory = None
        status = ira_hermes.boot_session("session-b")
        self.assertEqual(2, status["sessionCount"])
        self.assertEqual(1, status["totalInteractions"])
        self.assertIn("flights over India", status["resumeMessage"])
        self.assertIn("flights over India", status["lastLeftOff"])

    def test_level_curve_is_transparent(self):
        self.assertEqual(1, ira_hermes._level_for_xp(0))
        self.assertEqual(2, ira_hermes._level_for_xp(100))
        self.assertEqual(3, ira_hermes._level_for_xp(400))
        self.assertEqual(4, ira_hermes._level_for_xp(900))

    def test_persisted_file_survives_and_is_valid_json(self):
        ira_hermes.boot_session()
        ira_hermes.record_interaction("What about quakes?", "USGS reports live earthquakes.", engine="test")
        data = json.loads(self.memory_file.read_text(encoding="utf-8"))
        self.assertEqual(1, data["totalInteractions"])
        self.assertEqual(1, data["sessionCount"])
        self.assertTrue(data["lastLeftOff"].startswith("Q:"))


class OsintSimulationTests(unittest.TestCase):
    def test_simulated_layers_are_labelled_and_in_range(self):
        for fetcher, minimum in ((ira_osint.fetch_ships, 12), (ira_osint.fetch_trains, 6), (ira_osint.fetch_vehicles, 20)):
            with self.subTest(fetcher=fetcher.__name__):
                items = fetcher()
                self.assertGreaterEqual(len(items), minimum)
                for item in items:
                    self.assertTrue(item["simulated"])
                    self.assertTrue(item["source"])
                    self.assertTrue(-90 <= item["lat"] <= 90)
                    self.assertTrue(-180 <= item["lon"] <= 180)
                    self.assertTrue(0 <= item["heading"] < 360)

    def test_simulated_layers_are_deterministic_for_a_fixed_clock(self):
        fixed = mock.Mock(time=lambda: 1794381200)
        with mock.patch.object(ira_osint, "time", fixed):
            self.assertEqual(ira_osint.fetch_ships(), ira_osint.fetch_ships())
            self.assertEqual(ira_osint.fetch_trains(), ira_osint.fetch_trains())
            self.assertEqual(ira_osint.fetch_vehicles(), ira_osint.fetch_vehicles())

    def test_snapshot_has_every_layer_and_an_honest_disclaimer(self):
        snapshot = ira_osint.get_osint_snapshot()
        for key in ("flights", "military", "iss", "earthquakes", "naturalEvents", "traffic", "ships", "trains", "vehicles", "disclaimer"):
            self.assertIn(key, snapshot)
        self.assertTrue(snapshot["traffic"]["ok"])
        self.assertTrue(snapshot["ships"]["ok"])
        self.assertTrue(snapshot["trains"]["ok"])
        self.assertTrue(snapshot["vehicles"]["ok"])
        # Live feeds may fail in sandboxes; when they do they must fail honestly.
        for key in ("flights", "military", "iss", "earthquakes", "naturalEvents"):
            node = snapshot[key]
            self.assertIn("ok", node)
            if not node["ok"]:
                self.assertTrue(node.get("error"))
        self.assertIn("simulation", snapshot["disclaimer"].lower())


class HermesRouteTests(unittest.TestCase):
    """The UI talks to these routes; keep the contract stable."""

    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        cls._patch = mock.patch.object(ira_hermes, "MEMORY_PATH", Path(cls._tmp.name) / "route-memory.json")
        cls._patch.start()
        ira_hermes._memory = None
        cls.server = ira_server.ThreadingHTTPServer(("127.0.0.1", 0), ira_server.Handler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)
        cls._patch.stop()
        ira_hermes._memory = None
        cls._tmp.cleanup()

    def get(self, path):
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}{path}", timeout=5) as response:
            return response.status, json.loads(response.read())

    def post(self, path, body):
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, json.loads(response.read())

    def test_status_route_shape(self):
        status, data = self.get("/api/hermes/status")
        self.assertEqual(200, status)
        for key in ("name", "level", "xp", "progress", "sessionCount", "totalInteractions", "resumeMessage", "honestNote"):
            self.assertIn(key, data)

    def test_learn_route_records_and_resumes(self):
        status, data = self.post("/api/hermes/learn", {
            "question": "Any trains moving in India?",
            "answer": "Rajdhani and Shinkansen tracks are simulated.",
            "engine": "test",
        })
        self.assertEqual(200, status)
        self.assertGreaterEqual(data["totalInteractions"], 1)
        self.assertIn("trains moving in India", data["lastLeftOff"])

    def test_osint_route_contract(self):
        status, data = self.get("/api/osint")
        self.assertEqual(200, status)
        for key in ("flights", "ships", "trains", "vehicles", "disclaimer"):
            self.assertIn(key, data)

    def test_simulated_only_routes(self):
        for path, key, minimum in (("/api/osint/ships", "ships", 12), ("/api/osint/trains", "trains", 6), ("/api/osint/vehicles", "vehicles", 20)):
            with self.subTest(path=path):
                status, data = self.get(path)
                self.assertEqual(200, status)
                self.assertGreaterEqual(len(data[key]), minimum)
                self.assertTrue(all(item["simulated"] for item in data[key]))


if __name__ == "__main__":
    unittest.main()
