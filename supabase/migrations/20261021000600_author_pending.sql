-- MemoriesMT · 6/6 · o autor enxerga os PRÓPRIOS envios inacabados (retomada/limpeza) e descarta o que não publicou.
-- Não abre nada novo: só metadados da própria linha, nunca de foto publicada de outra pessoa.
create policy photos_author_pending_select on public.photos for select to authenticated
  using (author_id = (select auth.uid()) and upload_status <> 'pronta' and deleted_at is null);

create function public.discard_photo(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare ph public.photos;
begin
  select * into ph from public.photos where id = p_id for update;
  if not found then return; end if; -- idempotente
  if ph.author_id is distinct from auth.uid() or ph.upload_status = 'pronta' then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform public.enqueue_purge(ph.storage_path); -- o objeto, se já subiu, entra na fila de limpeza
  delete from public.photos where id = p_id;
end $$;
revoke execute on function public.discard_photo(uuid) from public, anon;
grant execute on function public.discard_photo(uuid) to authenticated;
