from __future__ import annotations

from collections import defaultdict
from datetime import datetime


def _to_iso(ts: str | datetime | None) -> str | None:
    if ts is None:
        return None
    if isinstance(ts, datetime):
        return ts.isoformat()
    return ts


def build_analytics_snapshot(
    *,
    total_readings: int,
    total_predictions: int,
    risk_counts: dict[str, int],
    readings: list[dict],
) -> dict:
    """Create a database-backed analytics summary with real sensor/manual split."""
    risk_distribution = {"Critical Danger": risk_counts.get("Critical Danger", 0), "High Risk": risk_counts.get("High Risk", 0), "Moderate Risk": risk_counts.get("Moderate Risk", 0), "Safe": risk_counts.get("Safe", 0)}

    critical_series = []
    methane_trend = []
    toxic_trend = []
    sound_trend = []
    vibration_trend = []
    temperature_trend = []
    source_counts = defaultdict(int)

    for reading in readings:
        source = reading.get("source", "SENSOR")
        if source == "SENSOR":
            source_counts["REAL_SENSOR_DATA"] += 1
        elif source == "MANUAL_TEST":
            source_counts["MANUAL_TEST_DATA"] += 1
        critical_series.append({"timestamp": _to_iso(reading.get("timestamp")), "value": float(reading.get("critical_probability", 0.0)), "source": source})
        methane_trend.append({"timestamp": _to_iso(reading.get("timestamp")), "value": float(reading.get("mq4_ch4_ppm", 0.0)), "source": source})
        toxic_trend.append({"timestamp": _to_iso(reading.get("timestamp")), "value": float(reading.get("mq135_gas_ppm", 0.0)), "source": source})
        sound_trend.append({"timestamp": _to_iso(reading.get("timestamp")), "value": float(reading.get("sound_db", 0.0)), "source": source})
        vibration_trend.append({"timestamp": _to_iso(reading.get("timestamp")), "value": float(reading.get("vibration_g", 0.0)), "source": source})
        temperature_trend.append({"timestamp": _to_iso(reading.get("timestamp")), "value": float(reading.get("temperature_c", 0.0)), "source": source})

    return {
        "total_readings": total_readings,
        "total_predictions": total_predictions,
        "critical_danger_count": risk_distribution["Critical Danger"],
        "high_risk_count": risk_distribution["High Risk"],
        "moderate_risk_count": risk_distribution["Moderate Risk"],
        "safe_count": risk_distribution["Safe"],
        "risk_distribution": risk_distribution,
        "critical_probability_trend": critical_series,
        "methane_trend": methane_trend,
        "toxic_gas_trend": toxic_trend,
        "sound_trend": sound_trend,
        "vibration_trend": vibration_trend,
        "temperature_trend": temperature_trend,
        "critical_events": risk_distribution["Critical Danger"],
        "number_of_alerts": risk_distribution["Critical Danger"] + risk_distribution["High Risk"] + risk_distribution["Moderate Risk"],
        "number_of_incidents": risk_distribution["Critical Danger"],
        "sources": {"REAL_SENSOR_DATA": source_counts.get("REAL_SENSOR_DATA", 0), "MANUAL_TEST_DATA": source_counts.get("MANUAL_TEST_DATA", 0)},
    }
