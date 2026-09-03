from __future__ import annotations

from backend.app.config import HAZARD_THRESHOLDS


def analyze_hazard_indicators(sensor_values: dict[str, float]) -> dict[str, object]:
    """Return multi-sensor hazard support indicators without altering the ML decision."""
    thresholds = HAZARD_THRESHOLDS
    critical: list[str] = []
    high: list[str] = []
    detected_combinations: list[str] = []

    if sensor_values.get("mq4_ch4_ppm", 0.0) >= thresholds["methane_critical"]:
        critical.append("methane_level")
    elif sensor_values.get("mq4_ch4_ppm", 0.0) >= thresholds["methane_high"]:
        high.append("methane_level")

    if sensor_values.get("mq135_gas_ppm", 0.0) >= thresholds["toxic_gas_critical"]:
        critical.append("gas_concentration")
    elif sensor_values.get("mq135_gas_ppm", 0.0) >= thresholds["toxic_gas_high"]:
        high.append("gas_concentration")

    if sensor_values.get("sound_db", 0.0) >= thresholds["sound_critical"]:
        critical.append("noise_level")
    elif sensor_values.get("sound_db", 0.0) >= thresholds["sound_high"]:
        high.append("noise_level")

    if sensor_values.get("vibration_g", 0.0) >= thresholds["vibration_critical"]:
        critical.append("structural_vibration")
    elif sensor_values.get("vibration_g", 0.0) >= thresholds["vibration_high"]:
        high.append("structural_vibration")

    if sensor_values.get("temperature_c", 0.0) >= thresholds["temperature_alert"]:
        high.append("temperature_spike")

    methane = sensor_values.get("mq4_ch4_ppm", 0.0)
    toxic = sensor_values.get("mq135_gas_ppm", 0.0)
    vibration = sensor_values.get("vibration_g", 0.0)
    if methane >= thresholds["methane_high"] and toxic >= thresholds["toxic_gas_high"]:
        detected_combinations.append("multiple_hazards")
    if methane >= thresholds["methane_high"] and vibration >= thresholds["vibration_high"]:
        detected_combinations.append("methane_vibration")
    if toxic >= thresholds["toxic_gas_high"] and vibration >= thresholds["vibration_high"]:
        detected_combinations.append("gas_structure_risk")

    return {
        "critical": critical,
        "high": high,
        "detected_combinations": detected_combinations,
    }
