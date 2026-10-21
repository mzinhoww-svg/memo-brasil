#!/usr/bin/env bash
# Teste do provisionamento do master contra o Supabase LOCAL (container supabase_db_memoriesmt).
# Prova: recusa senha, falta de Google, e-mail da identidade diferente, identidades extras, e-mail não confirmado, anônimo, banido, apagado;
# aceita Google único com e-mail verificado (qualquer caixa e por user_id); revoga sessões; é idempotente; audita; limpa o que criou.
set -u
C=${DB_CONTAINER:-supabase_db_memoriesmt}
sql() { docker exec -i "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
run() { docker exec -i "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@" -f - < supabase/ops/provision_master.sql 2>&1; }
fail=0; ok() { echo "OK   $1"; }; bad() { echo "FALHA $1"; fail=1; }
T=$(date +%s)$RANDOM
# mk <email> <senha|-> <identidades: g=google-igual, x=google-email-diferente, e=email, n=nenhuma> [confirmado=1] [anon=false] [banido=0] [apagado=0]
mk() {
  local id; id=$(sql -c "select gen_random_uuid()")
  local pw=""; [ "$2" != "-" ] && pw='$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123'
  local conf="now()"; [ "${4:-1}" = "0" ] && conf="null"
  local ban="null"; [ "${6:-0}" = "1" ] && ban="now() + interval '1 day'"
  local del="null"; [ "${7:-0}" = "1" ] && del="now()"
  sql -c "insert into auth.users (id, aud, role, email, email_confirmed_at, encrypted_password, is_anonymous, raw_app_meta_data, banned_until, deleted_at) values ('$id','authenticated','authenticated','$1', $conf, '$pw', ${5:-false}, '{}', $ban, $del)" >/dev/null
  case "$3" in
    *g*) sql -c "insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at) values (gen_random_uuid(), '$id', '$id', 'google', '{\"sub\":\"1\",\"email\":\"$1\",\"email_verified\":true}', now(), now(), now())" >/dev/null;;
  esac
  case "$3" in
    *x*) sql -c "insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at) values (gen_random_uuid(), '$id', '$id', 'google', '{\"sub\":\"2\",\"email\":\"outro@test.local\",\"email_verified\":true}', now(), now(), now())" >/dev/null;;
  esac
  case "$3" in
    *e*) sql -c "insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at) values (gen_random_uuid(), '$id', '$1', 'email', '{\"sub\":\"3\",\"email\":\"$1\"}', now(), now(), now())" >/dev/null;;
  esac
  echo "$id"
}
expect_refuse() { local r; r=$(run -v email="$2" -v reason="teste local de recusa"); echo "$r" | grep -q "$3" && ok "$1" || bad "$1 (saída: $(echo "$r" | tail -2 | tr '\n' ' ' | cut -c1-160))"; }
roles() { sql -c "select count(*) from public.platform_roles where user_id='$1' and role='master' and revoked_at is null"; }

PW=$(mk "senha-$T@test.local" senha g) ; expect_refuse "recusa conta com senha (mesmo com Google)" "senha-$T@test.local" "tem senha"
NG=$(mk "semgoogle-$T@test.local" - e) ; expect_refuse "recusa conta sem identidade Google" "semgoogle-$T@test.local" "única identidade Google"
XD=$(mk "emaildif-$T@test.local" - x) ; expect_refuse "recusa Google com e-mail diferente do da conta" "emaildif-$T@test.local" "única identidade Google"
ME=$(mk "multi-$T@test.local" - ge)   ; expect_refuse "recusa conta com mais de uma identidade" "multi-$T@test.local" "única identidade Google"
NC=$(mk "naoconf-$T@test.local" - g 0) ; expect_refuse "recusa e-mail não confirmado" "naoconf-$T@test.local" "não confirmado"
AN=$(mk "anon-$T@test.local" - g 1 true) ; expect_refuse "recusa conta anônima" "anon-$T@test.local" "anônima"
BN=$(mk "banido-$T@test.local" - g 1 false 1) ; expect_refuse "recusa conta banida" "banido-$T@test.local" "banida"
DL=$(mk "apagado-$T@test.local" - g 1 false 0 1) ; expect_refuse "recusa conta apagada" "apagado-$T@test.local" "apagada"
for id in $PW $NG $XD $ME $NC $AN $BN $DL; do [ "$(roles $id)" = "0" ] || bad "papel criado para conta recusada $id"; done; ok "nenhum papel criado para as contas recusadas"

LG=$(mk "legit-$T@test.local" - g)
sql -c "insert into auth.sessions (id, user_id) values (gen_random_uuid(), '$LG')" >/dev/null
r=$(run -v email="LEGIT-$T@TEST.LOCAL" -v reason="teste de conta legítima local"); echo "$r" | grep -q "master provisionado" && ok "aceita Google único verificado (e-mail em outra caixa)" || bad "legítima recusada: $r"
[ "$(sql -c "select count(*) from auth.sessions where user_id='$LG'")" = "0" ] && ok "sessões anteriores revogadas" || bad "sessão antiga sobreviveu"
n1=$(roles $LG); run -v email="legit-$T@test.local" -v reason="reexecução idempotente local" >/dev/null; n2=$(roles $LG)
[ "$n1" = "1" ] && [ "$n2" = "1" ] && ok "idempotente (1 linha ativa após 2 execuções)" || bad "duplicou papel: $n1/$n2"
[ "$(sql -c "select raw_app_meta_data->>'role' from auth.users where id='$LG'")" = "master" ] && ok "claim gravada" || bad "sem claim"
a=$(sql -c "select count(*) from public.audit_logs where action='master.provisioned' and target_id='$LG'"); [ "$a" -ge 1 ] && ok "provisionamento auditado ($a)" || bad "sem auditoria"

UL=$(mk "porid-$T@test.local" - g)
r=$(run -v user_id="$UL" -v reason="teste local por user_id"); echo "$r" | grep -q "master provisionado" && ok "aceita pelo caminho user_id" || bad "user_id recusado: $r"
r=$(run -v email="" -v user_id="" 2>&1); echo "$r" | grep -q "exatamente um parâmetro" && ok "recusa sem parâmetro" || bad "sem parâmetro não foi recusado: $(echo "$r" | tail -1)"
r=$(run -v email="a@b.c" -v user_id="$UL" 2>&1); echo "$r" | grep -q "exatamente um parâmetro" && ok "recusa os dois parâmetros" || bad "dois parâmetros aceitos"

# limpeza: remove papéis e usuários de teste criados aqui (e-mails terminam com -$T@test.local)
# platform_roles é histórico por desenho (não apaga; FK restrict): só no banco LOCAL de teste o cleanup desliga (na mesma transação) o event trigger e o guard de DELETE, e religa antes do commit
for id in $(sql -c "select id from auth.users where email like '%-$T@test.local'"); do
  docker exec -i "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt -c "begin; alter event trigger audit_ddl_end disable; alter table public.platform_roles disable trigger platform_roles_guard_del; delete from public.platform_roles where user_id='$id'; alter table public.platform_roles enable always trigger platform_roles_guard_del; alter event trigger audit_ddl_end enable; set local session_replication_role = replica; delete from auth.users where id='$id'; commit;" >/dev/null 2>&1 || echo "AVISO: não removi $id"
done
left=$(sql -c "select count(*) from auth.users where email like '%-$T@test.local'"); [ "$left" = "0" ] && ok "dados de teste removidos" || bad "sobraram $left usuários de teste"
exit $fail
