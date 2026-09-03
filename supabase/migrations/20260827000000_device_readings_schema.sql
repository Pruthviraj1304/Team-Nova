-- Wearable sensor telemetry, forwarded by the LoRa surface gateway
-- (mineg_receiver.cpp) from the wearable sender (mineg.cpp).
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create table if not exists public.device_readings (
  id bigint generated always as identity primary key,
  device_id text not null,
  temp double precision,
  humidity double precision,
  pressure double precision,
  mq135 integer,
  mq4 integer,
  db double precision,
  sos boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists device_readings_device_id_created_at_idx
  on public.device_readings (device_id, created_at desc);

alter table public.device_readings enable row level security;

-- NOTE: the gateway is an unauthenticated ESP32 with no Supabase login, so
-- inserts are open to the anon role for now (same pragmatic MVP approach as
-- the bays table). Once multiple field gateways exist, lock this down with a
-- service-role Edge Function keyed by a per-device secret instead.
create policy "Anyone can insert device readings"
  on public.device_readings for insert
  to anon
  with check (true);

create policy "Authenticated users can read device readings"
  on public.device_readings for select
  to authenticated
  using (true);

alter publication supabase_realtime add table public.device_readings;
