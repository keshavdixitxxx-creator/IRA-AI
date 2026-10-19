"""IRA local automation bridge.

A deliberately small, allowlisted localhost service. Every impactful request must include
`confirmed: true`; the UI presents the confirmation. Keep this server bound to localhost.
"""
from __future__ import annotations
import json
import platform
import subprocess
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import psutil
import pyautogui

pyautogui.FAILSAFE = True  # Move pointer to a screen corner to abort GUI automation.
pyautogui.PAUSE = 0.12
SYSTEM = platform.system()
HOST, PORT = "127.0.0.1", 8765


def process_running(names: tuple[str, ...]) -> bool:
    """Avoid launching duplicate desktop processes where practical."""
    lowered = tuple(n.lower() for n in names)
    for proc in psutil.process_iter(["name"]):
        try:
            if (proc.info["name"] or "").lower() in lowered:
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return False


def launch_calculator() -> str:
    if SYSTEM == "Windows":
        if not process_running(("calculatorapp.exe", "calc.exe")):
            subprocess.Popen(["calc.exe"])
    elif SYSTEM == "Darwin":
        if not process_running(("Calculator",)):
            subprocess.Popen(["open", "-a", "Calculator"])
    else:
        candidates = (("gnome-calculator",), ("kcalc",), ("xcalc",))
        for cmd in candidates:
            try:
                subprocess.Popen(cmd)
                break
            except FileNotFoundError:
                continue
        else:
            raise RuntimeError("No supported calculator application was found")
    time.sleep(0.5)  # Allow the app window to render without blocking for long.
    return "Calculator opened"


def close_active_window() -> str:
    # Native, cross-platform app shortcut; no fragile pixel coordinates.
    if SYSTEM == "Darwin":
        pyautogui.hotkey("command", "w")
    else:
        pyautogui.hotkey("alt", "f4")
    time.sleep(0.25)
    return "Close-window shortcut sent"


def execute(action: str) -> str:
    """Only actions in this explicit allowlist can execute."""
    actions = {
        "open_browser": lambda: (webbrowser.open("https://www.google.com"), "Browser opened")[1],
        "open_whatsapp": lambda: (webbrowser.open("https://web.whatsapp.com"), "WhatsApp Web opened")[1],
        "open_calculator": launch_calculator,
        "close_active": close_active_window,
    }
    if action not in actions:
        raise ValueError("Action is not allowlisted")
    return actions[action]()


class Handler(BaseHTTPRequestHandler):
    def _headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def _json(self, value: dict[str, Any], status: int = 200) -> None:
        self._headers(status)
        self.wfile.write(json.dumps(value).encode())

    def do_OPTIONS(self) -> None: self._headers(204)

    def do_GET(self) -> None:
        if self.path == "/health": self._json({"ok": True, "system": SYSTEM})
        else: self._json({"error": "Not found"}, 404)

    def do_POST(self) -> None:
        if self.path != "/action": return self._json({"error": "Not found"}, 404)
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 4096)
            data = json.loads(self.rfile.read(length))
            if data.get("confirmed") is not True:
                return self._json({"error": "Explicit confirmation required"}, 403)
            message = execute(str(data.get("action", "")))
            self._json({"ok": True, "message": message})
        except Exception as exc:
            self._json({"ok": False, "error": str(exc)}, 400)

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[IRA bridge] {self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    print(f"IRA automation bridge listening on http://{HOST}:{PORT}")
    print("Failsafe enabled: move the pointer to a screen corner to abort automation.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
