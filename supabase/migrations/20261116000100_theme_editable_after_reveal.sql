-- Aparência editável depois da revelação (decisão do dono): tema (cores, fonte, mensagem, QR), logo e capa deixam de travar.
-- A função continua existindo (políticas, RPCs de ativos e funções de Storage a chamam) e passa a responder sempre "não bloqueado".
-- A configuração da REVELAÇÃO em si segue travada por events_guard (não se esconde de novo o que já foi visto).
create or replace function public.event_theme_locked(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select false
$$;
