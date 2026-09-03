-- The wearable now reports its own measured clean-air MQ sensor baselines
-- with every telemetry packet (see mineg.cpp's calibrateMQSensors()), so the
-- dashboard can scale readings against the device's real baseline instead of
-- a guessed constant. Run this once in the Supabase SQL editor (Project ->
-- SQL Editor -> New query).

alter table public.device_readings
  add column if not exists mq135_baseline double precision,
  add column if not exists mq4_baseline double precision;
