-- Nome de pessoa sem repetição (achado M1 da revisão do console).
-- Havia nomes gravados repetidos ("Aurimar NogueiraAurimar") em events.host_name, e o convite e a prévia pública mostravam
-- o valor como estava. O cliente já limpa ao criar e editar (cleanPersonName); aqui o banco garante o mesmo em qualquer
-- caminho de escrita e corrige o que já estava gravado.
-- Aditiva: uma função pura, um trigger por tabela e um backfill auditado (o valor anterior fica em audit_logs.detail).
-- Reversão: supabase/rollback/20261024000200_person_names.down.sql.

-- Espelho de web/src/domain/person-name.ts (mesma tabela de casos nos dois testes).
create function public.clean_person_name(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare s text; n int; i int; a text; rest text; w text[]; h int; c1 text; c2 text;
begin
  if p is null then return null; end if;
  s := btrim(regexp_replace(p, '\s+', ' ', 'g'));
  n := char_length(s);
  if n < 4 then return s; end if;
  -- concatenação sem espaço: minúscula seguida de maiúscula, e o resto repete o começo do nome em limite de palavra
  for i in ceil(n / 2.0)::int .. n - 2 loop
    c1 := substr(s, i, 1); c2 := substr(s, i + 1, 1);
    continue when not (c1 = lower(c1) and c1 <> upper(c1) and c2 = upper(c2) and c2 <> lower(c2));
    a := left(s, i); rest := substr(s, i + 1);
    if starts_with(a, rest) and (char_length(a) = char_length(rest) or substr(a, char_length(rest) + 1, 1) = ' ') then
      return a;
    end if;
  end loop;
  -- repetição exata separada por espaço, com pelo menos duas palavras ("Ana Silva Ana Silva")
  w := string_to_array(s, ' ');
  if cardinality(w) >= 4 and cardinality(w) % 2 = 0 then
    h := cardinality(w) / 2;
    if array_to_string(w[1:h], ' ') = array_to_string(w[h + 1:], ' ') then return array_to_string(w[1:h], ' '); end if;
  end if;
  return s;
end $$;

-- Um trigger por coluna de nome. Nome que ficaria vazio continua como veio (as checagens de tamanho seguem valendo).
create function public.person_name_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'events' then
    new.host_name := coalesce(nullif(public.clean_person_name(new.host_name), ''), new.host_name);
  elsif tg_table_name = 'profiles' then
    new.display_name := coalesce(nullif(public.clean_person_name(new.display_name), ''), new.display_name);
  elsif tg_table_name = 'participants' then
    new.name := coalesce(nullif(public.clean_person_name(new.name), ''), new.name);
  end if;
  return new;
end $$;
create trigger events_person_name before insert or update of host_name on public.events
  for each row execute function public.person_name_guard();
create trigger profiles_person_name before insert or update of display_name on public.profiles
  for each row execute function public.person_name_guard();
create trigger participants_person_name before insert or update of name on public.participants
  for each row execute function public.person_name_guard();

-- Corrige o que já estava gravado. Uma linha de auditoria por tabela com os valores anteriores ({id, name}), para
-- conferir e reverter. Idempotente: rodar de novo devolve 0. Devolve quantas linhas mudaram.
create function public.clean_person_names_backfill() returns int
language plpgsql security definer set search_path = '' as $$
declare total int := 0; k int; before jsonb;
begin
  with mudou as (
    select e.id, e.host_name as name from public.events e
     where public.clean_person_name(e.host_name) is distinct from e.host_name and public.clean_person_name(e.host_name) <> ''
     for update
  ), upd as (
    update public.events e set host_name = public.clean_person_name(e.host_name) from mudou where e.id = mudou.id returning mudou.id, mudou.name
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name)), '[]') into k, before from upd;
  if k > 0 then
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, detail)
    values (null, 'sistema', 'system.person_names_cleaned', 'events', 'host_name', jsonb_build_object('count', k, 'before', before));
  end if;
  total := total + k;

  with mudou as (
    select p.id, p.display_name as name from public.profiles p
     where public.clean_person_name(p.display_name) is distinct from p.display_name and public.clean_person_name(p.display_name) <> ''
     for update
  ), upd as (
    update public.profiles p set display_name = public.clean_person_name(p.display_name) from mudou where p.id = mudou.id returning mudou.id, mudou.name
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name)), '[]') into k, before from upd;
  if k > 0 then
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, detail)
    values (null, 'sistema', 'system.person_names_cleaned', 'profiles', 'display_name', jsonb_build_object('count', k, 'before', before));
  end if;
  total := total + k;

  with mudou as (
    select p.event_id, p.user_id, p.name from public.participants p
     where public.clean_person_name(p.name) is distinct from p.name and public.clean_person_name(p.name) <> ''
     for update
  ), upd as (
    update public.participants p set name = public.clean_person_name(p.name) from mudou
     where p.event_id = mudou.event_id and p.user_id = mudou.user_id returning mudou.event_id, mudou.user_id, mudou.name
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object('eventId', event_id, 'userId', user_id, 'name', name)), '[]') into k, before from upd;
  if k > 0 then
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, detail)
    values (null, 'sistema', 'system.person_names_cleaned', 'participants', 'name', jsonb_build_object('count', k, 'before', before));
  end if;
  return total + k;
end $$;

revoke execute on function public.person_name_guard(), public.clean_person_names_backfill() from public, anon, authenticated, service_role;

select public.clean_person_names_backfill();
