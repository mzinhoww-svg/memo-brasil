-- MemoriesMT v2 · 2/5 · EST-001 · tema do evento (Event Theme) + prévia segura estendida.
-- ADITIVA: nova tabela, novas funções, event_preview via create or replace (todos os campos antigos mantidos; acrescenta 'theme').

-- ---------------------------------------------------------------- constantes documentadas (IMMUTABLE)
-- Lista fechada de fontes licenciadas. Para liberar uma fonte nova: nova migration com create or replace desta função
-- (e a fonte no renderer). Linhas antigas não são revalidadas; o CHECK vale para novas gravações.
create function public.event_theme_allowed_fonts() returns text[]
language sql immutable set search_path = '' as $$ select array['birthstone', 'pinyon', 'vibes']::text[] $$;

create function public.event_theme_allowed_qr_styles() returns text[]
language sql immutable set search_path = '' as $$ select array['classico', 'pontos', 'arredondado']::text[] $$;

-- chaves permitidas em decor (grafismo opcional): 'motivo' (texto curto de lista fechada no renderer), 'intensidade' 0..3, 'bordas' boolean
create function public.event_theme_decor_valid(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' then false
    when octet_length(p::text) > 512 then false
    when exists (select 1 from jsonb_object_keys(p) k where k not in ('motivo', 'intensidade', 'bordas')) then false
    else (not p ? 'motivo' or (jsonb_typeof(p -> 'motivo') = 'string' and (p ->> 'motivo') ~ '^[a-z0-9-]{1,32}$'))
     and (not p ? 'intensidade' or (jsonb_typeof(p -> 'intensidade') = 'number' and (p ->> 'intensidade') ~ '^[0-3]$'))
     and (not p ? 'bordas' or jsonb_typeof(p -> 'bordas') = 'boolean')
  end
$$;

-- ---------------------------------------------------------------- cores e contraste WCAG 2.x (espelha web/src/lib/event-theme/contrast.ts)
create function public.event_theme_colors_valid(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' then false
    when (select count(*) from jsonb_object_keys(p)) <> 5 then false
    when not (p ?& array['superficie', 'grafismo', 'controle', 'texto', 'profundo']) then false
    else coalesce((select bool_and(jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^#[0-9A-Fa-f]{6}$') from jsonb_each(p) e(k, v)), false)
  end
$$;

-- luminância relativa (0..1) de #RRGGBB
create function public.hex_luminance(p_hex text) returns numeric
language sql immutable set search_path = '' as $$
  with c as (
    select unnest(array[
      ('x' || substr(p_hex, 2, 2))::bit(8)::int,
      ('x' || substr(p_hex, 4, 2))::bit(8)::int,
      ('x' || substr(p_hex, 6, 2))::bit(8)::int]) as v, generate_series(1, 3) as i
  ), l as (
    select i, case when v / 255.0 <= 0.03928 then (v / 255.0) / 12.92
                   else power(((v / 255.0) + 0.055) / 1.055, 2.4) end as lin
    from c
  )
  select 0.2126 * max(lin) filter (where i = 1) + 0.7152 * max(lin) filter (where i = 2) + 0.0722 * max(lin) filter (where i = 3) from l
$$;

create function public.contrast_ratio(p_a text, p_b text) returns numeric
language sql immutable set search_path = '' as $$
  select (greatest(public.hex_luminance(p_a), public.hex_luminance(p_b)) + 0.05)
       / (least(public.hex_luminance(p_a), public.hex_luminance(p_b)) + 0.05)
$$;

-- Contrato (WCAG AA), sobre as 5 cores (idêntico a web/src/lib/event-theme/spec.ts):
--   texto × superficie          ≥ 4.5  (corpo de texto)
--   profundo × superficie       ≥ 4.5  (nome do evento e títulos)
--   rótulo do controle          ≥ 3.0  (branco ou #141211, o de maior contraste, sobre a cor de controle; sempre atendido na prática)
-- NÃO exigido: contraste do limite do controle sobre a superfície (WCAG 1.4.11): o preset Sálvia tem ~2,6:1; decisão registrada como lacuna (DSV-005).
-- grafismo é decorativo. Robusta a JSON inválido (devolve false em vez de erro de cast).
create function public.event_theme_contrast_ok(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  -- Regra única, idêntica à do cliente (web/src/lib/event-theme/spec.ts): texto e profundo >= 4.5 sobre a superfície;
  -- rótulo do controle (branco ou #141211, o de maior contraste) >= 3.0 sobre o controle.
  select case
    when not public.event_theme_colors_valid(p) then false -- CASE garante a ordem: nunca converte hex inválido
    else public.contrast_ratio(p ->> 'texto', p ->> 'superficie') >= 4.5
      and public.contrast_ratio(p ->> 'profundo', p ->> 'superficie') >= 4.5
      and greatest(public.contrast_ratio(p ->> 'controle', '#FFFFFF'), public.contrast_ratio(p ->> 'controle', '#141211')) >= 3.0
  end
$$;

-- ---------------------------------------------------------------- tabela
create table public.event_themes (
  event_id uuid primary key references public.events on delete cascade,
  preset text not null default 'custom' check (preset ~ '^[a-z0-9-]{1,40}$'),
  colors jsonb not null,
  font text not null default 'birthstone',
  welcome_message text,
  qr_style text not null default 'classico',
  decor jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  constraint event_themes_colors_format check (public.event_theme_colors_valid(colors)),
  constraint event_themes_colors_contrast check (public.event_theme_contrast_ok(colors)),
  constraint event_themes_font_allowed check (font = any (public.event_theme_allowed_fonts())),
  constraint event_themes_welcome_len check (welcome_message is null or char_length(welcome_message) <= 280),
  -- sem caracteres de controle (permite apenas quebra de linha \n); texto puro, o renderer escapa
  constraint event_themes_welcome_chars check (welcome_message is null or welcome_message !~ '[\x01-\x09\x0B-\x1F\x7F-\x9F]'),
  constraint event_themes_qr_style check (qr_style = any (public.event_theme_allowed_qr_styles())),
  constraint event_themes_decor check (public.event_theme_decor_valid(decor))
);

-- bloqueio de edição: a MESMA regra da v1 para a configuração de revelação (events_guard.was_revealed)
create function public.event_theme_locked(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select e.reveal_enabled and (e.revealed_at is not null or now() >= e.reveal_at) from public.events e where e.id = p_event), false)
$$;

create function public.event_themes_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') then new.event_id := old.event_id; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger event_themes_guard_iu before insert or update on public.event_themes for each row execute function public.event_themes_guard();

alter table public.event_themes enable row level security;
revoke all on public.event_themes from anon, authenticated;
grant select, insert, update, delete on public.event_themes to authenticated; -- delete: "restaurar tema padrão" (host, antes do bloqueio)

create policy event_themes_select on public.event_themes for select to authenticated
  using (public.is_host(event_id) or public.is_member(event_id) or public.is_master());
create policy event_themes_insert on public.event_themes for insert to authenticated
  with check (public.is_host(event_id) and not public.event_theme_locked(event_id));
create policy event_themes_update on public.event_themes for update to authenticated
  using (public.is_host(event_id) and not public.event_theme_locked(event_id))
  with check (public.is_host(event_id) and not public.event_theme_locked(event_id));

-- Realtime: o convidado vê a mudança de tema sem recarregar (a RLS vale para o Realtime)
create policy event_themes_delete on public.event_themes for delete to authenticated
  using (public.is_host(event_id) and not public.event_theme_locked(event_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.event_themes;
  end if;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- prévia do convite: acrescenta 'theme' (sem campos sensíveis)
-- Mantém os 11 campos anteriores. theme = null quando o organizador ainda não personalizou.
create or replace function public.event_preview(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events; n int; t public.event_themes; th jsonb;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into e from public.events where code = upper(btrim(p_code)) and deleted_at is null;
  if not found then return null; end if;
  select count(*) into n from public.participants where event_id = e.id;
  select * into t from public.event_themes where event_id = e.id;
  if found then
    th := jsonb_build_object('preset', t.preset, 'colors', t.colors, 'font', t.font, 'welcomeMessage', t.welcome_message,
                             'qrStyle', t.qr_style, 'decor', t.decor);
  end if;
  return jsonb_build_object(
    'code', e.code, 'title', e.title, 'category', e.category, 'hostName', e.host_name, 'startAt', e.start_at, 'place', e.place,
    'palette', e.palette, 'eventFont', e.event_font, 'capacity', e.capacity,
    'status', case when now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then 'encerrado' else 'ativo' end,
    'full', e.capacity is not null and n >= e.capacity,
    'theme', th);
end $$;

-- ---------------------------------------------------------------- execução
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.event_themes_guard() from authenticated;
-- usadas por CHECK/RLS, que rodam como o usuário
grant execute on function public.event_theme_allowed_fonts(), public.event_theme_allowed_qr_styles(), public.event_theme_decor_valid(jsonb),
  public.event_theme_colors_valid(jsonb), public.hex_luminance(text), public.contrast_ratio(text, text), public.event_theme_contrast_ok(jsonb),
  public.event_theme_locked(uuid) to authenticated;
grant execute on function public.event_preview(text) to authenticated;
