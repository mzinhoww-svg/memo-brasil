-- Revela 2.0 · "Permitir baixar em alta" (passo 7 do assistente e tela 17). ADITIVA.
-- events.guest_download_high: se os convidados podem baixar o original das fotos DE OUTRAS pessoas. O anfitrião e o autor sempre podem.
-- O cliente grava o campo pelo mesmo INSERT/UPDATE de events (RLS: só o anfitrião altera). Eventos existentes ficam como estavam: permitido.
-- Servidor: photo_download_allowed é o ponto de decisão que o app consulta antes de entregar o arquivo. As fotos têm um único objeto no
-- Storage (não há miniatura separada), usado também para exibir; por isso a política de leitura do Storage não muda (negar o objeto
-- quebraria o feed). Separar exibição de download no Storage exige gerar miniaturas (pendência registrada).
alter table public.events add column if not exists guest_download_high boolean not null default true;

create function public.photo_download_allowed(p_photo uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare ph public.photos; allowed boolean;
begin
  if auth.uid() is null or not public.can_see_photo(p_photo) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into ph from public.photos where id = p_photo;
  select (e.host_id = auth.uid() or ph.author_id = auth.uid() or e.guest_download_high) into allowed from public.events e where e.id = ph.event_id;
  return coalesce(allowed, false);
end $$;
revoke all on function public.photo_download_allowed(uuid) from public, anon;
grant execute on function public.photo_download_allowed(uuid) to authenticated;
