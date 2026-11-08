"""Dependency-free IRA Office/Ollama routing tests. Run: python -m unittest discover -s tests"""
from __future__ import annotations

import base64
import io
import json
import threading
import unittest
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from unittest import mock

import ira_office
import ira_office_files
import ira_server
import ollama_brain


class OfficeFileTests(unittest.TestCase):
    def test_all_office_packages_are_valid_zip_and_xml(self):
        samples = {
            "word": "# Brief\n\nA valid document.\n\n- One\n- Two",
            "excel": "Name,Quantity,Price\nAlpha,2,12.50\nBeta,3,8.00",
            "powerpoint": "Slide: Overview\n- Connected staff\nSlide: Delivery\n- Real files",
        }
        expected = {"word": "docx", "excel": "xlsx", "powerpoint": "pptx"}
        for kind, content in samples.items():
            with self.subTest(kind=kind):
                filename, mime, payload = ira_office_files.create_office_file(kind, "IRA Test", content)
                self.assertTrue(filename.endswith("." + expected[kind]))
                self.assertIn("officedocument", mime)
                with zipfile.ZipFile(io.BytesIO(payload)) as package:
                    self.assertIsNone(package.testzip())
                    self.assertIn("[Content_Types].xml", package.namelist())
                    for member in package.namelist():
                        if member.endswith((".xml", ".rels")):
                            ET.fromstring(package.read(member))

    def test_excel_formulas_and_types(self):
        _, _, payload = ira_office_files.create_office_file(
            "excel", "Budget", "Item,Amount\nFirst,10\nSecond,20\nTotal,=SUM(B2:B3)"
        )
        with zipfile.ZipFile(io.BytesIO(payload)) as package:
            sheet = package.read("xl/worksheets/sheet1.xml").decode()
            self.assertIn("<f>SUM(B2:B3)</f>", sheet)
            self.assertIn('t="inlineStr"', sheet)
            self.assertIn("<dimension ref=", sheet)


