#!/usr/bin/env python3
"""Phase 1 PDF ingestion for Coach Princeton Basketball.

This script keeps the source PDFs untouched, extracts Markdown/JSON with
opendataloader-pdf, records a local JSONL manifest, and optionally creates
metadata rows in Airtable.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import request
from urllib.error import HTTPError, URLError

import ocr_tiers

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(os.environ.get("PDF_LIBRARY_DIR", "/Users/fcp/Basketball-Coaching"))
DEFAULT_OUTPUT = Path(os.environ.get("INGEST_OUTPUT_DIR", PROJECT_ROOT / "data/ingestion/extracted"))
DEFAULT_MANIFEST = PROJECT_ROOT / "data/ingestion/manifest.jsonl"

CATEGORY_RULES = [
    ("princeton_offense", r"\bprinceton\b|\bchin\b|point away|point over|point under|\bbackdoor\b|\bcarril\b"),
    ("offensive_systems", r"\boffense\b|\bmotion\b|\bdribble\b|\bflex\b|\bsets?\b|\bslob\b|\bblobs?\b|\btransition\b|\bplaybook\b|zone offense"),
    ("defense", r"defense|press|zone defense|coverage|scout"),
    ("shooting", r"shoot|shot|finishing|footwork"),
    ("practice_planning", r"practice|drill|workout|clinic|notebook"),
    ("player_development", r"development|skill|ball handling|individual"),
    ("strength_conditioning", r"strength|conditioning|westside|barbell|plyometric|performance|jump"),
    ("recruiting", r"recruit|acceptance|i-20|cost of attendance|coa|transfer"),
    ("operations", r"invoice|handbook|registration|schedule|agreement|facility|housing|camp"),
    ("business_content", r"coachprinceton|testimonials|overview|content|ebook"),
]

HOMEBREW_JAVA_HOME = Path("/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract basketball PDFs into AI-ready source records.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="PDF library folder.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Extraction output folder.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST, help="JSONL manifest path.")
    parser.add_argument("--formats", default="markdown,json", help="Comma-separated opendataloader formats.")
    parser.add_argument("--limit", type=int, default=0, help="Process at most N PDFs.")
    parser.add_argument("--dry-run", action="store_true", help="List work without extracting.")
    parser.add_argument("--force", action="store_true", help="Re-extract PDFs even if outputs exist.")
    parser.add_argument("--airtable", action="store_true", help="Create Airtable metadata rows when env vars are set.")
    parser.add_argument("--quiet", action="store_true", help="Pass quiet mode to opendataloader-pdf.")
    return parser.parse_args()


def find_pdfs(source: Path) -> list[Path]:
    return sorted(path for path in source.rglob("*.pdf") if path.is_file())


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "pdf"


def categorize(path: Path) -> str:
    generic_parents = {
        "basketball-coaching",
        "basketball-vault",
        "candidates",
        "coach-princeton-site",
        "desktop-coaching",
        "documents-coaching",
        "downloads-basketball",
    }
    parent_name = path.parent.name.lower()
    haystack_parts = [path.stem.lower()]
    if parent_name not in generic_parents:
        haystack_parts.append(parent_name)
    haystack = " ".join(haystack_parts)
    for category, pattern in CATEGORY_RULES:
        if re.search(pattern, haystack):
            return category
    return "uncategorized"


def output_dir_for(pdf: Path, output_root: Path) -> Path:
    digest = sha256_file(pdf)[:12]
    return output_root / f"{slugify(pdf.stem)}-{digest}"


def locate_outputs(out_dir: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for path in out_dir.rglob("*"):
        if not path.is_file():
            continue
        suffix = path.suffix.lower()
        if suffix == ".md" and "markdown_path" not in result:
            result["markdown_path"] = str(path)
        elif suffix == ".json" and "json_path" not in result:
            result["json_path"] = str(path)
        elif suffix == ".txt" and "text_path" not in result:
            result["text_path"] = str(path)
    return result


def run_opendataloader(pdf: Path, out_dir: Path, formats: str, quiet: bool) -> None:
    cli = shutil.which("opendataloader-pdf") or "/Users/fcp/.local/bin/opendataloader-pdf"
    if not Path(cli).exists():
        raise RuntimeError("opendataloader-pdf was not found on PATH or at /Users/fcp/.local/bin/opendataloader-pdf")

    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        cli,
        str(pdf),
        "-o",
        str(out_dir),
        "-f",
        formats,
        "--table-method",
        "cluster",
        "--markdown-page-separator",
        "\n\n--- Page %page-number% ---\n\n",
    ]
    if quiet:
        cmd.append("--quiet")

    subprocess.run(cmd, check=True, env=java_env())


def java_env() -> dict[str, str]:
    env = os.environ.copy()
    java_bin = HOMEBREW_JAVA_HOME / "bin"
    if java_bin.exists():
        env["JAVA_HOME"] = str(HOMEBREW_JAVA_HOME)
        env["PATH"] = f"{java_bin}{os.pathsep}{env.get('PATH', '')}"

    return env


def merge_rescued_sections(markdown_path: Path, rescued_sections: list[dict[str, Any]]) -> None:
    if not rescued_sections or not markdown_path.exists():
        return
    appendix = ["\n\n---\n\n## Rescued pages (OCR tier escalation)\n"]
    for section in rescued_sections:
        pages = ", ".join(str(p) for p in section["pages"])
        appendix.append(f"\n### Tier {section['tier']} — original page(s) {pages}\n\n{section['text']}\n")
    with markdown_path.open("a", encoding="utf-8") as handle:
        handle.write("".join(appendix))


def ingest_one(pdf: Path, output_root: Path, formats: str, quiet: bool, force: bool) -> dict[str, Any]:
    out_dir = output_dir_for(pdf, output_root)
    existing_outputs = locate_outputs(out_dir)
    status = "extracted"
    error = ""
    ocr_info: dict[str, Any] = {}
    did_extract = force or not existing_outputs

    try:
        if did_extract:
            run_opendataloader(pdf, out_dir, formats, quiet)
        outputs = locate_outputs(out_dir)
    except subprocess.CalledProcessError as exc:
        status = "extract_failed"
        error = f"opendataloader-pdf exited with {exc.returncode}"
        outputs = locate_outputs(out_dir)
    except Exception as exc:  # Keep the batch moving.
        status = "extract_failed"
        error = str(exc)
        outputs = locate_outputs(out_dir)

    # Only escalate right after a fresh tier-1 extraction — otherwise a
    # re-run over already-processed PDFs would keep re-appending the same
    # rescued sections, since we append rather than splice in place.
    if did_extract and status == "extracted" and outputs.get("markdown_path"):
        markdown_path = Path(outputs["markdown_path"])
        escalation = ocr_tiers.escalate(pdf, out_dir, markdown_path.read_text(encoding="utf-8"), quiet)
        if escalation["rescued_sections"]:
            merge_rescued_sections(markdown_path, escalation["rescued_sections"])
        ocr_info = {
            "ocr_tiers_used": escalation["tiers_used"],
            "ocr_weak_pages": escalation["weak_pages"],
            "ocr_rescued_pages": escalation["rescued_pages"],
            "ocr_still_weak_pages": escalation["still_weak_pages"],
            "ocr_warnings": escalation["warnings"],
        }

    record: dict[str, Any] = {
        "title": pdf.stem,
        "source_path": str(pdf),
        "output_dir": str(out_dir),
        "category": categorize(pdf),
        "sha256": sha256_file(pdf),
        "file_size": pdf.stat().st_size,
        "status": status,
        "error": error,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
    }
    record.update(outputs)
    record.update(ocr_info)
    return record


def append_manifest(manifest: Path, record: dict[str, Any]) -> None:
    manifest.parent.mkdir(parents=True, exist_ok=True)
    with manifest.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")


def airtable_configured() -> bool:
    return bool(os.environ.get("AIRTABLE_API_KEY") and os.environ.get("AIRTABLE_BASE_ID"))


def create_airtable_record(record: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ["AIRTABLE_API_KEY"]
    base_id = os.environ["AIRTABLE_BASE_ID"]
    table = os.environ.get("AIRTABLE_TABLE_NAME", "PDF Sources")
    url = f"https://api.airtable.com/v0/{base_id}/{request.pathname2url(table)}"

    fields = {
        "Name": record["title"],
        "Source Path": record["source_path"],
        "Status": record["status"],
        "Category": record["category"],
        "SHA256": record["sha256"],
        "File Size": record["file_size"],
        "Markdown Path": record.get("markdown_path", ""),
        "JSON Path": record.get("json_path", ""),
        "Extracted At": record["extracted_at"],
    }

    payload = json.dumps({"fields": fields}).encode("utf-8")
    req = request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    args = parse_args()
    source = args.source.expanduser().resolve()
    output = args.output.expanduser().resolve()
    manifest = args.manifest.expanduser().resolve()

    if not source.exists():
        print(f"Source folder does not exist: {source}", file=sys.stderr)
        return 2

    pdfs = find_pdfs(source)
    if args.limit:
        pdfs = pdfs[: args.limit]

    print(f"PDF source: {source}")
    print(f"PDF count: {len(pdfs)}")
    print(f"Output: {output}")
    print(f"Manifest: {manifest}")

    if args.dry_run:
        for pdf in pdfs:
            print(f"DRY RUN\t{categorize(pdf)}\t{pdf}")
        return 0

    for index, pdf in enumerate(pdfs, start=1):
        print(f"[{index}/{len(pdfs)}] {pdf.name}")
        record = ingest_one(pdf, output, args.formats, args.quiet, args.force)

        if args.airtable and airtable_configured() and record["status"] == "extracted":
            try:
                response = create_airtable_record(record)
                record["airtable_record_id"] = response.get("id")
            except (HTTPError, URLError, TimeoutError, KeyError) as exc:
                record["airtable_error"] = str(exc)
        elif args.airtable:
            record["airtable_error"] = "AIRTABLE_API_KEY and AIRTABLE_BASE_ID are required"

        append_manifest(manifest, record)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
