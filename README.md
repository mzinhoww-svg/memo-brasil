# Memo Brasil (MVP web)

Álbum de casamento colaborativo: o organizador cria o evento em nome dos noivos, imprime o QR Code,
os convidados entram, fotografam pela câmera do navegador e as fotos ficam bloqueadas até a hora da revelação.

## Rodar
    npm install
    npm start        # http://localhost:3000 (e o endereço da rede Wi-Fi aparece no terminal)

Variáveis: `PORT`, `DATA_DIR` (padrão `./data`), `PUBLIC_URL` (domínio público usado no QR Code).

## Fluxo
1. `/` — organizador cria o evento → `/painel/:id` (QR Code, link, convidados, horário da revelação).
2. `/e/:id` — convidado escaneia o QR, vê o convite e informa o nome.
3. `/e/:id/camera` — câmera descartável (limite de fotos por convidado).
4. `/e/:id/album` — fotos bloqueadas ("Revela em Xh") até `revealAt`; depois, grade com autor e retrospectiva.

## Notas
- O bloqueio é no servidor: o arquivo da foto devolve 403 antes da revelação.
- Câmera ao vivo em celular exige HTTPS (ou localhost). Em HTTP na rede local, o botão cai para a câmera nativa do celular.
- Armazenamento em disco (JSON + arquivos) serve ao MVP; para produção/lojas, migrar para banco + armazenamento de objetos.
