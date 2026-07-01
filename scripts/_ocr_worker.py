#!/usr/bin/env python3
"""OCR tier 3/4 worker — runs inside the isolated .venv-ocr interpreter.

ocr_tiers.py runs under the system interpreter and never imports marker,
mineru, or pymupdf directly (those don't install cleanly there). Instead it
dispatches here as a subprocess. This script slices the requested pages out
of the source PDF with PyMuPDF, runs the requested tier, and prints a single
JSON object to stdout: {"ok": bool, "text": str, "error": str}.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def slice_pages(pdf_path: Path, pages: list[int], out_path: Path) -> None:
    import fitz  # PyMuPDF

    src = fitz.open(pdf_path)
    dst = fitz.open()
    for page_num in pages:
        dst.insert_pdf(src, from_page=page_num - 1, to_page=page_num - 1)
    dst.save(out_path)
    dst.close()
    src.close()


def venv_bin(name: str) -> Path:
    # This worker only ever runs via the venv's own interpreter, so sibling
    # console scripts live next to sys.executable — checking the OS PATH
    # (shutil.which) is unreliable since the venv is never "activated".
    return Path(sys.executable).parent / name


def run_marker(pdf_path: Path, out_dir: Path) -> str:
    exe = venv_bin("marker_single")
    if not exe.exists():
        raise RuntimeError(f"{exe} not found — marker-pdf not installed in this venv")

    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run([str(exe), str(pdf_path), "--output_dir", str(out_dir)], check=True, capture_output=True, text=True)

    md_files = list(out_dir.rglob("*.md"))
    if not md_files:
        raise RuntimeError("marker_single produced no markdown output")
    return md_files[0].read_text(encoding="utf-8")


def run_mineru(pdf_path: Path, out_dir: Path) -> str:
    exe = venv_bin("mineru")
    if not exe.exists():
        raise RuntimeError(f"{exe} not found — mineru[core] not installed in this venv")

    out_dir.mkdir(parents=True, exist_ok=True)
    # mineru's default backend (hybrid-engine) targets heavier local compute;
    # "pipeline" is the general-purpose backend that runs reliably on CPU
    # only, matching this tier's "MinerU (local, CPU ok)" spec.
    subprocess.run(
        [str(exe), "-p", str(pdf_path), "-o", str(out_dir), "-b", "pipeline"],
        check=True,
        capture_output=True,
        text=True,
    )

    md_files = list(out_dir.rglob("*.md"))
    if not md_files:
        raise RuntimeError("mineru produced no markdown output")
    return md_files[0].read_text(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--pages", required=True, help='Comma-separated 1-indexed page numbers, or "all"')
    parser.add_argument("--tier", required=True, choices=["3", "4"])
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()

    result: dict[str, object] = {"ok": False, "text": "", "error": ""}

    try:
        with tempfile.TemporaryDirectory() as tmp:
            if args.pages == "all":
                subset_path = args.pdf
            else:
                pages = [int(p) for p in args.pages.split(",")]
                subset_path = Path(tmp) / "subset.pdf"
                slice_pages(args.pdf, pages, subset_path)

            text = run_marker(subset_path, args.out_dir) if args.tier == "3" else run_mineru(subset_path, args.out_dir)
            result["ok"] = True
            result["text"] = text
    except Exception as exc:  # Report failure to the orchestrator; never raise past this boundary.
        result["error"] = str(exc)

    print(json.dumps(result))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
