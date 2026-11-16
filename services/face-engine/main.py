"""Motor de correspondência facial do Revela Smart Album (servidor próprio, hospedado na Vertra).

Modelos abertos do OpenCV Zoo, com licença comercial:
  * YuNet 2023mar (detecção + 5 pontos)  — MIT        — opencv_zoo/models/face_detection_yunet
  * SFace 2021dec (reconhecimento, 128-d) — Apache 2.0 — opencv_zoo/models/face_recognition_sface
Os pesos são baixados na primeira subida e conferidos por SHA-256 (o código não aceita outro arquivo).

Modo padrão "pull" (ENGINE_MODE=pull): sem endereço público; a cada PULL_INTERVAL s pergunta à Edge Function `smart-album-engine` (no
mesmo host do Storage) se há busca na fila, processa e devolve só {photoId, band}. Modo "http" (ENGINE_MODE=http): servidor abaixo.
Contrato HTTP (só JSON, autenticado por Bearer):
  POST /v1/search {"reference_url": str, "photos": [{"id": str, "url": str}, ...]}
    -> {"reference": "ok" | "no_face" | "multiple_faces" | "low_quality" | "invalid_image",
        "results": [{"id": str, "band": "probable" | "review"}], "processed": int}
  GET /health -> {"ok": true, "engine": ENGINE_VERSION}

Privacidade: nada é gravado em disco além dos pesos; imagens, embeddings e scores vivem só na memória da requisição e nunca são
devolvidos nem logados (o log tem só contagens). Rostos de terceiros detectados numa foto são comparados e descartados.
Só baixa imagens de HTTPS no host permitido (ALLOWED_FETCH_HOST = o Storage do Supabase), sem redirecionamento, com teto de bytes.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import cv2
import numpy as np

ENGINE_VERSION = "opencv-yunet-sface.t1"
# Limiar de cosseno do SFace: 0.363 é o valor publicado pelo OpenCV para "mesma pessoa". "probable" exige folga acima dele.
# NÃO calibrado com dados do produto (ver docs/smart-album/04-model-evaluation.md).
REVIEW_THRESHOLD = float(os.environ.get("REVIEW_THRESHOLD", "0.363"))
PROBABLE_THRESHOLD = float(os.environ.get("PROBABLE_THRESHOLD", "0.45"))
DETECT_SCORE = 0.85
MIN_FACE_PX = 36
MAX_BYTES = 12 * 1024 * 1024
MAX_SIDE = 1600
MAX_PHOTOS_PER_CALL = 60
FETCH_TIMEOUT = 15

BASE = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models"
MODELS = {
    "yunet": (f"{BASE}/face_detection_yunet/face_detection_yunet_2023mar.onnx",
              "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"),
    "sface": (f"{BASE}/face_recognition_sface/face_recognition_sface_2021dec.onnx",
              "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79"),
}
MODEL_DIR = os.environ.get("MODEL_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "models"))


def log(msg: str) -> None:
    print(f"[face-engine] {msg}", file=sys.stderr, flush=True)


def ensure_model(name: str) -> str:
    url, sha = MODELS[name]
    os.makedirs(MODEL_DIR, exist_ok=True)
    path = os.path.join(MODEL_DIR, os.path.basename(url))
    if os.path.exists(path) and hashlib.sha256(open(path, "rb").read()).hexdigest() == sha:
        return path
    log(f"baixando {name}")
    with urllib.request.urlopen(url, timeout=120) as r:
        data = r.read()
    if hashlib.sha256(data).hexdigest() != sha:
        raise RuntimeError(f"hash inesperado para {name}")
    with open(path + ".tmp", "wb") as f:
        f.write(data)
    os.replace(path + ".tmp", path)
    return path


class Engine:
    """YuNet + SFace. Os objetos do OpenCV não são thread-safe: um lock serializa a inferência (concorrência = 1 por instância)."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.detector = cv2.FaceDetectorYN.create(ensure_model("yunet"), "", (320, 320), DETECT_SCORE, 0.3, 5000)
        self.recognizer = cv2.FaceRecognizerSF.create(ensure_model("sface"), "")

    def faces(self, img: np.ndarray) -> list[np.ndarray]:
        h, w = img.shape[:2]
        self.detector.setInputSize((w, h))
        _, found = self.detector.detect(img)
        if found is None:
            return []
        return [f for f in found if min(f[2], f[3]) >= MIN_FACE_PX]

    def embed(self, img: np.ndarray, face: np.ndarray) -> np.ndarray:
        aligned = self.recognizer.alignCrop(img, face)
        return self.recognizer.feature(aligned)

    def similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        return float(self.recognizer.match(a, b, cv2.FaceRecognizerSF_FR_COSINE))


