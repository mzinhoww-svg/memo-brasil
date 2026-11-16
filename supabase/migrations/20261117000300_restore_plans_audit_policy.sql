-- Corrige a migration 20261117000100: ela regravou, sem querer, admin_list_plans na versão ANTERIOR às variantes de pose (perdia packOf) e
-- trouxe junto get_public_settings (idêntica à vigente). Esta restaura admin_list_plans (versão de 20261112000100) e devolve à trilha de
-- auditoria a regra original (decisão de produto, coberta por 02_v2_studio_admin: o organizador enxerga o acesso do Master ao próprio evento).
-- Idempotente (create or replace / drop policy + create policy).

create or replace function public.admin_list_plans() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return query
    select jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'sandboxActive', p.sandbox_active, 'productionActive', p.production_active,
      'highlighted', p.highlighted, 'features', p.features, 'updatedAt', p.updated_at, 'packOf', p.pack_of,
      'history', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'actorId', a.actor_id, 'actorRole', a.actor_role,
                                                               'action', a.action, 'reason', a.reason, 'old', a.detail -> 'old', 'new', a.detail -> 'new')
                                            order by a.at desc, a.id desc), '[]')
                    from (select * from public.audit_logs l
                           where l.target_type = 'plan' and l.target_id = p.code and l.action in ('plan.updated', 'plan.price_changed')
                           order by l.at desc, l.id desc limit 10) a))
    from public.plans p
    order by p.sort, p.code;
end $$;

drop policy audit_host_select on public.audit_logs;
create policy audit_host_select on public.audit_logs for select to authenticated
  using (public.is_host(event_id) or public.is_master() or public.is_platform_role('auditor'));
