// FaceEngine: contrato versionado do motor de correspondência facial do Smart Album. Módulo puro (sem APIs de Deno/Node).
//
// O produto (RPCs, worker, UI) depende só desta interface; trocar de motor/fornecedor não muda o resto. Regras do contrato:
//   * `analyzeReference` recebe os bytes da referência do titular e devolve um handle OPACO, que vive só na memória do worker durante o job
//     (estratégia A, on-demand: nenhum template/embedding é persistido em banco, storage, log ou métrica). `dispose` descarta o handle.
//   * `compare` devolve no máximo uma faixa ('probable' | 'review') ou null. Nunca score bruto, coordenada, atributo ou identidade de terceiro.
//   * Rostos de terceiros detectados numa foto não podem ser guardados nem devolvidos: só "esta foto tem/não tem um candidato do titular".
//   * O limiar que separa 'probable'/'review'/null é do motor e versionado em `version`; só é definido depois do benchmark (doc 04).
//
// NENHUM motor real está ligado nesta entrega. `DisabledFaceEngine` é o padrão e recusa tudo; `FakeFaceEngine` existe só para testes
// automatizados com bytes sintéticos (não analisa rostos: lê um marcador de teste embutido nos bytes).

export type ConfidenceBand = "probable" | "review";
export type ReferenceError = "no_face" | "multiple_faces" | "low_quality" | "invalid_image";
export interface ReferenceHandle { readonly __opaque: unique symbol }
export type ReferenceResult = { ok: true; handle: ReferenceHandle } | { ok: false; error: ReferenceError };

export interface FaceEngine {
  /** Identificador do motor + modelo + limiar (ex.: "vendor-x.model-y.t1"), gravado no job. `^[a-z0-9._-]{1,40}$`. */
  readonly version: string;
  analyzeReference(image: Uint8Array): Promise<ReferenceResult>;
  compare(reference: ReferenceHandle, photo: Uint8Array): Promise<ConfidenceBand | null>;
  dispose(reference: ReferenceHandle): void;
}

export class FaceEngineDisabledError extends Error {
  constructor() {
    super("face_engine_disabled");
    this.name = "FaceEngineDisabledError";
  }
}

/** Padrão: nenhum motor aprovado (licença, DPA, benchmark e gate jurídico pendentes). */
export class DisabledFaceEngine implements FaceEngine {
  readonly version = "disabled";
  analyzeReference(): Promise<ReferenceResult> { return Promise.reject(new FaceEngineDisabledError()); }
  compare(): Promise<ConfidenceBand | null> { return Promise.reject(new FaceEngineDisabledError()); }
  dispose(): void { /* nada a descartar */ }
}

/**
 * Motor de TESTE. Não processa rosto nenhum: procura nos bytes o marcador ASCII `FAKEFACE:<rótulo>;` (imagens sintéticas geradas pelos
 * testes). Referência sem marcador = `no_face`; com dois marcadores = `multiple_faces`. Foto com o mesmo rótulo = 'probable'; com
 * `<rótulo>~` = 'review'. Recusa rodar fora de teste (`allow` precisa ser true) para nunca ir ao ar por engano.
 */
export class FakeFaceEngine implements FaceEngine {
  readonly version = "fake-engine-0";
  private readonly live = new Map<object, string>();
  constructor(opts: { allow: boolean }) {
    if (!opts.allow) throw new FaceEngineDisabledError();
  }
  private labels(b: Uint8Array): string[] {
    const s = new TextDecoder("latin1").decode(b);
    return [...s.matchAll(/FAKEFACE:([a-z0-9~]{1,20});/g)].map((m) => m[1]);
  }
  analyzeReference(image: Uint8Array): Promise<ReferenceResult> {
    const l = this.labels(image);
    if (l.length === 0) return Promise.resolve({ ok: false, error: "no_face" });
    if (l.length > 1) return Promise.resolve({ ok: false, error: "multiple_faces" });
    const key = {};
    this.live.set(key, l[0]);
    return Promise.resolve({ ok: true, handle: key as unknown as ReferenceHandle });
  }
  compare(reference: ReferenceHandle, photo: Uint8Array): Promise<ConfidenceBand | null> {
    const ref = this.live.get(reference as unknown as object);
    if (ref === undefined) return Promise.reject(new Error("disposed"));
    const l = this.labels(photo);
    if (l.includes(ref)) return Promise.resolve("probable");
    if (l.includes(`${ref}~`)) return Promise.resolve("review");
    return Promise.resolve(null);
  }
  dispose(reference: ReferenceHandle): void { this.live.delete(reference as unknown as object); }
  /** Só para teste: quantos handles ainda estão na memória (prova do descarte). */
  get liveHandles(): number { return this.live.size; }
}
