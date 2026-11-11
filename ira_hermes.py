"""Hermes — IRA's persistent learning companion.

Hermes is a small, honest memory system: it remembers interactions across
restarts, tracks topics the user asks about, and levels up as it learns.
It does not claim to train a neural network — the "self-upgrade" is a
transparent XP/level counter plus a growing memory file.

Memory lives in ``data/hermes-memory.json`` (git-ignored). On every restart
Hermes loads that file and can report exactly where the last session left
off: how many interactions, which topics, what level, and when.

Public API (all keyless, all local):
    get_status()          -> dict for the UI (level, xp, resume message...)
    record_interaction()  -> learn from one Q/A exchange
    tick()                -> called by the server loop; +1 XP per second uptime
"""

from __future__ import annotations

import json
import math
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MEMORY_PATH = ROOT / "data" / "hermes-memory.json"

# Re-entrant: public functions return get_status() while holding the lock.
_lock = threading.RLock()
_started_at = time.time()
_memory: dict | None = None

# Topic keywords Hermes watches for. Counts grow as the user asks.
TOPICS = {
    "news": ("news", "headline", "briefing", "happening", "world"),
    "flights": ("flight", "aircraft", "plane", "ads-b", "adsb", "air traffic"),
    "military": ("military", "army", "navy", "air force", "fighter", "jet"),
    "ships": ("ship", "vessel", "boat", "maritime", "ais", "sea"),
    "trains": ("train", "railway", "rail", "metro"),
    "vehicles": ("vehicle", "traffic", "signal", "junction", "congestion", "jam"),
    "weather": ("weather", "temperature", "rain", "humidity", "wind"),
    "earthquakes": ("earthquake", "seismic", "quake", "tremor"),
    "space": ("iss", "orbit", "satellite", "space station"),
    "cameras": ("camera", "live feed", "broadcast", "watch"),
    "code": ("code", "python", "javascript", "function", "program", "debug"),
    "office": ("word", "excel", "powerpoint", "document", "spreadsheet", "presentation"),
    "general": ("what is", "who are you", "explain", "tell me"),
}


def _default_memory() -> dict:
    now = int(time.time())
    return {
        "version": 1,
        "createdAt": now,
        "updatedAt": now,
        "sessionCount": 0,
        "lastSessionId": "",
        "lastSeenAt": 0,
        "lastLeftOff": "First boot — no previous session.",
        "totalInteractions": 0,
        "totalQuestions": 0,
        "topics": {name: 0 for name in TOPICS},
        "xp": 0,
        "level": 1,
        "upgrades": [],
        "learnedFacts": [],
        "recentHistory": [],
        "uptimeSeconds": 0,
        "lastResumeMessage": "",
    }


def _load() -> dict:
    global _memory
    if _memory is not None:
        return _memory
    try:
        if MEMORY_PATH.is_file():
            data = json.loads(MEMORY_PATH.read_text(encoding="utf-8"))
            base = _default_memory()
            base.update({k: v for k, v in data.items() if k in base})
            _memory = base
        else:
            _memory = _default_memory()
    except Exception:
        _memory = _default_memory()
    return _memory


