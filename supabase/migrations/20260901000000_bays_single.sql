-- Charging station has exactly one physical bay. Drop every seeded bay
-- except BAY-01. Run this once in the Supabase SQL editor (Project -> SQL
-- Editor -> New query).

delete from public.bays where id <> 'BAY-01';
