# Matriz de ambientes e variáveis

| Variável | Onde | Local (Docker) | Preview Vercel | Produção Vercel | Observação |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | `http://127.0.0.1:55421` | `https://asyaegeodyttttaubvxh.supabase.co` | idem | pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente + servidor | chave publishable local (`supabase status`) | publishable do projeto (painel → API Keys) | idem | pública, protegida por RLS. `…_ANON_KEY` só por compatibilidade |
| `SUPABASE_SERVICE_ROLE_KEY` | **somente servidor / testes locais** | chave local | **não definir** (nada no app usa) | **não definir** | nunca em `NEXT_PUBLIC_*`, nunca em commit ou log |
| `NEXT_PUBLIC_MM_BACKEND` | cliente | `supabase` | `supabase` | `supabase` | `local` mantém IndexedDB (demo) |
| Google OAuth Client ID/Secret | **painel Supabase Auth** (não no app) | desligado (teste por e-mail/senha local) | projeto Google do MemoriesMT | idem | **bloqueio externo**: credenciais não existem nesta sessão |

Regras: o app só lê as duas variáveis públicas; segredos administrativos ficam no cofre do provedor. As chaves do Supabase local são as de demonstração e não são segredos, mas também não são commitadas.
Vercel (projeto `newmemocuiaba`, `prj_IpHyqsnnbrXS213AGrOmxizb0Kjl`): **sem variáveis hoje**; definir as três públicas acima em Preview e Production antes do release (decisão pendente de autorização).
