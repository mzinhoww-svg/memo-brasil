/**
 * Prévia ao vivo do Filme 35mm em WebGL com a MESMA LUT da foto (film-lut.ts).
 * Textura 3D emulada em 2D: tira 1089×33 (x = azul*33 + vermelho, y = verde); o shader faz o trilinear
 * (duas leituras bilineares nas fatias de azul vizinhas e mistura). Sem WebGL, `startFilmPreview` devolve null.
 */
import { LUT_SIZE, getFilmLut, lutToStrip } from "./film-lut";

const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `precision mediump float;
varying vec2 uv; uniform sampler2D vid; uniform sampler2D lut; uniform float flipX;
const float N = ${LUT_SIZE}.;
vec3 tap(float slice, vec2 rg) {
  // centro dos texels: o bilinear nunca atravessa para a fatia vizinha
  float x = (slice * N + rg.x * (N - 1.) + .5) / (N * N);
  float y = (rg.y * (N - 1.) + .5) / N;
  return texture2D(lut, vec2(x, y)).rgb;
}
void main() {
  vec2 c = vec2(mix(uv.x, 1. - uv.x, flipX), 1. - uv.y);
  vec3 s = clamp(texture2D(vid, c).rgb, 0., 1.);
  float b = s.b * (N - 1.);
  float b0 = floor(b), b1 = min(b0 + 1., N - 1.);
  gl_FragColor = vec4(mix(tap(b0, s.rg), tap(b1, s.rg), b - b0), 1.);
}`;

export interface FilmPreview { stop(): void }

/** Largura máxima do canvas de prévia (px): a LUT é por pixel, então reduzir poupa a GPU de celulares fracos. */
export const PREVIEW_MAX_SIDE = 720;
/** Intervalo mínimo entre quadros (ms): ~30 fps. */
const FRAME_MS = 33;

export function webglAvailable(): boolean {
  try { return !!document.createElement("canvas").getContext("webgl"); } catch { return false; }
}

/**
 * Desenha `video` em `canvas` com a LUT. `mirror` espelha (câmera frontal). Devolve null quando não há WebGL ou algo falha:
 * o chamador então mantém o filtro CSS.
 */
export function startFilmPreview(video: HTMLVideoElement, canvas: HTMLCanvasElement, mirror: () => boolean): FilmPreview | null {
  let gl: WebGLRenderingContext | null = null;
  try { gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power", preserveDrawingBuffer: false }); } catch { gl = null; }
  if (!gl) return null;
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = (unit: number) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const vidTex = tex(0);
  const lutTex = tex(1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, LUT_SIZE * LUT_SIZE, LUT_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutToStrip(getFilmLut()));
  gl.uniform1i(gl.getUniformLocation(prog, "vid"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "lut"), 1);
  const flipLoc = gl.getUniformLocation(prog, "flipX");

  let raf = 0, last = 0, stopped = false;
  const frame = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (now - last < FRAME_MS || video.readyState < 2 || !video.videoWidth) return;
    last = now;
    const k = Math.min(1, PREVIEW_MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * k), h = Math.round(video.videoHeight * k);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, vidTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.uniform1f(flipLoc, mirror() ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  raf = requestAnimationFrame(frame);
  const onLost = (e: Event) => { e.preventDefault(); stop(); };
  canvas.addEventListener("webglcontextlost", onLost);
  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    canvas.removeEventListener("webglcontextlost", onLost);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return { stop };
}
