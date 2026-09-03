from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.database.models import Alert, Incident


def evaluate_state(db: Session, device_id: str, previous_risk: str, current_risk: str) -> tuple[Alert | None, Incident | None]:
    """Create alerts on transitions and keep one incident per danger event."""
    now = datetime.now(timezone.utc)
    alert = None
    incident = None
    if current_risk in {"Critical Danger", "High Risk", "Moderate Risk"} and current_risk != previous_risk:
        alert = Alert(
            device_id=device_id,
            timestamp=now,
            severity=current_risk,
            message=f"{current_risk} detected by {device_id}",
        )
        db.add(alert)

    active_incident = db.scalar(
        select(Incident).where(Incident.device_id == device_id, Incident.status == "ACTIVE")
    )
    if current_risk == "Critical Danger" and active_incident is None:
        incident = Incident(
            device_id=device_id,
            started_at=now,
            severity="Critical Danger",
            description="Continuous Critical Danger condition detected.",
        )
        db.add(incident)
    elif current_risk != "Critical Danger" and active_incident is not None:
        active_incident.ended_at = now
        active_incident.status = "RESOLVED"
        db.add(active_incident)
    return alert, incident