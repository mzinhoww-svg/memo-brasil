#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR || process.argv[2] || path.join(process.cwd(), 'data');
const jsonPath = process.env.JSON_FILE || path.join(dataDir, 'db.json');
const storeFactory = require(path.join(__dirname, '..', 'src', 'store'));

function countsFromJson(raw) {
  const src = raw && raw.events ? raw.events : raw;
  const events = Object.values(src || {});
  const sum = (fn) => events.reduce((t, e) => t + (fn(e) || 0), 0);
  return {
    events: events.length,
    guests: sum((e) => (e.guests || []).length),
    photos: sum((e) => (e.photos || []).length),
    lista: sum((e) => (e.lista || []).length),
    recados: sum((e) => (e.recados || []).length),
    equipe: sum((e) => (e.equipe || []).length),
    push: sum((e) => (e.push || []).length),
    avisos: sum((e) => (e.avisos || []).length),
  };
}

if (!fs.existsSync(jsonPath)) {
  console.error('Arquivo JSON não encontrado:', jsonPath);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const before = countsFromJson(raw);

const store = storeFactory(dataDir);
if (store.counts().events === 0) {
  try {
    store.importFromJson(jsonPath);
  } catch (e) {
    console.error('Migração abortada:', e.message);
    process.exit(1);
  }
}

const after = store.counts();
let ok = true;
for (const k of Object.keys(before)) {
  if (before[k] !== after[k]) { ok = false; console.error(`divergência em ${k}: json=${before[k]} sqlite=${after[k]}`); }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.renameSync(jsonPath, `${jsonPath}.migrated-${stamp}`);

console.log('Migração concluída:', jsonPath, '->', path.join(dataDir, 'memo.db'));
console.log('Contagens:', after);
if (!ok) process.exit(1);
console.log('Verificação: OK');