# MineGuard

MineGuard is an industrial-style mine safety monitoring prototype built around the validated MineGuard V2 Random Forest model. The backend validates seven sensor fields, preserves their approved order, applies the fixed 0.40 Critical Danger probability threshold, persists readings and risk state, and exposes HTTP/WebSocket integration points.

## Architecture

```text
ESP32 / LoRa / manual client -> FastAPI -> strict validation -> V2 safety engine
                                      -> SQLite (development)
                                      -> alerts, incidents, device state
                                      -> /ws/live
React + TypeScript + Vite <-----------+
```

The trained model and `MineGuard_V2_Config.json` are loaded once during FastAPI startup. Startup fails if the model, feature order, class mapping, or threshold is invalid. The model is not retrained or modified.

## Setup

Use Python 3.11+ with the packages in `requirements.txt`:

```powershell
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

The supplied `MineGuard_V2_RandomForest.pkl` and config file must remain in the project root unless `MODEL_PATH` and `CONFIG_PATH` are changed.

## Start the backend

```powershell
uvicorn backend.app.main:app --reload --port 8000
```

API documentation is available at `http://localhost:8000/docs`.

Important endpoints: `GET /api/health`, `POST /api/predict`, `POST /api/sensors/readings`, `GET /api/devices`, `GET /api/alerts`, `POST /api/alerts/{id}/acknowledge`, `POST /api/alerts/{id}/resolve`, `GET /api/incidents`, and WebSocket `/ws/live`.

## Start the frontend

Install Node.js 20+ first, then:

```powershell
cd frontend
npm install
npm run dev
```

The Vite development proxy forwards `/api` and `/ws` to `localhost:8000`.

The dashboard's Demo mode sends named scenarios through the same backend inference pipeline. Real Sensor mode does not fabricate readings; it waits for backend sensor packets.

## Testing

```powershell
pytest -q
```

The regression suite uses the supplied V2 CSV fixtures and verifies positions 212, 233, 313, and 329 remain Critical Danger. A failure reports `MINEGUARD SAFETY REGRESSION DETECTED`.

## Sensor integration

Send a JSON packet to `POST /api/sensors/readings` with `device_id` plus exactly these fields: `temperature_c`, `humidity_pct`, `pressure_hpa`, `mq4_ch4_ppm`, `mq135_gas_ppm`, `sound_db`, and `vibration_g`. Missing, extra, non-finite, non-numeric, or physically unreasonable values are rejected. The same normalized endpoint can receive data from ESP32 HTTP, a LoRa gateway, serial development tooling, or a manual client.

## Troubleshooting

- `ModuleNotFoundError`: run commands from the project root and install `requirements.txt`.
- Model startup failure: verify both model files exist and match the supplied config.
- `CONNECTION LOST`: start the backend before the Vite frontend.
- `STALE SENSOR DATA`: provide a current backend packet; frontend time alone never marks a node healthy.