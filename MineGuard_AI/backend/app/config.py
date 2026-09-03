from __future__ import annotations

import os
from pathlib import Path


ROOT_DIR = Path(__file__).parents[2]
MODEL_PATH = Path(os.getenv("MODEL_PATH", ROOT_DIR / "MineGuard_V2_RandomForest.pkl"))
CONFIG_PATH = Path(os.getenv("CONFIG_PATH", ROOT_DIR / "MineGuard_V2_Config.json"))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{ROOT_DIR / 'mineguard.db'}")
CRITICAL_THRESHOLD = 0.40
DEVICE_TIMEOUT_SECONDS = int(os.getenv("DEVICE_TIMEOUT_SECONDS", "30"))
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]
HAZARD_THRESHOLDS = {
    "methane_critical": 1500.0,
    "methane_high": 600.0,
    "toxic_gas_critical": 250.0,
    "toxic_gas_high": 120.0,
    "sound_critical": 90.0,
    "sound_high": 70.0,
    "vibration_critical": 2.5,
    "vibration_high": 1.0,
    "temperature_alert": 35.0,
}