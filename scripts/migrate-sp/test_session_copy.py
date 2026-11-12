"""Etapa 6: prova que um refresh token que só existe como LINHA COPIADA no banco
é aceito pelo GoTrue do destino, e que um access token de outro projeto é recusado.

Uso: MIGRATE_DST_REF=<ref> python3 -I scripts/migrate-sp/test_session_copy.py
Só usa um usuário anônimo SINTÉTICO criado por SQL no destino (apagado no fim).
Nenhum token de usuário real é lido ou usado. Tokens só em memória.
"""
import json, os, secrets, string, sys, uuid, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb

dst = sb.target_ref()
uid, sid = str(uuid.uuid4()), str(uuid.uuid4())
tok = "".join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(12))
out = {}
inst = "00000000-0000-0000-0000-000000000000"
sb.query(dst, f"""begin; set local session_replication_role = replica;
insert into auth.users (instance_id, id, aud, role, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('{inst}', '{uid}', 'authenticated', 'authenticated', true, '{{"provider":"anonymous","providers":["anonymous"]}}', '{{}}', now() - interval '2 days', now() - interval '2 days',
  '', '', '', '', '', '', '', '');
insert into auth.sessions (id, user_id, created_at, updated_at, aal) values ('{sid}', '{uid}', now() - interval '2 days', now() - interval '2 days', 'aal1');
insert into auth.refresh_tokens (instance_id, token, user_id, revoked, created_at, updated_at, session_id) values ('{inst}', '{tok}', '{uid}', false, now() - interval '2 days', now() - interval '2 days', '{sid}');
commit;""")
try:
    st, r, _ = sb.project_http(dst, "POST", "/auth/v1/token?grant_type=refresh_token", {"refresh_token": tok}, key=sb.anon_key(dst))
    out["refresh_no_destino_http"] = st
    if st == 200:
        at = r["access_token"]
        hdr = json.loads(base64.urlsafe_b64decode(at.split(".")[0] + "=="))
        pl = json.loads(base64.urlsafe_b64decode(at.split(".")[1] + "=="))
        out["novo_access_token"] = {"alg": hdr.get("alg"), "iss": pl.get("iss"), "sub_igual": pl.get("sub") == uid, "session_id_igual": pl.get("session_id") == sid, "is_anonymous": pl.get("is_anonymous")}
        out["refresh_token_rotacionado"] = r.get("refresh_token") != tok
        # usuário no destino com o token novo
        st2, u, _ = sb.project_http(dst, "GET", "/auth/v1/user", headers={"Authorization": f"Bearer {at}"}, key=sb.anon_key(dst))
        out["user_no_destino_http"] = st2
        # o MESMO access token (assinado pelo destino) apresentado ao projeto de origem: GET de leitura
        st3, u3, _ = sb.project_http(sb.PROD_REF, "GET", "/auth/v1/user", headers={"Authorization": f"Bearer {at}"}, key=sb.anon_key(sb.PROD_REF))
        out["token_de_outro_projeto_http"] = st3
        out["token_de_outro_projeto_erro"] = (u3 or {}).get("error_code") if isinstance(u3, dict) else str(u3)[:100]
        # PostgREST da origem com token alheio
        st4, _, _ = sb.project_http(sb.PROD_REF, "GET", "/rest/v1/plans?select=id&limit=1", headers={"Authorization": f"Bearer {at}"}, key=sb.anon_key(sb.PROD_REF))
        out["rest_origem_com_token_alheio_http"] = st4
        # reuso do token antigo já rotacionado (dentro do intervalo de reuso volta a mesma sessão)
    else:
        out["erro"] = str(r)[:300]
finally:
    sb.purge_test_users(dst, f"id = '{uid}'")
    out["limpeza"] = sb.query(dst, f"select count(*) c from auth.users where id='{uid}'")[0]["c"] == 0
print(json.dumps(out, ensure_ascii=False, indent=1))
