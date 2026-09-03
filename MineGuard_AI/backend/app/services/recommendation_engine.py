from __future__ import annotations


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        normalized = item.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            ordered.append(normalized)
    return ordered


def _hazard_messages(hazard_indicators: dict[str, object]) -> list[str]:
    critical = list(hazard_indicators.get("critical", []) or [])
    high = list(hazard_indicators.get("high", []) or [])
    combos = list(hazard_indicators.get("detected_combinations", []) or [])
    messages: list[str] = []

    mapping = {
        "methane_level": "Elevated methane",
        "gas_concentration": "Elevated gas",
        "structural_vibration": "Elevated vibration",
        "noise_level": "Elevated sound",
        "temperature_spike": "Temperature spike",
    }

    for label in critical + high:
        if label in mapping:
            messages.append(mapping[label])
    for combo in combos:
        if combo == "multiple_hazards":
            messages.append("Multiple independent sensor hazards detected.")
        elif combo == "methane_vibration":
            messages.append("Methane and vibration hazard combination detected.")
        elif combo == "gas_structure_risk":
            messages.append("Gas and structural risk detected.")

    return _dedupe(messages)


def build_recommendations(
    *,
    risk_level: str,
    critical_probability: float,
    high_probability: float,
    hazard_indicators: dict[str, object],
    sensor_values: dict[str, float],
) -> dict:
    """Return explainable decision-support guidance derived from the backend prediction and hazard analysis."""
    hazards = _hazard_messages(hazard_indicators)
    methane = sensor_values.get("mq4_ch4_ppm", 0.0)
    toxic = sensor_values.get("mq135_gas_ppm", 0.0)
    vibration = sensor_values.get("vibration_g", 0.0)
    sound = sensor_values.get("sound_db", 0.0)

    if risk_level == "Critical Danger":
        priority = "CRITICAL"
        title = "Immediate Safety Response"
        actions = [
            "Restrict access to the affected area.",
            "Verify methane and gas conditions.",
            "Inspect abnormal vibration/structural indicators.",
            "Escalate according to authorized mine safety procedures.",
            "Continue monitoring sensor conditions.",
        ]
        if methane > 0:
            actions.insert(1, "Verify methane conditions and ventilation status.")
        if toxic > 0:
            actions.insert(2, "Verify toxic gas monitoring and exposure controls.")
        if vibration > 0:
            actions.insert(3, "Inspect structural integrity and vibration sources.")
        if sound > 0:
            actions.insert(4, "Investigate noise and structural disturbance indicators.")
        reason = (
            f"Critical probability is {critical_probability:.2%}. High probability is {high_probability:.2%}. "
            f"Detected hazards: {', '.join(hazards) if hazards else 'No specific abnormal pattern detected.'}"
        )
    elif risk_level == "High Risk":
        priority = "HIGH"
        title = "High Risk Investigation"
        actions = [
            "Investigate abnormal sensor readings.",
            "Verify affected sensor conditions.",
            "Increase monitoring frequency.",
            "Escalate according to site procedures.",
        ]
        if methane > 0:
            actions.insert(1, "Inspect methane trends and ventilation conditions.")
        if toxic > 0:
            actions.insert(2, "Confirm toxic gas levels and detector health.")
        if vibration > 0:
            actions.insert(3, "Inspect vibration and structural indicators.")
        reason = (
            f"High probability is {high_probability:.2%}; critical probability is {critical_probability:.2%}. "
            f"Detected hazards: {', '.join(hazards) if hazards else 'No specific abnormal pattern detected.'}"
        )
    elif risk_level == "Moderate Risk":
        priority = "MEDIUM"
        title = "Enhanced Monitoring"
        actions = [
            "Continue enhanced monitoring.",
            "Inspect abnormal readings.",
            "Verify sensor condition.",
        ]
        reason = (
            f"Moderate risk remains active with critical probability at {critical_probability:.2%}. "
            f"Detected hazards: {', '.join(hazards) if hazards else 'No specific abnormal pattern detected.'}"
        )
    else:
        priority = "NORMAL"
        title = "Normal Monitoring"
        actions = [
            "Continue normal monitoring.",
            "Maintain routine sensor observation.",
        ]
        reason = "All monitored indicators remain within the expected operating envelope."

    return {
        "priority": priority,
        "title": title,
        "actions": _dedupe(actions),
        "reason": reason,
        "hazards": hazards,
    }
