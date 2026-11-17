-- Revela · estatísticas de acesso e origem do tráfego (primeira parte, sem cookies e sem guardar IP). ADITIVA.
--
-- Privacidade: cada linha guarda só o caminho NORMALIZADO (sem código de evento, sem token, sem query), a origem (referência/UTM), o tipo de aparelho,
-- navegador, sistema, país e um "visitante do dia": hash que o servidor da aplicação calcula com um sal secreto e que muda todo dia. Não há IP,
-- cookie, id de conta nem como seguir a mesma pessoa em dias diferentes (por isso "visitantes" = pessoas distintas POR DIA, somadas no período).
-- A coleta entra por record_access (aberta a anon, com validação estrita e limites); a leitura é só da equipe (admin_access_stats).
-- Política de Privacidade 2026-11-17-v4 (seção 6: medição de acesso sem cookies) publicada em legal_documents; o texto está em web/src/lib/legal-text.ts.
--
-- Retenção: 400 dias. A limpeza (purge_access_hits) roda de carona em ~1 de cada 500 coletas (sem job novo para agendar nem vigiar).

create table public.access_hits (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  visitor text not null check (visitor ~ '^[0-9a-f]{8,64}$'),
  path text not null check (path ~ '^/[A-Za-z0-9/_:.-]{0,119}$'),
  entry boolean not null default false,            -- primeira página da visita (carrega a origem)
  source text check (char_length(source) <= 40),   -- Direto, Google, Instagram, WhatsApp, ...
  medium text check (char_length(medium) <= 40),   -- orgânico, social, e-mail, direto, referência, campanha
  campaign text check (char_length(campaign) <= 60),
  ref_host text check (char_length(ref_host) <= 80),
  device text not null check (device in ('celular', 'tablet', 'computador')),
  browser text check (char_length(browser) <= 30),
  os text check (char_length(os) <= 30),
  country text check (country ~ '^[A-Z]{2}$')
);
create index access_hits_at_idx on public.access_hits (at desc);
alter table public.access_hits enable row level security;
revoke all on public.access_hits from anon, authenticated; -- nenhuma policy: só as funções abaixo (definer) leem e gravam

