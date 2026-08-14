from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "data" / "results"
SOURCES = [
    RESULTS / "neutral_control_results.sqlite3",
    RESULTS / "neutral_control_ratings_raw.csv",
    RESULTS / "model_verification.json",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def verification_cost(path: Path) -> float:
    records = json.loads(path.read_text(encoding="utf-8"))
    return sum(
        float(record.get("response_json", {}).get("usage", {}).get("cost") or 0)
        for record in records
    )


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8")

    missing = [str(path) for path in SOURCES if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Cannot archive incomplete smoke artifacts: {missing}")

    incomplete = sorted(
        path
        for path in (RESULTS / "archive").glob("*_precorrection_smoke")
        if (path / "archive_manifest.json").exists()
    )
    if incomplete:
        archive = incomplete[-1]
    else:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        archive = RESULTS / "archive" / f"{timestamp}_precorrection_smoke"
        archive.mkdir(parents=True, exist_ok=False)

    raw = pd.read_csv(SOURCES[1])
    smoke_cost = float(raw["reported_cost"].fillna(0).sum())
    verification_total = verification_cost(SOURCES[2])
    with sqlite3.connect(SOURCES[0]) as connection:
        response_rows = connection.execute(
            "SELECT COUNT(*) FROM responses"
        ).fetchone()[0]
        attempt_rows = connection.execute("SELECT COUNT(*) FROM attempts").fetchone()[0]

    manifest = {
        "archived_at_utc": datetime.now(timezone.utc).isoformat(),
        "reason": (
            "Pre-correction smoke run archived before setting Gemini reasoning "
            "effort to minimal and increasing max_tokens uniformly from 5 to 16."
        ),
        "active_response_rows_before_archive": int(response_rows),
        "active_attempt_rows_before_archive": int(attempt_rows),
        "raw_csv_rows": int(len(raw)),
        "unique_work_units": int(raw["unique_key"].nunique()),
        "valid_rows": int(raw["is_valid"].sum()),
        "smoke_response_reported_cost": smoke_cost,
        "verification_reported_cost": verification_total,
        "archived_total_reported_cost": smoke_cost + verification_total,
        "files": {
            path.name: {"sha256": sha256(path), "bytes": path.stat().st_size}
            for path in SOURCES
        },
    }
    for source in SOURCES:
        destination = archive / source.name
        if not destination.exists():
            shutil.copy2(source, destination)
        if sha256(destination) != manifest["files"][source.name]["sha256"]:
            raise RuntimeError(f"Archived file hash mismatch: {destination}")

    with sqlite3.connect(SOURCES[0]) as connection:
        connection.execute("DELETE FROM attempts")
        connection.execute("DELETE FROM responses")
        connection.commit()
    SOURCES[1].unlink()
    SOURCES[2].unlink()

    manifest["active_store_reset"] = True
    manifest["reset_method"] = (
        "Archived byte-identical copies; cleared active SQLite rows and removed "
        "active CSV and verification JSON."
    )
    (archive / "archive_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"archive={archive}")
    print(f"archived_smoke_rows={len(raw)}")
    print(f"archived_smoke_cost={smoke_cost:.9f}")
    print(f"archived_verification_cost={verification_total:.9f}")
    print(f"archived_total_cost={smoke_cost + verification_total:.9f}")


if __name__ == "__main__":
    main()