class PlannerTests(unittest.TestCase):
    def test_ten_unique_staff_and_deliverable_priority(self):
        self.assertEqual(10, len(ira_office.AGENTS))
        self.assertEqual(10, len(set(ira_office.AGENTS)))
        plan = ira_office.plan_office(
            "Research electric cars, write Python code, create a Word report, "
            "an Excel comparison, and a PowerPoint deck"
        )
        self.assertLessEqual(len(plan), 5)
        self.assertEqual(
            {"research", "code", "word", "excel", "powerpoint"},
            {task["app"] for task in plan},
        )

    def test_default_plan_uses_shared_research_roles(self):
        plan = ira_office.plan_office("Tell me about responsible AI")
        self.assertEqual(["atlas", "archie"], [task["agent"] for task in plan])
        self.assertNotIn("prompt", plan[0])

    def test_new_apps_route_to_their_sector_owner(self):
        expectations = [
            ("Create a OneNote notebook", "archie", "onenote"),
            ("Brainstorm on the whiteboard", "sage", "whiteboard"),
            ("Prepare a classroom lesson", "echo", "classroom"),
            ("Review this code", "pixel", "code"),
        ]
        for goal, agent, app in expectations:
            with self.subTest(goal=goal):
                tasks = ira_office.plan_office(goal)
                self.assertTrue(any(task["agent"] == agent and task["app"] == app for task in tasks))
        self.assertEqual("whiteboard", ira_office.AGENTS["sage"]["app"])
        self.assertEqual("onenote", ira_office.AGENTS["archie"]["app"])
        self.assertEqual("classroom", ira_office.AGENTS["echo"]["app"])


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ira_server.ThreadingHTTPServer(("127.0.0.1", 0), ira_server.Handler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def request(self, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}", data=data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, json.loads(response.read())

    def test_ollama_is_preferred_without_api_key(self):
        with mock.patch.object(ira_server.ollama_brain, "ENABLED", True), \
             mock.patch.object(ira_server.ollama_brain, "ask_ollama", return_value={"answer": "Local answer", "model": "test-model"}) as local, \
             mock.patch.object(ira_server.ira_brain, "ENABLED", False):
            status, data = self.request("/api/brain", {"message": "Hello", "mode": "office"})
        self.assertEqual(200, status)
        self.assertEqual("ollama", data["engine"])
        self.assertEqual("test-model", data["model"])
        local.assert_called_once()

    def test_live_question_uses_ollama_with_feed_grounding(self):
        with mock.patch.object(ira_server.ollama_brain, "ENABLED", True), \
             mock.patch.object(ira_server.ira_intel, "get_intel", return_value={"generatedAt": "now"}), \
             mock.patch.object(ira_server.ira_intel, "compose_answer", return_value={"text": "Verified weather: 20 C"}), \
             mock.patch.object(ira_server.ollama_brain, "ask_ollama", return_value={"answer": "It is 20 C.", "model": "test-model"}) as local:
            _, data = self.request("/api/brain", {"message": "What is the weather in Delhi?", "mode": "auto"})
        self.assertEqual("ollama", data["engine"])
        self.assertIn("Verified weather: 20 C", local.call_args.args[0])

    def test_duckduckgo_fallback_when_local_and_hosted_are_offline(self):
        fallback = {"extract": "A keyless instant answer.", "url": "https://example.test"}
        with mock.patch.object(ira_server.ollama_brain, "ENABLED", False), \
             mock.patch.object(ira_server.ira_brain, "ENABLED", False), \
             mock.patch.object(ira_server.ira_intel, "wikipedia_summary", return_value=None), \
             mock.patch.object(ira_server.ira_intel, "duckduckgo_summary", return_value=fallback):
            _, data = self.request("/api/brain", {"message": "Define a test", "mode": "office"})
        self.assertEqual("duckduckgo", data["engine"])
        self.assertEqual(fallback["extract"], data["answer"])
        self.assertTrue(data["degraded"])

    def test_office_task_receives_selected_role_prompt(self):
        captured = {}
        def local_answer(message, history, lang, title, role_prompt):
            captured.update(message=message, role_prompt=role_prompt)
            return {"answer": "Document draft", "model": "test-model"}
        with mock.patch.object(ira_server.ollama_brain, "ENABLED", True), \
             mock.patch.object(ira_server.ollama_brain, "ask_ollama", side_effect=local_answer):
            _, data = self.request("/api/office/task", {"agent": "worden", "message": "Draft a launch memo"})
        self.assertEqual("Document draft", data["answer"])
        self.assertIn("Worden", captured["role_prompt"])
        self.assertEqual("Draft a launch memo", captured["message"])

    def test_file_route_returns_a_real_docx_download(self):
        _, data = self.request("/api/office/file", {
            "kind": "word", "title": "Route Test", "content": "# Heading\n\nBody text"
        })
        payload = base64.b64decode(data["content"])
        self.assertEqual(len(payload), data["size"])
        self.assertTrue(data["filename"].endswith(".docx"))
        with zipfile.ZipFile(io.BytesIO(payload)) as package:
            self.assertIn("word/document.xml", package.namelist())

    def test_health_exposes_honest_ollama_status(self):
        status_value = {"enabled": True, "connected": False, "ready": False, "model": None, "keyRequired": False}
        with mock.patch.object(ira_server.ollama_brain, "brain_status", return_value=status_value):
            _, data = self.request("/api/health")
        self.assertFalse(data["ollama"]["ready"])
        self.assertFalse(data["ollama"]["keyRequired"])


class OllamaSelectionTests(unittest.TestCase):
    def test_model_selection_and_clean_address(self):
        self.assertEqual("chosen", ollama_brain.choose_model(["first", "chosen"], "chosen"))
        self.assertEqual("first", ollama_brain.choose_model(["first", "second"], ""))
        self.assertEqual("Keshav Sir", ollama_brain._address("  Keshav   Sir  "))


if __name__ == "__main__":
    unittest.main()
