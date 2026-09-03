from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.config import CONFIG_PATH, CORS_ORIGINS, DEVICE_TIMEOUT_SECONDS, MODEL_PATH
from backend.app.database.database import get_db, initialize_database
from backend.app.database.models import Alert, Device, Incident, Prediction, SensorReading
from backend.app.ml.model_loader import load_model_bundle
from backend.app.ml.safety_engine import predict_safety
from backend.app.schemas.sensor import SensorPayload, SensorValidationError
from backend.app.services.alert_service import evaluate_state
from backend.app.services.analytics_service import build_analytics_snapshot
from backend.app.services.hazard_service import analyze_hazard_indicators
from backend.app.services.recommendation_engine import build_recommendations
from backend.app.websocket.manager import ConnectionManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("mineguard")
manager = ConnectionManager()


class SensorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    device_id: str | None = Field(default=None, min_length=1, max_length=100)
    source: str = Field(default="SENSOR", min_length=1, max_length=40)
    temperature_c: float
    humidity_pct: float
    pressure_hpa: float
    mq4_ch4_ppm: float
    mq135_gas_ppm: float
    sound_db: float
    vibration_g: float

    @field_validator("temperature_c", "humidity_pct", "pressure_hpa", "mq4_ch4_ppm", "mq135_gas_ppm", "sound_db", "vibration_g", mode="before")
    @classmethod
    def reject_non_numeric_values(cls, value: object) -> object:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("value must be numeric")
        return value

    @field_validator("source")
    @classmethod
    def normalize_source(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in {"SENSOR", "MANUAL_TEST"}:
            return "SENSOR"
        return normalized


@asynccontextmanager
async def lifespan(application: FastAPI):
    initialize_database()
    application.state.model_bundle = load_model_bundle(MODEL_PATH, CONFIG_PATH)
    logger.info("MineGuard V2 model loaded: %s", application.state.model_bundle.version)
    yield


app = FastAPI(title="MineGuard API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

# Every request this API expects is a handful of sensor floats — a few
# hundred bytes at most. Reject anything wildly larger before the body is
# even read, so an oversized payload can't tie up a worker parsing it.
# ponytail: only checks Content-Length, so a chunked request with no
# declared length slips through uncapped — add a streaming byte-count guard
# if this API is ever exposed beyond the local dev/demo network.
MAX_BODY_BYTES = 8_192


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length is not None and int(content_length) > MAX_BODY_BYTES:
        return JSONResponse(status_code=413, content={"success": False, "error": {"code": "payload_too_large", "message": "Request body exceeds the allowed size."}})
    return await call_next(request)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # Only meaningful once this is actually served over HTTPS (e.g. behind a
    # deployed reverse proxy) — harmless as a no-op on local plain-HTTP dev.
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/api/health")
def health() -> dict:
    bundle = getattr(app.state, "model_bundle", None)
    try:
        with next(get_db()) as db:
            db.execute(select(1))
        database_state = "HEALTHY"
    except Exception:
        database_state = "ERROR"
    return {"success": True, "data": {"backend": "HEALTHY", "database": database_state, "ml_model": "LOADED" if bundle else "ERROR", "model_version": bundle.version if bundle else None, "sensor_stream": "DISCONNECTED" if not manager.connections else "CONNECTED"}}


@app.get("/api/config")
def config() -> dict:
    bundle = app.state.model_bundle
    return {"success": True, "data": {"model_version": bundle.version, "features": bundle.features, "class_mapping": bundle.class_mapping, "critical_threshold": bundle.critical_threshold}}


@app.post("/api/predict")
async def predict(request: SensorRequest) -> dict:
    try:
        sensor = SensorPayload.from_mapping(request.model_dump(exclude={"device_id", "source"}))
        result = predict_safety(app.state.model_bundle, sensor)
        hazard = analyze_hazard_indicators(sensor.values)
        recommendation = build_recommendations(
            risk_level=result.v2_prediction,
            critical_probability=result.critical_probability,
            high_probability=result.high_probability,
            hazard_indicators=hazard,
            sensor_values=sensor.values,
        )
    except SensorValidationError as exc:
        logger.warning("Sensor validation failed: %s", exc)
        raise HTTPException(status_code=422, detail={"success": False, "error": exc.as_dict()}) from exc
    return {"success": True, "data": {
        "device_id": request.device_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sensor_data": sensor.values,
        "hazard_indicators": hazard,
        "recommendation": recommendation,
        "original_ml_prediction": result.ml_prediction,
        "v2_final_decision": result.v2_prediction,
        "critical_probability": result.critical_probability,
        "high_probability": result.high_probability,
        "moderate_probability": result.moderate_probability,
        "safe_probability": result.safe_probability,
        "critical_threshold": result.threshold,
        "decision_reason": result.decision_reason,
        **result.__dict__,
    }}


@app.post("/api/sensors/readings")
async def ingest(request: SensorRequest, db: Session = Depends(get_db)) -> dict:
    sensor_payload = request.model_dump(exclude={"device_id", "source"})
    sensor = SensorPayload.from_mapping(sensor_payload)
    result = predict_safety(app.state.model_bundle, sensor)
    hazard = analyze_hazard_indicators(sensor.values)
    reading = SensorReading(device_id=request.device_id or "MANUAL_TEST", source=request.source, **sensor.values)
    db.add(reading)
    db.flush()
    prediction = Prediction(sensor_reading_id=reading.id, source=request.source, **result.__dict__)
    db.add(prediction)

    if request.source == "SENSOR":
        if request.device_id is None:
            raise HTTPException(status_code=422, detail={"success": False, "error": {"code": "device_id_required", "message": "device_id is required for live sensor ingestion"}})
        device = db.get(Device, request.device_id) or Device(device_id=request.device_id)
        previous_risk = device.current_risk
        alert, incident = evaluate_state(db, request.device_id, previous_risk, result.v2_prediction)
        device.last_seen = datetime.now(timezone.utc)
        device.status = "ONLINE"
        device.current_risk = result.v2_prediction
        db.add(device)
        if alert:
            await manager.broadcast({"type": "alert_created", "data": {"device_id": request.device_id, "severity": alert.severity, "message": alert.message}})
        if incident:
            await manager.broadcast({"type": "incident_started", "data": {"device_id": request.device_id, "severity": incident.severity}})
    else:
        alert = None
        incident = None

    recommendation = build_recommendations(
        risk_level=result.v2_prediction,
        critical_probability=result.critical_probability,
        high_probability=result.high_probability,
        hazard_indicators=hazard,
        sensor_values=sensor.values,
    )

    db.commit()
    await manager.broadcast({"type": "prediction_update", "data": {"device_id": request.device_id or "MANUAL_TEST", "source": request.source, "sensor_data": sensor.values, "hazard_indicators": hazard, "recommendation": recommendation, "original_ml_prediction": result.ml_prediction, "v2_final_decision": result.v2_prediction, "critical_threshold": result.threshold, **{key: value for key, value in result.__dict__.items() if key not in {"ml_prediction", "v2_prediction", "threshold"}}}})
    return {"success": True, "data": {"device_id": request.device_id or "MANUAL_TEST", "source": request.source, "hazard_indicators": hazard, "recommendation": recommendation, **result.__dict__}}


@app.get("/api/devices")
def devices(db: Session = Depends(get_db)) -> dict:
    now = datetime.now(timezone.utc)
    device_data = []
    for device in db.scalars(select(Device).order_by(Device.device_id)).all():
        last_seen = device.last_seen
        if last_seen is None or (now - last_seen.replace(tzinfo=timezone.utc)).total_seconds() > DEVICE_TIMEOUT_SECONDS:
            device.status = "OFFLINE"
        device_data.append(
            {"device_id": device.device_id, "name": device.name, "zone": device.zone,
             "status": device.status, "last_seen": device.last_seen, "current_risk": device.current_risk}
        )
    db.commit()
    return {"success": True, "data": [
        item for item in device_data
    ]}


@app.get("/api/sensors/latest/{device_id}")
def latest_sensor(device_id: str, db: Session = Depends(get_db)) -> dict:
    reading = db.scalar(select(SensorReading).where(SensorReading.device_id == device_id).order_by(SensorReading.timestamp.desc()))
    if reading is None:
        raise HTTPException(status_code=404, detail={"success": False, "error": {"code": "not_found", "message": "No sensor reading found"}})
    return {"success": True, "data": {key: getattr(reading, key) for key in ("device_id", "timestamp", "temperature_c", "humidity_pct", "pressure_hpa", "mq4_ch4_ppm", "mq135_gas_ppm", "sound_db", "vibration_g")}}


@app.get("/api/predictions/latest/{device_id}")
def latest_prediction(device_id: str, db: Session = Depends(get_db)) -> dict:
    prediction = db.scalar(select(Prediction).join(SensorReading).where(SensorReading.device_id == device_id).order_by(Prediction.timestamp.desc()))
    if prediction is None:
        raise HTTPException(status_code=404, detail={"success": False, "error": {"code": "not_found", "message": "No prediction found"}})
    return {"success": True, "data": {key: getattr(prediction, key) for key in ("timestamp", "ml_prediction", "v2_prediction", "critical_probability", "high_probability", "moderate_probability", "safe_probability", "threshold", "decision_reason")}}


@app.get("/api/alerts")
def alerts(db: Session = Depends(get_db)) -> dict:
    return {"success": True, "data": [
        {"id": alert.id, "device_id": alert.device_id, "timestamp": alert.timestamp,
         "severity": alert.severity, "message": alert.message, "status": alert.status}
        for alert in db.scalars(select(Alert).order_by(Alert.timestamp.desc())).all()
    ]}


@app.get("/api/alerts/active-count")
def active_alert_count(db: Session = Depends(get_db)) -> dict:
    active = db.scalar(select(Alert.id).where(Alert.status != "RESOLVED").count())
    return {"success": True, "data": {"count": int(active or 0)}}


def update_alert(alert_id: int, status: str, db: Session) -> dict:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail={"success": False, "error": {"code": "not_found", "message": "Alert not found"}})
    now = datetime.now(timezone.utc)
    alert.status = status
    if status == "ACKNOWLEDGED":
        alert.acknowledged_at = now
    if status == "RESOLVED":
        alert.resolved_at = now
    db.commit()
    logger.info("Alert %s -> %s (device %s)", alert.id, status, alert.device_id)
    return {"success": True, "data": {"id": alert.id, "status": alert.status}}


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)) -> dict:
    return update_alert(alert_id, "ACKNOWLEDGED", db)