def decode(data: bytes) -> np.ndarray | None:
    if not data or len(data) > MAX_BYTES:
        return None
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return None
    h, w = img.shape[:2]
    if h < 16 or w < 16 or h * w > 40_000_000:
        return None
    k = min(1.0, MAX_SIDE / max(h, w))
    if k < 1.0:
        img = cv2.resize(img, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA)
    return img


def pick_reference(faces: list[np.ndarray]) -> tuple[str, np.ndarray | None]:
    if not faces:
        return "no_face", None
    by_area = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    if len(by_area) > 1 and by_area[1][2] * by_area[1][3] > 0.35 * by_area[0][2] * by_area[0][3]:
        return "multiple_faces", None  # outra pessoa de tamanho parecido: não dá para saber quem é o titular
    if min(by_area[0][2], by_area[0][3]) < 64:
        return "low_quality", None
    return "ok", by_area[0]


def band_for(score: float) -> str | None:
    if score >= PROBABLE_THRESHOLD:
        return "probable"
    if score >= REVIEW_THRESHOLD:
        return "review"
    return None


class Fetcher:
    def __init__(self, allowed_host: str) -> None:
        self.allowed_host = allowed_host.lower()

    def allowed(self, url: str) -> bool:
        try:
            u = urlparse(url)
        except ValueError:
            return False
        return u.scheme == "https" and (u.hostname or "").lower() == self.allowed_host and not u.username and not u.password and u.port in (None, 443)

    def get(self, url: str) -> bytes | None:
        if not self.allowed(url):
            return None

        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *a, **k):  # noqa: D401 - nunca segue redirecionamento (SSRF)
                return None

        opener = urllib.request.build_opener(NoRedirect)
        try:
            with opener.open(urllib.request.Request(url, headers={"User-Agent": "revela-face-engine"}), timeout=FETCH_TIMEOUT) as r:
                if r.status != 200:
                    return None
                data = r.read(MAX_BYTES + 1)
                return data if len(data) <= MAX_BYTES else None
        except Exception:
            return None


def search(engine: Engine, fetch, reference_url: str, photos: list[dict]) -> dict:
    ref_img = decode(fetch(reference_url) or b"")
    if ref_img is None:
        return {"reference": "invalid_image", "results": [], "processed": 0}
    with engine.lock:
        status, ref_face = pick_reference(engine.faces(ref_img))
        if status != "ok":
            return {"reference": status, "results": [], "processed": 0}
        ref = engine.embed(ref_img, ref_face)
    del ref_img
    results, processed = [], 0
    for p in photos[:MAX_PHOTOS_PER_CALL]:
        pid, url = str(p.get("id", "")), str(p.get("url", ""))
        img = decode(fetch(url) or b"")
        processed += 1
        if img is None:
            continue
        best = -1.0
        with engine.lock:
            for face in engine.faces(img):
                best = max(best, engine.similarity(ref, engine.embed(img, face)))
        del img
        b = band_for(best)
        if b:
            results.append({"id": pid, "band": b})
    return {"reference": "ok", "results": results, "processed": processed}


def run_job(engine: Engine, fetch, reference_url: str, photos: list[dict]) -> dict:
    """Job inteiro (modo pull): referência calculada uma vez, todas as fotos em sequência."""
    ref_img = decode(fetch(reference_url) or b"")
    if ref_img is None:
        return {"reference": "invalid_image", "results": [], "processed": 0}
    with engine.lock:
        status, ref_face = pick_reference(engine.faces(ref_img))
        if status != "ok":
            return {"reference": status, "results": [], "processed": 0}
        ref = engine.embed(ref_img, ref_face)
    del ref_img
    results, processed = [], 0
    for p in photos:
        img = decode(fetch(str(p.get("url", ""))) or b"")
        processed += 1
        if img is None:
            continue
        best = -1.0
        with engine.lock:
            for face in engine.faces(img):
                best = max(best, engine.similarity(ref, engine.embed(img, face)))
        del img
        b = band_for(best)
        if b:
            results.append({"photoId": str(p.get("id", "")), "band": b})
    return {"reference": "ok", "results": results, "processed": processed}


