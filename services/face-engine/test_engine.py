"""Testes do motor (rodar: python test_engine.py IMG_DIR). IMG_DIR precisa de lena.jpg, messi5.jpg e selfie.jpg (amostras públicas do
OpenCV; não são versionadas aqui). Valida: detecção, escolha da referência, identidade (mesma pessoa em outra escala/corte/iluminação
fica acima do limiar; pessoa diferente fica abaixo), foto em grupo, imagem inválida, bloqueio de host/redirecionamento e o contrato HTTP."""
from __future__ import annotations

import json
import os
import sys
import threading
import urllib.request
from http.server import ThreadingHTTPServer

import cv2
import numpy as np

import main as fe


def enc(img: np.ndarray) -> bytes:
    return cv2.imencode(".jpg", img)[1].tobytes()


def run(img_dir: str) -> None:
    eng = fe.Engine()
    lena = cv2.imread(os.path.join(img_dir, "lena.jpg"))
    messi = cv2.imread(os.path.join(img_dir, "messi5.jpg"))
    selfie = cv2.imread(os.path.join(img_dir, "selfie.jpg"))
    assert lena is not None and messi is not None and selfie is not None

    # detecção
    lf = eng.faces(lena)
    assert len(lf) == 1, f"lena: esperado 1 rosto, veio {len(lf)}"
    many = eng.faces(fe.decode(enc(selfie)))
    assert len(many) >= 5, f"selfie em grupo: esperado vários rostos, veio {len(many)}"
    print(f"ok detecção: lena=1, selfie={len(many)}")

    # referência
    assert fe.pick_reference(lf)[0] == "ok"
    assert fe.pick_reference([])[0] == "no_face"
    assert fe.pick_reference(many)[0] in ("multiple_faces", "ok")
    print("ok escolha da referência")

    # identidade: a mesma pessoa transformada fica acima do limiar; outra pessoa fica abaixo
    ref = eng.embed(lena, lf[0])
    variants = {
        "menor": cv2.resize(lena, None, fx=0.6, fy=0.6),
        "escura": cv2.convertScaleAbs(lena, alpha=0.6, beta=-20),
        "espelho": cv2.flip(lena, 1),
        "jpeg ruim": cv2.imdecode(cv2.imencode(".jpg", lena, [cv2.IMWRITE_JPEG_QUALITY, 25])[1], cv2.IMREAD_COLOR),
        "na moldura": cv2.copyMakeBorder(lena, 200, 300, 400, 100, cv2.BORDER_CONSTANT, value=(40, 40, 40)),
    }
    for name, img in variants.items():
        faces = eng.faces(img)
        assert faces, f"{name}: rosto não detectado"
        s = max(eng.similarity(ref, eng.embed(img, f)) for f in faces)
        assert fe.band_for(s) is not None, f"{name}: mesma pessoa ficou abaixo do limiar ({s:.3f})"
        print(f"ok mesma pessoa ({name}): {s:.3f} -> {fe.band_for(s)}")
    # "outra pessoa": recorte ampliado do maior rosto da foto em grupo (vira uma foto individual)
    g = fe.decode(enc(selfie))
    x, y, w, h = [int(v) for v in sorted(many, key=lambda f: f[2] * f[3], reverse=True)[0][:4]]
    other = cv2.resize(g[max(0, y - h):y + 2 * h, max(0, x - w):x + 2 * w], None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    mf = eng.faces(other)
    assert mf, "outra pessoa: rosto não detectado"
    s_other = max(eng.similarity(ref, eng.embed(other, f)) for f in mf)
    assert fe.band_for(s_other) is None, f"pessoa diferente passou do limiar ({s_other:.3f})"
    s_group = max(eng.similarity(ref, eng.embed(fe.decode(enc(selfie)), f)) for f in many)
    assert fe.band_for(s_group) is None, f"ninguém do grupo é a referência, mas passou ({s_group:.3f})"
    print(f"ok pessoa diferente: recorte={s_other:.3f}, melhor do grupo={s_group:.3f}")

    # busca fim a fim com fetch simulado
    store = {"https://h/ref": enc(lena), "https://h/a": enc(variants["na moldura"]), "https://h/b": enc(other), "https://h/c": b"nao e imagem",
             "https://h/g": enc(selfie)}
    out = fe.search(eng, store.get, "https://h/ref", [{"id": k[-1], "url": k} for k in ["https://h/a", "https://h/b", "https://h/c", "https://h/g"]])
    assert out["reference"] == "ok" and out["processed"] == 4 and [r["id"] for r in out["results"]] == ["a"], out
    assert set(out["results"][0]) == {"id", "band"}, "resposta não pode levar score nem embedding"
    assert fe.search(eng, store.get, "https://h/c", [])["reference"] == "invalid_image"
    assert fe.search(eng, store.get, "https://h/b", [])["reference"] in ("ok", "multiple_faces")  # recorte da multidão traz vizinhos
    assert messi is not None
    blank = np.full((400, 400, 3), 128, np.uint8)
    store["https://h/vazia"] = enc(blank)
    assert fe.search(eng, store.get, "https://h/vazia", [])["reference"] == "no_face"
    print("ok busca fim a fim")

    # fetcher: só HTTPS no host permitido
    f = fe.Fetcher("abc.supabase.co")
    assert f.allowed("https://abc.supabase.co/storage/v1/object/sign/x?token=1")
    for bad in ["http://abc.supabase.co/x", "https://evil.com/x", "https://abc.supabase.co.evil.com/x", "https://u:p@abc.supabase.co/x",
                "https://abc.supabase.co:8443/x", "file:///etc/passwd", "https://169.254.169.254/latest"]:
        assert not f.allowed(bad), bad
    assert f.get("https://evil.com/x") is None
    print("ok fetcher (SSRF)")

    # contrato HTTP
    token = "t" * 40
    srv = ThreadingHTTPServer(("127.0.0.1", 0), fe.make_handler(eng, token, fe.Fetcher("abc.supabase.co")))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"

    def post(body: dict, auth: str | None) -> tuple[int, dict]:
        req = urllib.request.Request(base + "/v1/search", data=json.dumps(body).encode(), method="POST",
                                     headers={"Content-Type": "application/json", **({"Authorization": auth} if auth else {})})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    with urllib.request.urlopen(base + "/health") as r:
        assert json.loads(r.read())["ok"] is True
    assert post({"reference_url": "x", "photos": []}, None)[0] == 403
    assert post({"reference_url": "x", "photos": []}, "Bearer errado")[0] == 403
    st, body = post({"reference_url": "https://evil.com/ref", "photos": []}, f"Bearer {token}")
    assert st == 200 and body["reference"] == "invalid_image", body  # host proibido = nada baixado
    assert post({"reference_url": "x", "photos": [{}] * 61}, f"Bearer {token}")[0] == 400
    srv.shutdown()
    print("ok contrato HTTP")
    # modo pull: claim -> processa -> complete; referência ruim -> fail; fila vazia -> idle
    calls = []
    def fake_post(url, tok, body):
        calls.append((url.rsplit("/", 1)[-1], body))
        if url.endswith("/claim"):
            return {"job": queue.pop(0) if queue else None}
        return {"matches": len(body.get("matches", []))}
    pf = fe.Fetcher("h")
    pf.get = store.get  # type: ignore[assignment]
    queue = [{"jobId": "j1", "referenceUrl": "https://h/ref", "photos": [{"id": "a", "url": "https://h/a"}, {"id": "b", "url": "https://h/b"}]},
             {"jobId": "j2", "referenceUrl": "https://h/vazia", "photos": []}]
    assert fe.pull_once(eng, pf, "https://h/fn", "t", fake_post) == "done"
    assert calls[-1] == ("complete", {"jobId": "j1", "matches": [{"photoId": "a", "band": "probable"}], "processed": 2}), calls[-1]
    assert fe.pull_once(eng, pf, "https://h/fn", "t", fake_post) == "failed"
    assert calls[-1] == ("fail", {"jobId": "j2", "error": "no_face", "referenceInvalid": True}), calls[-1]
    assert fe.pull_once(eng, pf, "https://h/fn", "t", fake_post) == "idle"
    print("ok modo pull")
    print("TODOS OS TESTES PASSARAM")


if __name__ == "__main__":
    run(sys.argv[1])
