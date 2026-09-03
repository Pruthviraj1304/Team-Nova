-- The wearable now reports whether each MQ sensor's clean-air baseline
-- passed its sanity checks (trimmed-mean spread within range, not pinned
-- near an ADC rail) — see mineg.cpp's calibrateMQSensors(). This is baseline
-- ACQUISITION validity, not gas concentration calibration: the MQ-4/MQ-135
-- are not, and cannot become, calibrated ppm sensors without real per-unit
-- Ro/Rs curve data, which does not exist for this hardware. Run this once in
-- the Supabase SQL editor (Project -> SQL Editor -> New query).

alter table public.device_readings
  add column if not exists mq135_baseline_valid boolean,
  add column if not exists mq4_baseline_valid boolean;
