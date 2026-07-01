#!/usr/bin/env python3
"""Per-page OCR tier escalation for PDF ingestion.

Tier 1 (opendataloader-pdf) already ran by the time escalate() is called —
its markdown is the input here. This module only concerns itself with
whatever pages tier 1 left weak (very little extracted text, e.g. scanned
image-only pages).

Tiers, cheapest/most-always-on first:
  2. opendataloader-pdf --hybrid docling-fast  (local docling server, opt-in: HYBRID_MODE=1)
  3. Marker   (local ML, runs in .venv-ocr)     (on by default, disable: OCR_TIER3_MARKER=0)
  4. MinerU   (local ML, runs in .venv-ocr)     (on by default, disable: OCR_TIER4_MINERU=0)
  5. Unlimited-OCR (cloud, costs money)         (off by default: ENABLE_UNLIMITED_OCR=true + UNLIMITED_OCR_ENDPOINT)

Escalation runs on the batch of weak pages together, one tier at a time,
stopping as soon as a tier's combined output clears the weak-page bar.
Pages tier 1 already extracted cleanly never touch tiers 3-5 — cost and
runtime scale with how much of the library is actually scanned, not with
total library size.

Rescued text is NOT spliced back into its exact original position — marker
and mineru don't preserve original page numbering reliably. It's appended
as a labeled section instead, tagged with which original pages and tier
produced it.
"""

from __future__ import annotations

import base64
import json
import os
import re
import socket
import subprocess
import time
from pathlib import Path
from typing import Any
from urllib import request
from urllib.error import HTTPError, URLError

PROJECT_ROOT = Path(__file__).resolve().parents[1]
VENV_PYTHON = PROJECT_ROOT / ".venv-ocr" / "bin" / "python"
WORKER_SCRIPT = Path(__file__).resolve().parent / "_ocr_worker.py"

PAGE_SEP_RE = re.compile(r"---\s*Page\s+(\d+)\s*---")
IMAGE_MARKDOWN_RE = re.compile(r"!\[.*?\]\(.*?\)")
MIN_CHARS_PER_PAGE = int(os.environ.get("OCR_MIN_CHARS_PER_PAGE", "40"))
HYBRID_URL = os.environ.get("HYBRID_URL", "http://127.0.0.1:5002")
HYBRID_SERVER_BIN = Path("/Users/fcp/.local/bin/opendataloader-pdf-hybrid")
HYBRID_STARTUP_TIMEOUT_SECONDS = 120  # docling model load on first start
WORKER_TIMEOUT_SECONDS = 1800  # generous: first run downloads model weights


def _real_text_length(text: str) -> int:
    """Character count after stripping image markdown links.

    A page (or a rescue attempt's output) that's just `![image N](...)`
    placeholders has plenty of characters but zero actual content — this is
    what find_weak_pages() and the tier-success check both need to measure.
    """
    return len(IMAGE_MARKDOWN_RE.sub("", text).strip())


def find_weak_pages(markdown_text: str, min_chars: int = MIN_CHARS_PER_PAGE) -> list[int]:
    """Return 1-indexed page numbers whose extracted text looks too thin to trust."""
    matches = list(PAGE_SEP_RE.finditer(markdown_text))
    if not matches:
        return [1] if _real_text_length(markdown_text) < min_chars else []

    weak = []
    for index, match in enumerate(matches):
        page_num = int(match.group(1))
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown_text)
        if _real_text_length(markdown_text[start:end]) < min_chars:
            weak.append(page_num)
    return weak


def _hybrid_server_reachable(url: str) -> bool:
    try:
        host_port = url.split("://", 1)[-1]
        host, _, port = host_port.partition(":")
        with socket.create_connection((host, int(port or 80)), timeout=1.5):
            return True
    except OSError:
        return False


def _ensure_hybrid_server(url: str) -> bool:
    """Start the local docling-fast server if it isn't already running.

    Lee will never manually run `opendataloader-pdf-hybrid` in a terminal, so
    HYBRID_MODE has to be self-sufficient: check reachability, launch it
    detached if needed, and wait for it to come up. Once started it keeps
    running (in the background, using RAM) for reuse by later PDFs/runs —
    it is not stopped automatically.
    """
    if _hybrid_server_reachable(url):
        return True
    if not HYBRID_SERVER_BIN.exists():
        return False

    host_port = url.split("://", 1)[-1]
    _, _, port = host_port.partition(":")
    subprocess.Popen(
        # --force-ocr: this tier is only ever invoked on pages tier 1 already
        # flagged weak/scanned, so forcing OCR (rather than docling's default
        # of trusting an existing text layer) is the correct behavior here —
        # without it, image-only pages come back as unrescued image placeholders.
        [str(HYBRID_SERVER_BIN), "--port", port or "5002", "--force-ocr"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )

    deadline = time.monotonic() + HYBRID_STARTUP_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        time.sleep(2)
        if _hybrid_server_reachable(url):
            return True
    return False


def run_tier2_hybrid(pdf: Path, pages: list[int], out_dir: Path, quiet: bool) -> str | None:
    if not _ensure_hybrid_server(HYBRID_URL):
        return None

    cli = "/Users/fcp/.local/bin/opendataloader-pdf"
    cmd = [
        cli, str(pdf), "-o", str(out_dir), "-f", "markdown",
        "--hybrid", "docling-fast", "--hybrid-url", HYBRID_URL,
        # hybrid-mode full: skip the CLI's own triage heuristic and send
        # every requested page to the backend. We only ever call this on
        # pages already flagged weak, so there's nothing to triage — the
        # default "auto" triage was silently not routing zero-text scanned
        # pages to docling at all, leaving them as image placeholders.
        "--hybrid-mode", "full",
        "--pages", ",".join(str(p) for p in pages),
    ]
    if quiet:
        cmd.append("--quiet")

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=120)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None

    md_files = sorted(out_dir.rglob("*.md"))
    return md_files[-1].read_text(encoding="utf-8") if md_files else None


