"""Validated, single-load access to the MineGuard V2 model contract."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib


EXPECTED_FEATURES = (
    "temperature_c",
    "humidity_pct",
    "pressure_hpa",
    "mq4_ch4_ppm",
    "mq135_gas_ppm",
    "sound_db",
    "vibration_g",
)
EXPECTED_CLASSES = {
    0: "Critical Danger",
    1: "High Risk",
    2: "Moderate Risk",
    3: "Safe",
}
EXPECTED_THRESHOLD = 0.40


@dataclass(frozen=True)
class ModelBundle:
    model: Any
    version: str
    features: tuple[str, ...]
    class_mapping: dict[int, str]
    critical_threshold: float


def load_model_bundle(model_path: Path, config_path: Path) -> ModelBundle:
    """Load and validate all immutable ML configuration at startup."""
    if not model_path.is_file():
        raise FileNotFoundError(f"MineGuard model not found: {model_path}")
    if not config_path.is_file():
        raise FileNotFoundError(f"MineGuard config not found: {config_path}")

    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Unable to load MineGuard config: {config_path}") from exc

    features = tuple(config.get("features", ()))
    if features != EXPECTED_FEATURES:
        raise ValueError("MineGuard config feature order does not match the approved contract")

    raw_classes = config.get("classes")
    class_mapping = {
        int(label): name for label, name in raw_classes.items()
    } if isinstance(raw_classes, dict) else {}
    if class_mapping != EXPECTED_CLASSES:
        raise ValueError("MineGuard config class mapping is invalid")

    threshold = config.get("critical_probability_threshold")
    if threshold != EXPECTED_THRESHOLD:
        raise ValueError("MineGuard critical probability threshold must be exactly 0.40")

    model = joblib.load(model_path)
    if getattr(model, "n_features_in_", None) != len(EXPECTED_FEATURES):
        raise ValueError("MineGuard model does not accept exactly seven features")
    if tuple(getattr(model, "classes_", ())) != tuple(EXPECTED_CLASSES):
        raise ValueError("MineGuard model classes do not match the approved mapping")

    model_features = tuple(getattr(model, "feature_names_in_", EXPECTED_FEATURES))
    if model_features != EXPECTED_FEATURES:
        raise ValueError("MineGuard model feature order does not match the approved contract")

    return ModelBundle(
        model=model,
        version=str(config.get("version", "Unknown")),
        features=features,
        class_mapping=class_mapping,
        critical_threshold=float(threshold),
    )