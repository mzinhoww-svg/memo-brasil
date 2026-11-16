# Imagem de produção do Lume (Memo Brasil): Node 24, usuário não-root, dados em /data.
# Build: docker build -t memo-brasil:local .
# Rodar em macOS/CI dá para testar; em produção o Caddy termina o HTTPS na frente.

# ── Etapa 1: dependências de produção (só o necessário para rodar) ──
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ── Etapa 2: imagem final, enxuta e sem privilégios ──
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3210 \
    DATA_DIR=/data \
    GNUPGHOME=/data/.gnupg
WORKDIR /app

# Código e dependências (nada de devDeps, nada de fonte).
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts

# Usuário sem privilégios. Só /data é gravável (o código em /app fica root:root).
# uid/gid fixos (10001) para casar permissões de volume em qualquer host.
# -h /data: o adduser chowna o home para o usuário; /app NUNCA deve ser o home
# (senão o código fica gravável pela própria app).
# bash + sqlite3 + gnupg: os scripts (backup/restore) rodam dentro do container.
RUN apk add --no-cache bash sqlite gnupg \
 && mkdir -p /data \
 && addgroup -S -g 10001 lume \
 && adduser -S -u 10001 -G lume -h /data lume \
 && chown -R lume:lume /data

USER 10001:10001

# Os dados (db.json, fotos, tokens, chaves VAPID) vivem no volume /data.
VOLUME ["/data"]

EXPOSE 3210

# Healthcheck sem curl/wget: usa o próprio Node (/healthz do #12).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3210)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