def _save() -> None:
    try:
        MEMORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = MEMORY_PATH.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(_memory, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(MEMORY_PATH)
    except Exception as exc:  # never break the server for memory IO
        print(f"[Hermes] memory save failed: {exc}")


def _level_for_xp(xp: int) -> int:
    # Level 1 at 0 XP, then roughly every 100 XP with growing gaps.
    return 1 + int(math.floor(math.sqrt(max(0, xp) / 100.0)))


def _maybe_upgrade_locked() -> bool:
    """Check for a level-up. Returns True if Hermes just upgraded."""
    new_level = _level_for_xp(_memory["xp"])
    if new_level > _memory["level"]:
        _memory["level"] = new_level
        _memory["upgrades"].append({
            "at": int(time.time()),
            "level": new_level,
            "xp": _memory["xp"],
            "note": f"Hermes upgraded to level {new_level}",
        })
        _memory["upgrades"] = _memory["upgrades"][-50:]
        return True
    return False


def _resume_message_locked() -> str:
    count = _memory["totalInteractions"]
    level = _memory["level"]
    last = _memory.get("lastLeftOff") or "a fresh start"
    if count == 0:
        return "Hermes online. First flight — no previous session. I will remember everything from here."
    top = sorted(_memory["topics"].items(), key=lambda kv: kv[1], reverse=True)
    top = [name for name, n in top if n > 0][:3]
    topics = ", ".join(top) if top else "general questions"
    return (
        f"Welcome back. Last time we left off at: {last} "
        f"({count} interactions, level {level}, favourite topics: {topics}). "
        f"Resuming exactly where we stopped."
    )


def boot_session(session_id: str = "") -> dict:
    """Call once at server start. Bumps session count, builds resume message."""
    with _lock:
        mem = _load()
        mem["sessionCount"] += 1
        mem["lastSessionId"] = session_id or f"s-{int(time.time())}"
        mem["lastSeenAt"] = int(time.time())
        mem["lastResumeMessage"] = _resume_message_locked()
        _save()
        return get_status()


def record_interaction(question: str, answer: str, engine: str = "", mode: str = "") -> dict:
    """Learn from one exchange. Safe to call from any thread."""
    q = (question or "").strip()
    a = (answer or "").strip()
    if not q:
        return get_status()
    with _lock:
        mem = _load()
        mem["totalInteractions"] += 1
        mem["totalQuestions"] += 1
        mem["updatedAt"] = int(time.time())
        mem["lastSeenAt"] = int(time.time())
        lowered = q.lower()
        for topic, keywords in TOPICS.items():
            if any(kw in lowered for kw in keywords):
                mem["topics"][topic] = mem["topics"].get(topic, 0) + 1
        # XP: 10 per interaction + 1 per 10 chars of answer (capped).
        mem["xp"] += 10 + min(20, len(a) // 50)
        _maybe_upgrade_locked()
        # Keep a short rolling history (question only, truncated).
        mem["recentHistory"].append({
            "at": int(time.time()),
            "question": q[:240],
            "engine": (engine or "")[:40],
            "mode": (mode or "")[:20],
        })
        mem["recentHistory"] = mem["recentHistory"][-30:]
        # Update "where we left off" — the last question becomes the resume point.
        mem["lastLeftOff"] = f"Q: {q[:120]}"
        # Occasionally distil a "learned fact" from long answers.
        if len(a) > 200 and len(mem["learnedFacts"]) < 40:
            fact = " ".join(a.split())[:220]
            if fact not in mem["learnedFacts"]:
                mem["learnedFacts"].append(fact)
        mem["lastResumeMessage"] = _resume_message_locked()
        _save()
        return get_status()


def tick(seconds: int = 1) -> dict:
    """Self-upgrade tick: +1 XP per second of server uptime.

    This is a transparent progression counter, not model training. It makes
    Hermes visibly "grow every second" in the UI while staying honest.
    """
    with _lock:
        mem = _load()
        mem["uptimeSeconds"] += seconds
        mem["xp"] += seconds  # 1 XP / second
        upgraded = _maybe_upgrade_locked()
        if upgraded or seconds >= 5:
            mem["updatedAt"] = int(time.time())
            _save()
        return get_status()


def get_status() -> dict:
    with _lock:
        mem = _load()
        uptime = int(time.time() - _started_at)
        level = mem["level"]
        xp = mem["xp"]
        # XP needed for next level (for the UI progress bar).
        next_level_xp = int(100 * (level ** 2))
        prev_level_xp = int(100 * ((level - 1) ** 2)) if level > 1 else 0
        span = max(1, next_level_xp - prev_level_xp)
        progress = min(1.0, max(0.0, (xp - prev_level_xp) / span))
        top_topics = sorted(mem["topics"].items(), key=lambda kv: kv[1], reverse=True)
        top_topics = [{"topic": k, "count": v} for k, v in top_topics if v > 0][:6]
        return {
            "name": "Hermes",
            "title": "Learning Companion",
            "version": mem["version"],
            "level": level,
            "xp": xp,
            "xpForNext": next_level_xp,
            "progress": round(progress, 4),
            "sessionCount": mem["sessionCount"],
            "totalInteractions": mem["totalInteractions"],
            "uptimeSeconds": uptime + mem.get("uptimeSeconds", 0),
            "serverUptimeSeconds": uptime,
            "lastSeenAt": mem["lastSeenAt"],
            "lastLeftOff": mem["lastLeftOff"],
            "resumeMessage": mem.get("lastResumeMessage") or _resume_message_locked(),
            "topTopics": top_topics,
            "topics": mem["topics"],
            "upgrades": mem["upgrades"][-8:],
            "learnedFacts": mem["learnedFacts"][-6:],
            "recentHistory": mem["recentHistory"][-6:],
            "memoryFile": "data/hermes-memory.json",
            "honestNote": "XP/levels are a transparent memory counter, not neural training.",
        }