@app.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db)) -> dict:
    return update_alert(alert_id, "RESOLVED", db)


@app.get("/api/incidents")
def incidents(db: Session = Depends(get_db)) -> dict:
    return {"success": True, "data": [
        {"id": incident.id, "device_id": incident.device_id, "started_at": incident.started_at,
         "ended_at": incident.ended_at, "severity": incident.severity, "status": incident.status}
        for incident in db.scalars(select(Incident).order_by(Incident.started_at.desc())).all()
    ]}


@app.get("/api/analytics")
def analytics(db: Session = Depends(get_db)) -> dict:
    readings = db.scalars(select(SensorReading).order_by(SensorReading.timestamp.asc())).all()
    prediction_rows = db.scalars(select(Prediction).order_by(Prediction.timestamp.asc())).all()
    risk_counts = {"Critical Danger": 0, "High Risk": 0, "Moderate Risk": 0, "Safe": 0}
    for row in prediction_rows:
        risk_counts[row.v2_prediction] = risk_counts.get(row.v2_prediction, 0) + 1
    data = [{
        "timestamp": reading.timestamp.isoformat() if reading.timestamp else None,
        "source": reading.source,
        "critical_probability": next((p.critical_probability for p in prediction_rows if p.sensor_reading_id == reading.id), 0.0),
        "mq4_ch4_ppm": reading.mq4_ch4_ppm,
        "mq135_gas_ppm": reading.mq135_gas_ppm,
        "sound_db": reading.sound_db,
        "vibration_g": reading.vibration_g,
        "temperature_c": reading.temperature_c,
    } for reading in readings]
    snapshot = build_analytics_snapshot(
        total_readings=len(readings),
        total_predictions=len(prediction_rows),
        risk_counts=risk_counts,
        readings=data,
    )
    return {"success": True, "data": snapshot}


