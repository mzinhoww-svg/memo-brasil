-- Volta a trava de aparência depois da revelação (definição de 20261022000200_event_themes.sql).
create or replace function public.event_theme_locked(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select e.reveal_enabled and (e.revealed_at is not null or now() >= e.reveal_at) from public.events e where e.id = p_event), false)
$$;