def _run_worker_tier(pdf: Path, pages: list[int], tier: str, out_dir: Path) -> tuple[str | None, str | None]:
    """Returns (text, warning) — exactly one is None."""
    if not VENV_PYTHON.exists():
        return None, f"tier {tier} skipped: {VENV_PYTHON} not found (run: python3.11 -m venv .venv-ocr)"

    cmd = [
        str(VENV_PYTHON), str(WORKER_SCRIPT),
        "--pdf", str(pdf), "--pages", ",".join(str(p) for p in pages),
        "--tier", tier, "--out-dir", str(out_dir),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=WORKER_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        return None, f"tier {tier} timed out after {WORKER_TIMEOUT_SECONDS}s"

    try:
        payload = json.loads(proc.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError):
        return None, f"tier {tier} worker gave unparseable output: {proc.stdout[-300:]!r} {proc.stderr[-300:]!r}"

    if payload.get("ok"):
        return payload["text"], None
    return None, f"tier {tier} skipped: {payload.get('error', 'unknown error')}"


def run_tier5_unlimited_ocr(pdf: Path, pages: list[int]) -> tuple[str | None, str | None]:
    """Placeholder cloud-OCR call — no real vendor is wired up yet.

    Sends the whole source PDF as base64 rather than just the weak pages,
    since slicing would need to match whatever payload shape the eventual
    vendor actually expects. Treat this entire function as a stub to rewrite
    once a real endpoint exists: request/response shape, auth headers, and
    page-level slicing (to control per-page cost) all depend on the vendor.
    """
    if os.environ.get("ENABLE_UNLIMITED_OCR", "").lower() not in ("1", "true", "yes"):
        return None, None  # off by default — expected, not a warning

    endpoint = os.environ.get("UNLIMITED_OCR_ENDPOINT")
    if not endpoint:
        return None, "tier 5 enabled but UNLIMITED_OCR_ENDPOINT is not set"

    try:
        pdf_b64 = base64.b64encode(pdf.read_bytes()).decode("ascii")
        payload = json.dumps({"pages": pages, "pdf_base64": pdf_b64}).encode("utf-8")
        req = request.Request(endpoint, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with request.urlopen(req, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("text"), None
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return None, f"tier 5 request failed: {exc}"


def escalate(pdf: Path, out_dir: Path, tier1_markdown: str, quiet: bool = False) -> dict[str, Any]:
    """Escalate whatever pages tier 1 left weak, one tier at a time."""
    weak_pages = find_weak_pages(tier1_markdown)
    result: dict[str, Any] = {
        "tiers_used": ["1"],
        "weak_pages": weak_pages,
        "rescued_pages": [],
        "still_weak_pages": list(weak_pages),
        "rescued_sections": [],
        "warnings": [],
    }
    if not weak_pages:
        return result

    remaining = list(weak_pages)
    tier_dir = out_dir / "ocr_tiers"

    def cleared(text: str | None) -> bool:
        return bool(text) and _real_text_length(text) >= MIN_CHARS_PER_PAGE * len(remaining)

    if os.environ.get("HYBRID_MODE", "").lower() in ("1", "true", "yes"):
        text = run_tier2_hybrid(pdf, remaining, tier_dir / "tier2", quiet)
        if cleared(text):
            result["tiers_used"].append("2")
            result["rescued_sections"].append({"tier": 2, "pages": remaining, "text": text})
            remaining = []
        elif text is None:
            result["warnings"].append(
                f"tier 2 (hybrid) skipped: could not reach or start docling server at {HYBRID_URL} "
                f"(binary expected at {HYBRID_SERVER_BIN})"
            )

    for tier, env_flag in (("3", "OCR_TIER3_MARKER"), ("4", "OCR_TIER4_MINERU")):
        if not remaining or os.environ.get(env_flag, "1").lower() in ("0", "false", "no"):
            continue
        text, warning = _run_worker_tier(pdf, remaining, tier, tier_dir / f"tier{tier}")
        if warning:
            result["warnings"].append(warning)
        if cleared(text):
            result["tiers_used"].append(tier)
            result["rescued_sections"].append({"tier": int(tier), "pages": remaining, "text": text})
            remaining = []

    if remaining:
        text, warning = run_tier5_unlimited_ocr(pdf, remaining)
        if warning:
            result["warnings"].append(warning)
        if cleared(text):
            result["tiers_used"].append("5")
            result["rescued_sections"].append({"tier": 5, "pages": remaining, "text": text})
            remaining = []

    result["rescued_pages"] = sorted(set(weak_pages) - set(remaining))
    result["still_weak_pages"] = sorted(remaining)
    return result
