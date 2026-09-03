"""Strict validation for normalized MineGuard sensor payloads."""

from __future__ import annotations

import math
from dataclasses import dataclass
from numbers import Real
from typing import Mapping

from backend.app.ml.model_loader import EXPECTED_FEATURES


PHYSICAL_RANGES = {
    "temperature_c": (-80.0, 150.0),
    "humidity_pct": (0.0, 100.0),
    "pressure_hpa": (300.0, 1200.0),
    "mq4_ch4_ppm": (0.0, 100_000.0),
    "mq135_gas_ppm": (0.0, 100_000.0),
    "sound_db": (0.0, 200.0),
    "vibration_g": (0.0, 100.0),
}


class SensorValidationError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "message": str(self)}


@dataclass(frozen=True)
class SensorPayload:
    values: dict[str, float]

    @classmethod
    def from_mapping(cls, payload: Mapping[str, object]) -> "SensorPayload":
        actual = set(payload)
        expected = set(EXPECTED_FEATURES)
        missing = expected - actual
        extra = actual - expected
        if missing or extra:
            details = []
            if missing:
                details.append(f"missing fields: {sorted(missing)}")
            if extra:
                details.append(f"unexpected fields: {sorted(extra)}")
            raise SensorValidationError("; ".join(details), code="invalid_fields")

        values: dict[str, float] = {}
        for feature in EXPECTED_FEATURES:
            value = payload[feature]
            if isinstance(value, bool) or not isinstance(value, Real):
                raise SensorValidationError(
                    f"{feature} must be numeric", code="invalid_numeric_value"
                )
            numeric_value = float(value)
            if not math.isfinite(numeric_value):
                raise SensorValidationError(
                    f"{feature} must be finite", code="non_finite_value"
                )
            minimum, maximum = PHYSICAL_RANGES[feature]
            if not minimum <= numeric_value <= maximum:
                raise SensorValidationError(
                    f"{feature} must be between {minimum} and {maximum}",
                    code="out_of_range",
                )
            values[feature] = numeric_value

        return cls(values=values)

    def as_feature_vector(self) -> list[float]:
        return [self.values[feature] for feature in EXPECTED_FEATURES]