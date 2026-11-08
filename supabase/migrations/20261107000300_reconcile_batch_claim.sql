-- Freeze the selected lease batch before updating rows. An IN subplan may be
-- re-evaluated as the update advances next_attempt_at, exceeding its own LIMIT.
create or replace function public.payments_validapay_claim_inbox_env(p_environment text, p_limit int default 50)
returns setof public.validapay_webhook_inbox language sql security definer set search_path='' as $$
  with batch as materialized (
    select provider_env, event_id from public.validapay_webhook_inbox
    where provider_env=p_environment and processed_at is null and next_attempt_at<=now()
    order by next_attempt_at, received_at, event_id
    limit least(greatest(p_limit,1),100) for update skip locked
  )
  update public.validapay_webhook_inbox i
  set attempts=i.attempts+1,
      next_attempt_at=now()+make_interval(secs=>least(43200,power(2,least(i.attempts,12))*60)::int)
  from batch b
  where i.provider_env=b.provider_env and i.event_id=b.event_id
  returning i.*
$$;
