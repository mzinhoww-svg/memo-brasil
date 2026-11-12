-- Leituras do desenho com busca/filtro antes do limite fixo de 25. RPCs antigas intactas.
create function public.admin_master_list(p_kind text,p_filter text default null,p_search text default null,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare master boolean:=public.is_master(); result jsonb; q text:=nullif(btrim(p_search),'');
begin
 if not public.is_platform_staff() or (p_kind in ('pagamentos','codigos') and not master) then raise exception 'forbidden' using errcode='MM004'; end if;
 if p_kind is null or p_kind not in ('pagamentos','codigos','revelacoes','fotos','comentarios','bloqueados','lgpd')
  or p_offset is null or p_offset<0 or p_offset>25000000 or length(q)>80
  or coalesce(p_filter,'') not in ('','pix','cartao','pendentes','recusados','estornos') then raise exception 'invalid' using errcode='MM005'; end if;
 with all_rows as (
  select public.admin_payment_json(o,e.title,p.name) data,concat_ws(' ',o.id::text,e.title,p.name,o.plan_code) searchable,
   0::numeric priority,extract(epoch from o.created_at) sort_at,o.id::text row_id
  from public.payment_orders o left join public.events e on e.id=o.event_id join public.plans p on p.code=o.plan_code
  where p_kind='pagamentos' and (coalesce(p_filter,'')=''
   or (p_filter='pix' and o.payment_method='pix') or (p_filter='cartao' and o.payment_method in ('card','cartao'))
   or (p_filter='pendentes' and o.status='pendente') or (p_filter='recusados' and o.status='falhou')
   or (p_filter='estornos' and (o.status='estornado' or o.needs_refund or o.refund_requested_at is not null)))
  union all
  select public.courtesy_code_json(c,p.name),concat_ws(' ',c.code_hint,c.note,p.name,c.plan_code),0,extract(epoch from c.created_at),c.id::text
  from public.courtesy_codes c join public.plans p on p.code=c.plan_code where p_kind='codigos'
  union all
  select jsonb_build_object('id',e.id,'title',e.title,'revealAt',e.reveal_at,'revealedAt',e.revealed_at,
   'photos',(select count(*) from public.photos ph where ph.event_id=e.id and ph.upload_status='pronta' and ph.deleted_at is null),
   'emailOptIns',(select count(*) from public.participant_emails pe where pe.event_id=e.id and pe.email is not null and pe.consent_at is not null and pe.opt_out_at is null),
   'emailsSent',(select count(*) from public.reveal_email_queue x where x.event_id=e.id and x.sent_at is not null),
   'emailsFailed',(select count(*) from public.reveal_email_queue x where x.event_id=e.id and x.sent_at is null and x.last_error is not null),
   'emailsQueued',(select count(*) from public.reveal_email_queue x where x.event_id=e.id and x.sent_at is null and x.last_error is null)),
   e.title,case when e.revealed_at is null then 1 else 0 end,-extract(epoch from coalesce(e.revealed_at,e.reveal_at)),e.id::text
  from public.events e where p_kind='revelacoes' and e.deleted_at is null and not e.is_test and e.reveal_enabled
   and (e.revealed_at is null or e.revealed_at>=now()-interval '7 days')
  union all
  select jsonb_build_object('photoId',ph.id,'eventId',e.id,'eventTitle',e.title,'reports',ph.reports,'hidden',ph.status='oculta','reasons',public.report_reason_counts('photo',ph.id)),
   e.title,ph.reports,extract(epoch from ph.created_at),ph.id::text
  from public.photos ph join public.events e on e.id=ph.event_id
  where p_kind='fotos' and ph.deleted_at is null and ph.status<>'removida' and ph.reports>0 and e.deleted_at is null
  union all
  select jsonb_build_object('id',c.id,'eventId',e.id,'eventTitle',e.title,'authorName',case when master then c.author_name end,
   'body',case when master then c.body end,'reports',c.reports,'hidden',c.hidden_at is not null,'hiddenBy',c.hidden_by,'reasons',public.report_reason_counts('comment',c.id)),
   concat_ws(' ',e.title,case when master then c.author_name end,case when master then c.body end),c.reports,extract(epoch from c.created_at),c.id::text
  from public.photo_comments c join public.events e on e.id=c.event_id
  where p_kind='comentarios' and c.deleted_at is null and e.deleted_at is null and (c.reports>0 or c.hidden_at is not null)
  union all
  select jsonb_build_object('eventId',e.id,'eventTitle',e.title,'name',case when master then p.name end,'blockedAt',p.blocked_at),
   concat_ws(' ',e.title,case when master then p.name end),0,extract(epoch from p.blocked_at),e.id::text||p.user_id::text
  from public.participants p join public.events e on e.id=p.event_id where p_kind='bloqueados' and p.blocked_at is not null and e.deleted_at is null
  union all
  select jsonb_build_object('userId',d.user_id,'requestedAt',d.requested_at,'processedAt',d.processed_at,
   'status',case when d.processed_at is null then 'pendente' else 'processado' end,
   'daysOpen',case when d.processed_at is null then floor(extract(epoch from now()-d.requested_at)/86400)::int end,
   'overdue',d.processed_at is null and d.requested_at<now()-interval '15 days'),d.user_id::text,0,extract(epoch from d.requested_at),d.user_id::text
  from public.account_deletion_requests d where p_kind='lgpd'
 ), filtered as (select * from all_rows where q is null or position(lower(q) in lower(searchable))>0),
 page as (select * from filtered order by priority desc,sort_at desc,row_id limit 25 offset p_offset)
 select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((select jsonb_agg(data order by priority desc,sort_at desc,row_id) from page),'[]'::jsonb),'slaDays',15,
  'needsRefund',case when p_kind='pagamentos' then (select count(*) from public.payment_orders where needs_refund) else 0 end,
  'counts',case when p_kind in ('fotos','comentarios','bloqueados') then jsonb_build_object(
   'fotos',(select count(*) from public.photos ph join public.events e on e.id=ph.event_id where ph.deleted_at is null and ph.status<>'removida' and ph.reports>0 and e.deleted_at is null),
   'comentarios',(select count(*) from public.photo_comments c join public.events e on e.id=c.event_id where c.deleted_at is null and e.deleted_at is null and (c.reports>0 or c.hidden_at is not null)),
   'bloqueados',(select count(*) from public.participants p join public.events e on e.id=p.event_id where p.blocked_at is not null and e.deleted_at is null)) else '{}'::jsonb end) into result;
 return result;
end $$;
revoke all on function public.admin_master_list(text,text,text,integer) from public,anon;
grant execute on function public.admin_master_list(text,text,text,integer) to authenticated;
