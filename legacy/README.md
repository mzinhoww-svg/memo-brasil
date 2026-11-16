# legacy/ — servidor antigo (Lume)

Express + SQLite + Caddy/Docker, anterior ao Revela 2.0. **Aposentado**: a produção roda em Vercel (`web/`) + Supabase (`supabase/`).
Fica aqui só como referência e para reativação manual (`cd legacy && npm ci && npm test`); não faz parte do CI.
Nada do que está aqui é publicado. A auditoria de segurança tinha 7 pistas só neste servidor (zip com `..`, PATCH de equipe,
cota anônima, `/buscar`, login CSRF, buffer de 25 MB e SSRF de push); elas deixam de valer ao aposentá-lo. Se for reativado, corrija-as antes.
