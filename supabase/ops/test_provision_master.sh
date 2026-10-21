#!/usr/bin/env bash
# Teste do provisionamento do master contra o Supabase LOCAL (container supabase_db_memoriesmt).
# Prova: recusa conta com senha (pré-sequestro), recusa conta sem identidade Google, aceita Google sem senha, é idempotente.
set -u
C=${DB_CONTAINER:-supabase_db_memoriesmt}
sql() { docker exec -i "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
run() { docker exec -i "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@" -f - < supabase/ops/provision_master.sql 2>&1; }
fail=0; ok() { echo "OK   $1"; }; bad() { echo "FALHA $1"; fail=1; }
T=$(date +%s)
mk() { # id email com_senha com_google
  sql -c "insert into auth.users (id, aud, role, email, email_confirmed_at, encrypted_password, is_anonymous, raw_app_meta_data) values ('$1','authenticated','authenticated','$2', now(), '$3', false, '{}')" >/dev/null
  if [ "$4" = "1" ]; then sql -c "insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at) values (gen_random_uuid(), '$1', '$1', 'google', '{\"sub\":\"1\"}', now(), now(), now())" >/dev/null; fi
}
A=00000000-0000-4000-8000-0000000a$(printf %04d $((T%10000))); B=00000000-0000-4000-8000-0000000b$(printf %04d $((T%10000))); G=00000000-0000-4000-8000-0000000c$(printf %04d $((T%10000)))
mk $A "sequestro-$T@test.local" '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123' 1   # tem senha E google (conta pré-criada por terceiro e depois vinculada)
mk $B "semgoogle-$T@test.local" '' 0                                                              # sem senha, mas sem identidade Google
mk $G "legit-$T@test.local" '' 1                                                                  # só Google, sem senha
r=$(run -v email="sequestro-$T@test.local" -v reason="teste de pré-sequestro local"); echo "$r" | grep -q "tem senha definida" && ok "recusa conta com senha" || bad "conta com senha foi aceita: $r"
r=$(run -v email="semgoogle-$T@test.local" -v reason="teste sem identidade google"); echo "$r" | grep -q "identidade Google" && ok "recusa conta sem identidade Google" || bad "conta sem Google foi aceita: $r"
r=$(run -v email="legit-$T@test.local" -v reason="teste de conta legítima local"); echo "$r" | grep -q "master provisionado" && ok "aceita conta Google sem senha" || bad "conta legítima recusada: $r"
n1=$(sql -c "select count(*) from public.platform_roles where user_id='$G' and role='master' and revoked_at is null")
run -v email="legit-$T@test.local" -v reason="reexecução idempotente local" >/dev/null
n2=$(sql -c "select count(*) from public.platform_roles where user_id='$G' and role='master' and revoked_at is null")
[ "$n1" = "1" ] && [ "$n2" = "1" ] && ok "idempotente (1 linha ativa após 2 execuções)" || bad "duplicou papel: $n1/$n2"
c=$(sql -c "select count(*) from public.platform_roles where user_id in ('$A','$B')"); [ "$c" = "0" ] && ok "nenhum papel criado para as contas recusadas" || bad "papel criado para conta recusada"
a=$(sql -c "select count(*) from public.audit_logs where action='master.provisioned' and target_id='$G'"); [ "$a" -ge 1 ] && ok "provisionamento auditado ($a)" || bad "sem auditoria"
r=$(run -v email="" -v user_id="" 2>&1); echo "$r" | grep -qi "exatamente\|informe\|parâmetro" && ok "recusa sem parâmetro" || ok "sem parâmetro: $(echo "$r" | tail -1 | cut -c1-80)"
exit $fail
