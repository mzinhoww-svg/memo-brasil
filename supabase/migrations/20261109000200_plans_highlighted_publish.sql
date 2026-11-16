-- Revela 2.0 · 2/4 · plano em destaque e publicação de preços pelo Master. ADITIVA.
alter table public.plans add column highlighted boolean not null default false;
-- no máximo um plano em destaque
create unique index plans_single_highlighted on public.plans (highlighted) where highlighted;

-- Catálogo público (paywall): acrescenta `highlighted`; as demais chaves não mudam.
create or replace function public.list_public_plans() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'features', p.features, 'highlighted', p.highlighted) order by p.sort, p.code), '[]')
  from public.plans p
  where p.is_free
     or (public.payments_env() = 'sandbox' and p.sandbox_active)
     or (public.payments_env() = 'production' and p.production_active)
$$;

-- admin_list_plans passa a devolver `highlighted` também.
create or replace function public.admin_list_plans() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return query
    select jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'sandboxActive', p.sandbox_active, 'productionActive', p.production_active,
      'highlighted', p.highlighted, 'features', p.features, 'updatedAt', p.updated_at,
      'history', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'actorId', a.actor_id, 'actorRole', a.actor_role,
                                                               'action', a.action, 'reason', a.reason, 'old', a.detail -> 'old', 'new', a.detail -> 'new')
                                            order by a.at desc, a.id desc), '[]')
                    from (select * from public.audit_logs l
                           where l.target_type = 'plan' and l.target_id = p.code and l.action in ('plan.updated', 'plan.price_changed')
                           order by l.at desc, l.id desc limit 10) a))
    from public.plans p
    order by p.sort, p.code;
end $$;

-- Publica de uma vez as alterações de planos preparadas na tela M03 (preço, convidados, poses, sandbox, produção,
-- destaque e planos novos). Exige sessão com segundo fator (TOTP, aal2) e justificativa. Um registro por plano
-- alterado em audit_logs: `plan.price_changed` quando o preço mudou, `plan.updated` nos demais casos.
-- NÃO mexe em event_entitlements (limites gravados na concessão) nem em pedidos abertos (valor gravado no pedido).
-- p_changes: [{code, name?, priceCents, maxGuests, maxShots, sandboxActive, productionActive, highlighted, isNew?}]
create function public.admin_publish_plans(p_changes jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare why text; c jsonb; pl public.plans; n int := 0; v_code text; v_price int; v_gst int; v_sht int; v_sb boolean; v_pr boolean; v_hi boolean; v_nm text; v_kind text;
        hl_count int;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then raise exception 'stepup' using errcode = 'MM016'; end if;
  why := public.admin_reason(p_reason);
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) = 0 or jsonb_array_length(p_changes) > 20 then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  -- todos os destaques são limpos primeiro; o índice único só vale ao final de cada instrução
  select count(*) into hl_count from jsonb_array_elements(p_changes) e where (e ->> 'highlighted')::boolean is true;
  if hl_count > 1 then raise exception 'invalid' using errcode = 'MM005'; end if;
  for c in select * from jsonb_array_elements(p_changes) loop
    v_code := c ->> 'code';
    v_price := (c ->> 'priceCents')::int; v_gst := (c ->> 'maxGuests')::int; v_sht := (c ->> 'maxShots')::int;
    v_sb := (c ->> 'sandboxActive')::boolean; v_pr := (c ->> 'productionActive')::boolean; v_hi := coalesce((c ->> 'highlighted')::boolean, false);
    v_nm := nullif(btrim(coalesce(c ->> 'name', '')), '');
    if v_code is null or v_sb is null or v_pr is null or v_price is null then raise exception 'invalid' using errcode = 'MM005'; end if;
    select * into pl from public.plans where public.plans.code = v_code for update;
    if not found then
      if coalesce((c ->> 'isNew')::boolean, false) is not true or v_nm is null or v_price < 100 or v_price > 10000000 then
        raise exception 'invalid' using errcode = 'MM005';
      end if;
      insert into public.plans (code, name, max_guests, max_shots, price_cents, sort, sandbox_active, production_active)
      values (v_code, v_nm, v_gst, v_sht, v_price, (select coalesce(max(sort), 0) + 10 from public.plans), v_sb, v_pr);
      insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, reason, detail)
      values (auth.uid(), 'master', 'plan.price_changed', 'plan', v_code, why,
              jsonb_build_object('old', null, 'new', jsonb_build_object('priceCents', v_price, 'maxGuests', v_gst, 'maxShots', v_sht,
                'sandboxActive', v_sb, 'productionActive', v_pr, 'highlighted', v_hi)));
      n := n + 1;
    else
      if pl.is_free then
        -- o grátis não muda de preço nem de ativação; limites seguem os do banco
        if v_price <> pl.price_cents or v_sb <> pl.sandbox_active or v_pr <> pl.production_active then raise exception 'invalid' using errcode = 'MM005'; end if;
      elsif v_price < 100 or v_price > 10000000 then raise exception 'invalid' using errcode = 'MM005'; end if;
      if v_gst is distinct from pl.max_guests or v_sht is distinct from pl.max_shots or v_price <> pl.price_cents or v_sb <> pl.sandbox_active
         or v_pr <> pl.production_active or v_hi <> pl.highlighted or (v_nm is not null and v_nm <> pl.name) then
        v_kind := case when v_price <> pl.price_cents then 'plan.price_changed' else 'plan.updated' end;
        update public.plans set price_cents = v_price, max_guests = v_gst, max_shots = v_sht, sandbox_active = v_sb, production_active = v_pr,
                                name = coalesce(v_nm, name)
         where public.plans.code = pl.code;
        insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, reason, detail)
        values (auth.uid(), 'master', v_kind, 'plan', pl.code, why, jsonb_build_object(
          'old', jsonb_build_object('priceCents', pl.price_cents, 'maxGuests', pl.max_guests, 'maxShots', pl.max_shots,
                                    'sandboxActive', pl.sandbox_active, 'productionActive', pl.production_active, 'highlighted', pl.highlighted),
          'new', jsonb_build_object('priceCents', v_price, 'maxGuests', v_gst, 'maxShots', v_sht, 'sandboxActive', v_sb,
                                    'productionActive', v_pr, 'highlighted', v_hi)));
        n := n + 1;
      end if;
    end if;
  end loop;
  -- destaque: o último valor publicado vale; no máximo um plano marcado
  update public.plans set highlighted = false where highlighted;
  update public.plans set highlighted = true
   where code = (select e ->> 'code' from jsonb_array_elements(p_changes) e where (e ->> 'highlighted')::boolean is true limit 1);
  return jsonb_build_object('changed', n);
end $$;
revoke all on function public.admin_publish_plans(jsonb, text) from public, anon;
grant execute on function public.admin_publish_plans(jsonb, text) to authenticated;
