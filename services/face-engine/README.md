# Motor facial do Revela (servidor próprio)

YuNet 2023mar (detecção, MIT) + SFace 2021dec (reconhecimento, Apache 2.0), do OpenCV Zoo. Pesos baixados na subida e conferidos por SHA-256.
Hospedado na Vertra (Python 3.13). Chamado só pela Edge Function `smart-album-worker`, com Bearer, recebendo URLs assinadas (5 min) do
Storage do Supabase; devolve só `{id, band}`. Nada é gravado além dos pesos.

Variáveis: `ENGINE_TOKEN` (≥ 32, igual a `SMART_ALBUM_ENGINE_TOKEN` na função), `ALLOWED_FETCH_HOST` (`<ref>.supabase.co`), `PORT`
(injetada). Limiares: cosseno ≥ 0,363 = `review` (valor publicado pelo OpenCV), ≥ 0,45 = `probable` — não calibrados com dados do produto.

Testes: `python test_engine.py <pasta com lena.jpg, messi5.jpg, selfie.jpg>` (amostras públicas do OpenCV, não versionadas).
Resultado em 16/11/2026: mesma pessoa 0,91–0,97 (escala, luz, espelho, JPEG ruim, moldura); pessoas diferentes 0,18–0,24; pico 344 MB.
