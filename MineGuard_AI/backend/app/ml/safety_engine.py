"""MineGuard V2 safety escalation policy."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from backend.app.ml.model_loader import ModelBundle
from backend.app.schemas.sensor import SensorPayload


@dataclass(frozen=True)
class PredictionResult:
    ml_prediction: str
    v2_prediction: str
    critical_probability: float
    high_probability: float
    moderate_probability: float
    safe_probability: float
    threshold: float
    decision_reason: str


def predict_safety(bundle: ModelBundle, sensor: SensorPayload) -> PredictionResult:
    """Run model prediction and apply the non-downgrading V2 safety rule."""
    vector = pd.DataFrame([sensor.as_feature_vector()], columns=bundle.features)
    ml_label = int(bundle.model.predict(vector)[0])
    raw_probabilities = bundle.model.predict_proba(vector)[0]
    probabilities = {
        int(label): float(probability)
        for label, probability in zip(bundle.model.classes_, raw_probabilities)
    }
    critical_probability = probabilities[0]
    v2_label = 0 if critical_probability >= bundle.critical_threshold else ml_label

    if critical_probability >= bundle.critical_threshold:
        reason = (
            f"Critical probability {critical_probability * 100:.2f}% >= "
            f"threshold {bundle.critical_threshold * 100:.0f}%"
        )
    else:
        reason = (
            "Critical probability below safety threshold; "
            "original ML prediction retained"
        )

    return PredictionResult(
        ml_prediction=bundle.class_mapping[ml_label],
        v2_prediction=bundle.class_mapping[v2_label],
        critical_probability=critical_probability,
        high_probability=probabilities[1],
        moderate_probability=probabilities[2],
        safe_probability=probabilities[3],
        threshold=bundle.critical_threshold,
        decision_reason=reason,
    )