@app.get("/api/recommendations/{device_id}")
def recommendations(device_id: str, db: Session = Depends(get_db)) -> dict:
    latest_reading = db.scalar(select(SensorReading).where(SensorReading.device_id == device_id).order_by(SensorReading.timestamp.desc()))
    if latest_reading is None:
        return {"success": True, "data": {"priority": "NORMAL", "title": "No sensor data available", "actions": ["Continue normal monitoring"], "reason": "No physical device has sent recent sensor values.", "disclaimer": "Decision-support guidance only; not a certified mine-safety instruction."}}
    latest_prediction = db.scalar(select(Prediction).where(Prediction.sensor_reading_id == latest_reading.id).order_by(Prediction.timestamp.desc()))
    if latest_prediction is None:
        return {"success": True, "data": {"priority": "NORMAL", "title": "No prediction available", "actions": ["Continue monitoring"], "reason": "No risk assessment was created for this device yet.", "disclaimer": "Decision-support guidance only; not a certified mine-safety instruction."}}
    hazard = analyze_hazard_indicators({
        "temperature_c": latest_reading.temperature_c,
        "humidity_pct": latest_reading.humidity_pct,
        "pressure_hpa": latest_reading.pressure_hpa,
        "mq4_ch4_ppm": latest_reading.mq4_ch4_ppm,
        "mq135_gas_ppm": latest_reading.mq135_gas_ppm,
        "sound_db": latest_reading.sound_db,
        "vibration_g": latest_reading.vibration_g,
    })
    recommendation = build_recommendations(
        risk_level=latest_prediction.v2_prediction,
        critical_probability=latest_prediction.critical_probability,
        high_probability=latest_prediction.high_probability,
        hazard_indicators=hazard,
        sensor_values={
            "temperature_c": latest_reading.temperature_c,
            "mq4_ch4_ppm": latest_reading.mq4_ch4_ppm,
            "mq135_gas_ppm": latest_reading.mq135_gas_ppm,
            "vibration_g": latest_reading.vibration_g,
        },
    )
    return {"success": True, "data": recommendation}


@app.websocket("/ws/live")
async def live(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)