// Relógio injetável do Memo Brasil.
//
// Em produção o servidor só lê o relógio real: `TEST_NOW` e as funções de
// avanço são ignoradas a menos que `NODE_ENV === 'test'`. Isso é de propósito:
// a revelação é decidida pelo "agora" do servidor, então nenhuma variável de
// ambiente pode adiantar ou atrasar um álbum fora dos testes.
const LOADED_AT = Date.now();
const emTeste = () => process.env.NODE_ENV === 'test';

// Instante-base opcional vindo de TEST_NOW. Sem ele, o relógio segue o real.
let base = null;
let avancado = 0;

function baseMs() {
  if (!emTeste()) return null;
  if (base !== null) return base;
  const t = Date.parse(process.env.TEST_NOW || '');
  return Number.isFinite(t) ? t : null;
}

// Milissegundos desde a época. Em produção, sempre `Date.now()`.
function nowMs() {
  if (!emTeste()) return Date.now();
  const b = baseMs();
  return (b === null ? Date.now() : b + (Date.now() - LOADED_AT)) + avancado;
}

const now = () => new Date(nowMs());
const iso = () => now().toISOString();

// ───── Só para testes ────────────────────────────────────────────────────────
const usoTeste = () => {
  if (!emTeste()) throw new Error('O relógio só pode ser injetado com NODE_ENV=test.');
};

// Fixa o "agora" em um instante (ISO, Date ou ms). `null` volta ao natural.
function setNow(instante) {
  usoTeste();
  if (instante === null || instante === undefined) { base = null; avancado = 0; return now(); }
  const t = instante instanceof Date ? instante.getTime() : typeof instante === 'number' ? instante : Date.parse(instante);
  if (!Number.isFinite(t)) throw new Error('Instante inválido para setNow().');
  base = t; avancado = 0;
  return now();
}

// Avança o relógio em `ms` (pode ser negativo para voltar).
function advance(ms) {
  usoTeste();
  const n = Number(ms);
  if (!Number.isFinite(n)) throw new Error('Avanço inválido para advance().');
  avancado += n;
  return now();
}

// Volta ao relógio natural (desfaz setNow/advance e reaplica TEST_NOW, se houver).
function reset() {
  usoTeste();
  base = null; avancado = 0;
  return now();
}

module.exports = { now, nowMs, iso, setNow, advance, reset, emTeste };
