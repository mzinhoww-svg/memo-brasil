-- Revela 2.0 · "Minhas poses" (23c): horário de cada pose da própria pessoa. A lista de fotos continua vazia para o convidado até a
-- revelação (ITG-101); aqui só voltam os instantes das poses dele mesmo, sem conteúdo nem de outras pessoas. ADITIVA.
create function public.my_pose_times(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (public.is_member(p_event) or public.is_host(p_event)) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return coalesce((select jsonb_agg((extract(epoch from coalesce(ph.captured_at, ph.created_at)) * 1000)::bigint order by ph.created_at)
                     from public.photos ph
                    where ph.event_id = p_event and ph.author_id = auth.uid() and ph.deleted_at is null and ph.status <> 'removida'
                      and ph.upload_status in ('enviando', 'pronta')), '[]'::jsonb);
end $$;
revoke all on function public.my_pose_times(uuid) from public, anon;
grant execute on function public.my_pose_times(uuid) to authenticated;
