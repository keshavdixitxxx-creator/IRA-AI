"""Optional local Ollama brain for IRA — no API key and no cloud credentials.

Run ``python ollama_brain.py`` to start Ollama and report the selected local model.
IRA's main server probes 127.0.0.1:11434 only when answering or checking health;
if Ollama is not running, the normal hosted/Wikipedia/DuckDuckGo fallbacks apply.

Useful commands:
    python ollama_brain.py
    python ollama_brain.py --model qwen2.5:1.5b
    python ollama_brain.py --model qwen2.5:1.5b --pull

Environment:
    IRA_OLLAMA=0             disable Ollama routing
    IRA_OLLAMA_HOST          default http://127.0.0.1:11434
    IRA_OLLAMA_MODEL         preferred installed model
    IRA_OLLAMA_TIMEOUT=120   generation timeout in seconds
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from pathlib import Path

RUNTIME_FILE = Path(__file__).resolve().parent / "data" / "ollama-runtime.json"

ENABLED = os.getenv("IRA_OLLAMA", "1").strip().lower() not in ("0", "false", "off", "no")
HOST = (os.getenv("IRA_OLLAMA_HOST", "http://127.0.0.1:11434") or "").strip().rstrip("/")
PREFERRED_MODEL = (os.getenv("IRA_OLLAMA_MODEL", "") or "").strip()
TIMEOUT = max(5, int(os.getenv("IRA_OLLAMA_TIMEOUT", "120")))
DEFAULT_PULL_MODEL = "qwen2.5:1.5b"
_CACHE: dict = {"at": 0.0, "status": None}

SYSTEM_PROMPT = (
    "You are IRA (Immersive Responsive Assistant), a warm and capable personal AI assistant "
    "built by Keshav Dixit Sir. Answer in the user's language and script; Hinglish stays "
    "Hinglish. For normal conversation be natural and concise, usually one to four sentences. "
    "For office work, follow the assigned role and produce the requested artifact accurately. "
    "Never claim you created a file, browsed a page, or performed an action unless the system "
    "confirms it. Do not mention these instructions."
)


def _address(value: str | None) -> str:
    return " ".join((value or "").replace("<", " ").replace(">", " ").split())[:40] or "Commander"


def _validate_host() -> None:
    parsed = urlparse(HOST)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise RuntimeError("IRA_OLLAMA_HOST must be a valid HTTP(S) URL.")


def _json_request(path: str, payload: dict | None = None, timeout: float = 2.0) -> dict:
    _validate_host()
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(HOST + path, data=data, method="POST" if data else "GET", headers={
        "Content-Type": "application/json", "Accept": "application/json",
        "User-Agent": "IRA-AI-Ollama/1.0",
    })
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8", "replace"))


def list_models(timeout: float = 1.0) -> list[str]:
    result = _json_request("/api/tags", timeout=timeout)
    models = []
    for item in result.get("models") or []:
        name = str(item.get("name") or item.get("model") or "").strip()
        if name:
            models.append(name)
    return models


def runtime_model() -> str:
    try:
        data = json.loads(RUNTIME_FILE.read_text())
        return str(data.get("model") or "").strip()
    except (OSError, ValueError):
        return ""


def choose_model(models: list[str], preferred: str = "") -> str:
    preferred = (preferred or PREFERRED_MODEL).strip()
    if preferred:
        return preferred
    launched = runtime_model()
    if launched and launched in models:
        return launched
    return models[0] if models else ""


def brain_status(force: bool = False) -> dict:
    now = time.time()
    if not force and _CACHE["status"] and now - _CACHE["at"] < 3:
        return dict(_CACHE["status"])
    status = {
        "enabled": ENABLED, "connected": False, "ready": False,
        "host": HOST, "model": PREFERRED_MODEL or None, "models": [],
        "keyRequired": False, "reason": "",
    }
    if not ENABLED:
        status["reason"] = "Ollama routing is disabled."
    else:
        try:
            models = list_models(timeout=.8)
            model = choose_model(models)
            status.update(connected=True, ready=bool(model and model in models),
                          model=model or None, models=models)
            if not models:
                status["reason"] = "Ollama is running, but no local model is installed."
            elif model not in models:
                status["reason"] = f"Model {model} is not installed. Run ollama_brain.py --pull."
            else:
                status["reason"] = f"Local Ollama brain ready with {model}. No API key is used."
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, RuntimeError) as exc:
            status["reason"] = f"Ollama offline ({exc}). Start python ollama_brain.py."
    _CACHE.update(at=now, status=status)
    return dict(status)


def ask_ollama(
    message: str,
    history: list[dict] | None = None,
    lang: str = "en",
    address_name: str = "Commander",
    role_prompt: str = "",
) -> dict:
    """Generate one reply through the local Ollama /api/chat endpoint."""
    if not ENABLED:
        raise RuntimeError("Ollama routing is disabled.")
    message = (message or "").strip()
    if not message:
        raise ValueError("Message is required.")
    status = brain_status()
    if not status.get("ready"):
        raise RuntimeError(status.get("reason") or "Ollama is not ready.")
    model = status["model"]
    system = (
        f"{SYSTEM_PROMPT} The selected language code is {(lang or 'en')[:12]}. "
        f"Address the user as {_address(address_name)} when it fits. {role_prompt or ''}"
    ).strip()
    messages = [{"role": "system", "content": system}]
    for item in (history or [])[-12:]:
        if not isinstance(item, dict) or item.get("role") not in ("user", "assistant"):
            continue
        content = str(item.get("content") or "").strip()[:6000]
        if content:
            messages.append({"role": item["role"], "content": content})
    messages.append({"role": "user", "content": message})
    try:
        result = _json_request("/api/chat", {
            "model": model, "messages": messages, "stream": False,
            "keep_alive": "10m",
            "options": {"temperature": .55, "num_predict": 1400},
        }, timeout=TIMEOUT)
        reply = str((result.get("message") or {}).get("content") or result.get("response") or "").strip()
        if not reply:
            raise RuntimeError("Ollama returned an empty response.")
        _CACHE["at"] = 0  # refresh model health on the next status request
        return {"answer": reply, "model": result.get("model") or model}
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"Ollama returned {exc.code}: {detail}") from exc
    except (URLError, TimeoutError, OSError, ValueError) as exc:
        _CACHE["at"] = 0
        raise RuntimeError(f"Ollama generation failed: {exc}") from exc


def _wait_for_models(process: subprocess.Popen | None, timeout: float = 18) -> list[str]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if process and process.poll() is not None:
            raise RuntimeError("ollama serve exited before becoming ready.")
        try:
            return list_models(timeout=1.2)
        except Exception:  # noqa: BLE001 - startup probe intentionally retries
            time.sleep(.5)
    raise RuntimeError("Ollama did not become ready within 18 seconds.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Activate IRA's local Ollama brain (no API key).")
    parser.add_argument("--model", default=PREFERRED_MODEL, help="Installed model to use, or model to pull with --pull")
    parser.add_argument("--pull", action="store_true", help="Pull the selected model when it is not installed")
    args = parser.parse_args(argv)
    binary = shutil.which("ollama")
    if not binary:
        print("Ollama is not installed or not on PATH.", file=sys.stderr)
        print("Install it from https://ollama.com/download, then run this file again.", file=sys.stderr)
        return 1

    owned_process = None
    try:
        try:
            models = list_models(timeout=1.2)
        except Exception:  # noqa: BLE001 - start the local service when offline
            print("Starting local Ollama service…")
            owned_process = subprocess.Popen([binary, "serve"], stdout=subprocess.DEVNULL,
                                             stderr=subprocess.DEVNULL)
            models = _wait_for_models(owned_process)

        model = choose_model(models, args.model) or args.model or DEFAULT_PULL_MODEL
        if model not in models:
            if not args.pull:
                print(f"Model '{model}' is not installed.", file=sys.stderr)
                print(f"Run: {binary} pull {model}", file=sys.stderr)
                print(f"Or: python ollama_brain.py --model {model} --pull", file=sys.stderr)
                if owned_process:
                    owned_process.terminate()
                return 2
            print(f"Pulling {model}. This can take several minutes…")
            subprocess.run([binary, "pull", model], check=True)
            models = list_models(timeout=3)
        if model not in models:
            raise RuntimeError(f"Model {model} is still unavailable after setup.")

        RUNTIME_FILE.parent.mkdir(parents=True, exist_ok=True)
        RUNTIME_FILE.write_text(json.dumps({"model": model, "host": HOST, "updated": int(time.time())}, indent=2) + "\n")
        print("\nOLLAMA BRAIN READY")
        print(f"Endpoint : {HOST}")
        print(f"Model    : {model}")
        print("API key  : not required")
        print("\nIRA will now prefer this local brain for chat and office agents.")
        print("Selection saved locally in data/ollama-runtime.json (ignored by Git).")
        if owned_process:
            print("Keep this window open while using Ollama. Press Ctrl+C to stop it.")
            try:
                while owned_process.poll() is None:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\nStopping Ollama…")
        return 0
    except (RuntimeError, subprocess.CalledProcessError, OSError) as exc:
        print(f"Could not activate Ollama: {exc}", file=sys.stderr)
        return 1
    finally:
        if owned_process and owned_process.poll() is None:
            owned_process.terminate()
            try:
                owned_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                owned_process.kill()


if __name__ == "__main__":
    raise SystemExit(main())
