// Client for the MineGuard V2 Random Forest safety model, served by the
// FastAPI backend in MineGuard_AI/ (see MineGuard_AI/README.md). Run it with
// `uvicorn backend.app.main:app --port 8000` from that folder alongside `npm
// run dev`; VITE_MINEGUARD_AI_URL points here at a non-default host/port.

const AI_BASE_URL = import.meta.env.VITE_MINEGUARD_AI_URL?.replace(/\/$/, "") || "http://localhost:8000";
const TIMEOUT_MS = 4000;

export type RiskClass = "Critical Danger" | "High Risk" | "Moderate Risk" | "Safe";

export interface AiRiskFeatures {
  temperature_c: number;
  humidity_pct: number;
  pressure_hpa: number;
  mq4_ch4_ppm: number;
  mq135_gas_ppm: number;
  sound_db: number;
  vibration_g: number;
}

export interface AiRecommendation {
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "NORMAL";
  title: string;
  actions: string[];
  reason: string;
  hazards: string[];
}

export interface AiRiskResult {
  /** Raw Random Forest output, before the V2 non-downgrading safety rule. */
  mlPrediction: RiskClass;
  /** Final classification after the model's fixed 40% critical-probability rule. */
  status: RiskClass;
  criticalProbability: number;
  highProbability: number;
  moderateProbability: number;
  safeProbability: number;
  threshold: number;
  reason: string;
  /** Rule-engine guidance derived from the mine's sensor stats, e.g. what action to take next. */
  recommendation: AiRecommendation;
}

interface PredictResponseBody {
  success: boolean;
  data?: {
    original_ml_prediction: RiskClass;
    v2_final_decision: RiskClass;
    critical_probability: number;
    high_probability: number;
    moderate_probability: number;
    safe_probability: number;
    critical_threshold: number;
    decision_reason: string;
    recommendation: AiRecommendation;
  };
}

/** Returns null (instead of throwing) whenever the backend is unreachable, slow, or rejects the input — callers should fall back to a local heuristic. */
export async function predictRisk(features: AiRiskFeatures): Promise<AiRiskResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_BASE_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as PredictResponseBody;
    if (!body.success || !body.data) return null;
    const d = body.data;
    return {
      mlPrediction: d.original_ml_prediction,
      status: d.v2_final_decision,
      criticalProbability: d.critical_probability,
      highProbability: d.high_probability,
      moderateProbability: d.moderate_probability,
      safeProbability: d.safe_probability,
      threshold: d.critical_threshold,
      reason: d.decision_reason,
      recommendation: d.recommendation,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function riskClassToStatus(risk: RiskClass): "normal" | "warning" | "danger" {
  if (risk === "Critical Danger" || risk === "High Risk") return "danger";
  if (risk === "Moderate Risk") return "warning";
  return "normal";
}

// No accelerometer on the current wearable (mineg.cpp) — this stands in near
// the training data's stationary baseline until vibration-sensing hardware
// is added.
export const VIBRATION_PLACEHOLDER_G = 0.05;
