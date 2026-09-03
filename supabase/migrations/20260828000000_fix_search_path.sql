-- Fixes the "Function Search Path Mutable" security lint warning: without a
-- pinned search_path, a function is vulnerable to search_path hijacking
-- (someone creating objects in a schema earlier in their search_path to
-- shadow what the function expects to resolve). Run this once in the
-- Supabase SQL editor (Project -> SQL Editor -> New query).

alter function public.set_updated_at() set search_path = public;
