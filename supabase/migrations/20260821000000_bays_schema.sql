-- Charging station: bays + swap history.
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create table if not exists public.bays (
  id text primary key,
  state text not null default 'empty' check (state in ('charging', 'full', 'empty')),
  charge integer not null default 0 check (charge >= 0 and charge <= 100),
  device_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.bay_events (
  id bigint generated always as identity primary key,
  bay_id text not null references public.bays (id) on delete cascade,
  device_id text,
  event_type text not null check (event_type in ('dock', 'undock', 'full', 'fault')),
  charge_at_event integer,
  created_at timestamptz not null default now()
);

create index if not exists bay_events_bay_id_idx on public.bay_events (bay_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists bays_set_updated_at on public.bays;
create trigger bays_set_updated_at
  before update on public.bays
  for each row execute function public.set_updated_at();

alter table public.bays enable row level security;
alter table public.bay_events enable row level security;

-- NOTE: writes are open to any authenticated dashboard user for now, since
-- there's no hardware or device-scoped backend yet. Once real charging
-- stations exist, replace the update/insert policies below with writes
-- through a service-role Edge Function so a bay can only report its own status.
create policy "Authenticated users can read bays"
  on public.bays for select
  to authenticated
  using (true);

create policy "Authenticated users can update bays"
  on public.bays for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can read bay events"
  on public.bay_events for select
  to authenticated
  using (true);

create policy "Authenticated users can insert bay events"
  on public.bay_events for insert
  to authenticated
  with check (true);

alter publication supabase_realtime add table public.bays;
alter publication supabase_realtime add table public.bay_events;

-- The charging station has exactly one physical bay.
insert into public.bays (id, state, charge, device_id) values
  ('BAY-01', 'charging', 20, 'MG-D100')
on conflict (id) do nothing;
