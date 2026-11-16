-- Revela 2.0 · 1/4 · embalagens da câmera e filme. ADITIVA.
-- events.camera_style passa a guardar a embalagem (festa, casamento, aniversario, noite); os valores antigos
-- (original, vintage, preto-e-branco) continuam válidos. O filme (natural | filme35) ganha coluna própria.
alter table public.events alter column camera_style set default 'festa';
alter table public.events add constraint events_camera_style_check
  check (camera_style in ('festa', 'casamento', 'aniversario', 'noite', 'original', 'vintage', 'preto-e-branco'));
alter table public.events add column film_look text not null default 'filme35' check (film_look in ('natural', 'filme35'));
-- Eventos que já existem não mudam de aparência: ficam sem filme novo (natural), pois nasceram "original".
update public.events set film_look = 'natural' where camera_style = 'original';

-- Prévia do convite: mantém todas as chaves anteriores e acrescenta cameraStyle e filmLook.
create or replace function public.event_preview(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare e public.events; n int; t public.event_themes; th jsonb; plan text;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform public.check_rate_limit('preview:' || auth.uid(), 120, interval '1 hour');
  select * into e from public.events where code = upper(btrim(p_code)) and deleted_at is null;
  if not found then return null; end if;
  select count(*) into n from public.participants where event_id = e.id;
  select * into t from public.event_themes where event_id = e.id;
  if found then
    th := jsonb_build_object('preset', t.preset, 'colors', t.colors, 'font', t.font, 'welcomeMessage', t.welcome_message,
                             'qrStyle', t.qr_style, 'decor', t.decor);
  end if;
  select x.plan_code into plan from public.effective_entitlement(e.id) x;
  return jsonb_build_object(
    'code', e.code, 'title', e.title, 'category', e.category, 'hostName', e.host_name, 'startAt', e.start_at, 'place', e.place,
    'palette', e.palette, 'eventFont', e.event_font, 'capacity', e.capacity,
    'status', case when now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then 'encerrado' else 'ativo' end,
    'full', e.capacity is not null and n >= e.capacity + public.capacity_grace_slots(e.capacity),
    'theme', th,
    'shotsPerPerson', e.shots_per_person, 'revealAt', e.reveal_at, 'revealStatus', e.reveal_status,
    'timezone', e.timezone, 'everyoneSeesAll', e.everyone_sees_all, 'planCode', plan,
    'cameraStyle', e.camera_style, 'filmLook', e.film_look);
end $$;
revoke execute on function public.event_preview(text) from public, anon;
grant execute on function public.event_preview(text) to authenticated;