-- Coleta: devolve false quando descarta (limite ou entrada inválida). Nunca levanta erro para quem coleta.
create function public.record_access(p_visitor text, p_path text, p_entry boolean, p_source text, p_medium text, p_campaign text,
                                     p_ref_host text, p_device text, p_browser text, p_os text, p_country text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_visitor is null or p_visitor !~ '^[0-9a-f]{8,64}$' or p_path is null or p_path !~ '^/[A-Za-z0-9/_:.-]{0,119}$'
     or p_device is null or p_device not in ('celular', 'tablet', 'computador')
     or (p_country is not null and p_country !~ '^[A-Z]{2}$') then
    return false;
  end if;
  -- limite por visitante (hash do dia) e teto geral por minuto: quem chama direto o banco não consegue inflar os números à vontade
  if public.rate_limit_exceeded('access:v:' || p_visitor, 240, interval '1 hour') or public.rate_limit_exceeded('access:all', 1500, interval '1 minute') then
    return false;
  end if;
  if random() < 0.002 then perform public.purge_access_hits(); end if;
  insert into public.access_hits (visitor, path, entry, source, medium, campaign, ref_host, device, browser, os, country)
  values (p_visitor, p_path, coalesce(p_entry, false), left(p_source, 40), left(p_medium, 40), left(p_campaign, 60), left(p_ref_host, 80), p_device,
          left(p_browser, 30), left(p_os, 30), p_country);
  return true;
end $$;
revoke all on function public.record_access(text, text, boolean, text, text, text, text, text, text, text, text) from public;
grant execute on function public.record_access(text, text, boolean, text, text, text, text, text, text, text, text) to anon, authenticated;

-- Leitura (equipe da plataforma): totais, série por dia, origem, campanhas, páginas, aparelhos, navegadores e países.
create function public.admin_access_stats(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d int := least(greatest(coalesce(p_days, 30), 1), 365);
  since timestamptz := now() - make_interval(days => d);
  tz constant text := 'America/Cuiaba';
  today date := (now() at time zone tz)::date;
  r jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with h as (
    select *, (at at time zone tz)::date as day from public.access_hits where at >= since
  )
  select jsonb_build_object(
    'days', d,
    'generatedAt', now(),
    'totals', jsonb_build_object(
      'visitors', (select count(distinct (day, visitor)) from h),
      'views', (select count(*) from h),
      'entries', (select count(*) from h where entry)),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('day', g.day, 'visitors', coalesce(s.v, 0), 'views', coalesce(s.n, 0)) order by g.day), '[]')
               from generate_series(today - (least(d, 90) - 1), today, interval '1 day') as g(day)
               left join (select day, count(distinct visitor) v, count(*) n from h group by day) s on s.day = g.day::date),
    'sources', (select coalesce(jsonb_agg(x order by (x ->> 'entries')::int desc), '[]') from (
                 select jsonb_build_object('source', coalesce(source, 'Direto'), 'medium', coalesce(medium, 'direto'), 'entries', count(*), 'visitors', count(distinct (day, visitor))) x
                   from h where entry group by coalesce(source, 'Direto'), coalesce(medium, 'direto') order by count(*) desc limit 20) t),
    'campaigns', (select coalesce(jsonb_agg(x order by (x ->> 'entries')::int desc), '[]') from (
                   select jsonb_build_object('campaign', campaign, 'source', coalesce(source, 'Direto'), 'entries', count(*)) x
                     from h where entry and campaign is not null group by campaign, coalesce(source, 'Direto') order by count(*) desc limit 15) t),
    'referrers', (select coalesce(jsonb_agg(x order by (x ->> 'entries')::int desc), '[]') from (
                   select jsonb_build_object('host', ref_host, 'entries', count(*)) x from h where entry and ref_host is not null
                     group by ref_host order by count(*) desc limit 15) t),
    'pages', (select coalesce(jsonb_agg(x order by (x ->> 'views')::int desc), '[]') from (
               select jsonb_build_object('path', path, 'views', count(*), 'visitors', count(distinct (day, visitor))) x from h
                 group by path order by count(*) desc limit 15) t),
    'devices', (select coalesce(jsonb_agg(x order by (x ->> 'visitors')::int desc), '[]') from (
                 select jsonb_build_object('device', device, 'visitors', count(distinct (day, visitor))) x from h group by device) t),
    'browsers', (select coalesce(jsonb_agg(x order by (x ->> 'visitors')::int desc), '[]') from (
                  select jsonb_build_object('browser', coalesce(browser, 'Outro'), 'visitors', count(distinct (day, visitor))) x from h
                    group by coalesce(browser, 'Outro') order by count(distinct (day, visitor)) desc limit 8) t),
    'countries', (select coalesce(jsonb_agg(x order by (x ->> 'visitors')::int desc), '[]') from (
                   select jsonb_build_object('country', coalesce(country, '--'), 'visitors', count(distinct (day, visitor))) x from h
                     group by coalesce(country, '--') order by count(distinct (day, visitor)) desc limit 10) t)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_access_stats(int) from public, anon;
grant execute on function public.admin_access_stats(int) to authenticated;

-- Retenção de 400 dias (em lotes, para nunca travar a coleta).
create function public.purge_access_hits() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with gone as (delete from public.access_hits where id in (select id from public.access_hits where at < now() - interval '400 days' order by at limit 5000) returning 1) select count(*) into n from gone;
  return n;
end $$;
revoke all on function public.purge_access_hits() from public, anon, authenticated;

-- Política v4: seção 6 passa a descrever a medição de acesso. Os Termos continuam na v2.
insert into public.legal_documents (kind, version) values ('privacy', '2026-11-17-v4') on conflict do nothing;
