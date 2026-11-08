"""Small, dependency-optional system diagnostics feed for the EDEX command deck.

Uses psutil when installed (already listed in requirements.txt). On Linux it also
works without third-party packages by reading /proc. No command execution or host
identifying information is exposed to the browser.
"""

from __future__ import annotations

import os
import platform
import threading
import time
from pathlib import Path

try:
    import psutil  # type: ignore
except ImportError:  # The /proc fallback keeps the zero-install server working.
    psutil = None

_LOCK = threading.Lock()
_PREVIOUS: dict = {"cpu": None, "net": None, "at": None}


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, float(value)))


def _proc_cpu() -> float | None:
    try:
        fields = [int(value) for value in Path("/proc/stat").read_text().splitlines()[0].split()[1:]]
        idle = fields[3] + (fields[4] if len(fields) > 4 else 0)
        total = sum(fields)
        previous = _PREVIOUS.get("cpu")
        _PREVIOUS["cpu"] = (total, idle)
        if not previous:
            return None
        total_delta = total - previous[0]
        idle_delta = idle - previous[1]
        if total_delta <= 0:
            return 0.0
        return _clamp(100 * (1 - idle_delta / total_delta))
    except (OSError, ValueError, IndexError):
        return None


def _proc_memory() -> tuple[float, int, int] | None:
    try:
        values = {}
        for line in Path("/proc/meminfo").read_text().splitlines():
            key, raw = line.split(":", 1)
            values[key] = int(raw.strip().split()[0]) * 1024
        total = values["MemTotal"]
        available = values.get("MemAvailable", values.get("MemFree", 0))
        used = max(0, total - available)
        return _clamp(used / total * 100), used, total
    except (OSError, ValueError, KeyError, ZeroDivisionError):
        return None


def _proc_network_totals() -> int | None:
    try:
        total = 0
        for line in Path("/proc/net/dev").read_text().splitlines()[2:]:
            interface, raw = line.split(":", 1)
            if interface.strip() == "lo":
                continue
            fields = raw.split()
            total += int(fields[0]) + int(fields[8])
        return total
    except (OSError, ValueError, IndexError):
        return None


def _network_kbps(total_bytes: int | None, now: float) -> float:
    if total_bytes is None:
        return 0.0
    previous = _PREVIOUS.get("net")
    previous_at = _PREVIOUS.get("at")
    _PREVIOUS["net"] = total_bytes
    _PREVIOUS["at"] = now
    if previous is None or not previous_at or now <= previous_at:
        return 0.0
    return max(0.0, (total_bytes - previous) * 8 / 1000 / (now - previous_at))


def _load_average() -> float:
    try:
        return round(os.getloadavg()[0], 2)
    except (AttributeError, OSError):
        return 0.0


def get_diagnostics() -> dict:
    """Return one point-in-time sample; repeated calls produce rates and CPU deltas."""
    with _LOCK:
        now = time.time()
        source = "psutil" if psutil else "system"
        memory_used = memory_total = 0
        processes = 0
        uptime = 0

        if psutil:
            cpu = _clamp(psutil.cpu_percent(interval=None))
            memory = psutil.virtual_memory()
            memory_percent = _clamp(memory.percent)
            memory_used, memory_total = int(memory.used), int(memory.total)
            counters = psutil.net_io_counters()
            network_total = int(counters.bytes_sent + counters.bytes_recv)
            processes = len(psutil.pids())
            uptime = max(0, int(now - psutil.boot_time()))
        else:
            cpu = _proc_cpu()
            memory = _proc_memory()
            if memory:
                memory_percent, memory_used, memory_total = memory
            else:
                memory_percent = 0.0
            network_total = _proc_network_totals()
            try:
                processes = sum(name.isdigit() for name in os.listdir("/proc"))
                uptime = int(float(Path("/proc/uptime").read_text().split()[0]))
            except (OSError, ValueError, IndexError):
                pass

        # A first CPU sample has no delta. Load average is a useful, clearly
        # labelled estimate until the next browser poll two seconds later.
        estimated = cpu is None
        if estimated:
            cpu = _clamp(_load_average() / max(1, os.cpu_count() or 1) * 100)
            source = "estimated"

        return {
            "ok": True,
            "source": source,
            "cpuEstimated": estimated,
            "cpuPercent": round(_clamp(cpu), 1),
            "memoryPercent": round(_clamp(memory_percent), 1),
            "memoryUsed": memory_used,
            "memoryTotal": memory_total,
            "networkKbps": round(_network_kbps(network_total, now), 1),
            "loadAverage": _load_average(),
            "processes": processes,
            "uptimeSeconds": uptime,
            "platform": platform.system() or "Unknown",
            "timestamp": int(now),
        }