def post_json(url: str, token: str, body: dict, timeout: int = 60) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "revela-face-engine"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read() or b"{}")


def pull_once(engine: Engine, fetcher: Fetcher, base_url: str, token: str, post=post_json) -> str:
    """Uma rodada: reserva um job, processa e devolve o resultado. Retorna 'idle', 'done' ou 'failed'."""
    job = (post(f"{base_url}/claim", token, {}) or {}).get("job")
    if not job:
        return "idle"
    try:
        out = run_job(engine, fetcher.get, job["referenceUrl"], job.get("photos") or [])
    except Exception as e:  # noqa: BLE001
        log(f"job={job.get('jobId')} erro={type(e).__name__}")
        post(f"{base_url}/fail", token, {"jobId": job["jobId"], "error": "engine_error", "referenceInvalid": False})
        return "failed"
    if out["reference"] != "ok":
        post(f"{base_url}/fail", token, {"jobId": job["jobId"], "error": out["reference"], "referenceInvalid": True})
        log(f"job={job['jobId']} referencia={out['reference']}")
        return "failed"
    r = post(f"{base_url}/complete", token, {"jobId": job["jobId"], "matches": out["results"], "processed": out["processed"]})
    log(f"job={job['jobId']} processadas={out['processed']} resultados={r.get('matches')}")
    return "done"


def make_handler(engine: Engine, token: str, fetcher: Fetcher):
    class Handler(BaseHTTPRequestHandler):
        server_version = "revela-face-engine"

        def log_message(self, *args):  # sem URL/corpo no log (podem ter URLs assinadas)
            return

        def reply(self, status: int, body: dict) -> None:
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == "/health":
                return self.reply(200, {"ok": True, "engine": ENGINE_VERSION})
            return self.reply(404, {"error": "not_found"})

        def do_POST(self):
            if self.path != "/v1/search":
                return self.reply(404, {"error": "not_found"})
            auth = self.headers.get("Authorization", "")
            if not token or not hmac.compare_digest(auth, f"Bearer {token}"):
                return self.reply(403, {"error": "forbidden"})
            try:
                n = int(self.headers.get("Content-Length", "0"))
                if n <= 0 or n > 1_000_000:
                    return self.reply(413, {"error": "too_large"})
                body = json.loads(self.rfile.read(n))
                photos = body.get("photos") or []
                if not isinstance(body.get("reference_url"), str) or not isinstance(photos, list) or len(photos) > MAX_PHOTOS_PER_CALL:
                    return self.reply(400, {"error": "invalid"})
                out = search(engine, fetcher.get, body["reference_url"], photos)
                log(f"busca: referencia={out['reference']} processadas={out['processed']} resultados={len(out['results'])}")
                return self.reply(200, {**out, "engine": ENGINE_VERSION})
            except Exception as e:  # noqa: BLE001
                log(f"erro: {type(e).__name__}")
                return self.reply(500, {"error": "engine_error"})

    return Handler


def main() -> None:
    token = os.environ.get("ENGINE_TOKEN", "")
    host = os.environ.get("ALLOWED_FETCH_HOST", "")
    if len(token) < 32 or not host:
        log("ENGINE_TOKEN (>=32) e ALLOWED_FETCH_HOST são obrigatórios")
        sys.exit(1)
    engine = Engine()
    if os.environ.get("ENGINE_MODE", "pull") == "pull":
        # sem endereço público: pergunta à Edge Function smart-album-engine (mesmo host do Storage) se há busca na fila
        import time
        base = f"https://{host}/functions/v1/smart-album-engine"
        interval = max(5, int(os.environ.get("PULL_INTERVAL", "20")))
        log(f"pronto ({ENGINE_VERSION}), modo pull a cada {interval}s")
        while True:
            try:
                state = pull_once(engine, Fetcher(host), base, token)
            except Exception as e:  # noqa: BLE001 - rede/servidor: tenta de novo na próxima rodada
                log(f"pull erro={type(e).__name__}")
                state = "idle"
            if state == "idle":
                time.sleep(interval)
    port = int(os.environ.get("PORT", "80"))
    log(f"pronto ({ENGINE_VERSION}) na porta {port}")
    ThreadingHTTPServer(("0.0.0.0", port), make_handler(engine, token, Fetcher(host))).serve_forever()


if __name__ == "__main__":
    main()
