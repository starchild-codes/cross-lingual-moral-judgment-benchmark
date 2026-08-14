from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[1]
INPUT_WORKBOOK = ROOT / "data" / "input" / "neutral_controls_multilingual.xlsx"
CONDITIONS_CSV = ROOT / "data" / "processed" / "neutral_control_conditions.csv"
RESULTS_DIR = ROOT / "data" / "results"
DATABASE_PATH = RESULTS_DIR / "neutral_control_results.sqlite3"

CONTROL_IDS = ["C01", "C02", "C03", "C04", "C05"]
LANGUAGES = ["en", "hi", "bn", "ta", "es", "ja", "ar"]
NON_ENGLISH_LANGUAGES = ["hi", "bn", "ta", "es", "ja", "ar"]
MODEL_KEYS = ["chatgpt", "claude", "gemini_flash"]


def configure_utf8_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8")


def load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def load_models_config() -> dict[str, Any]:
    return load_yaml(ROOT / "config" / "models.yaml")


def ensure_directories() -> None:
    CONDITIONS_CSV.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    (ROOT / "figures").mkdir(parents=True, exist_ok=True)
    (ROOT / "reports").mkdir(parents=True, exist_ok=True)
