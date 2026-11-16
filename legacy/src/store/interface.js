// Interface pública do store. Todo adaptador (SQLite, JSON, Postgres futuro) implementa este contrato.
class Store {
  constructor(dataDir) { this.dataDir = dataDir; }
  get db() { throw new Error('not implemented'); }
  save() { throw new Error('not implemented'); }
  close() {}
  counts() { throw new Error('not implemented'); }
  importFromJson() { throw new Error('not implemented'); }
  // Contrato mínimo para outras frentes (auth, audit):
  run() { throw new Error('not implemented'); }
  get() { throw new Error('not implemented'); }
  all() { throw new Error('not implemented'); }
  transaction(fn) { throw new Error('not implemented'); }
  schemaVersion() { throw new Error('not implemented'); }
}
module.exports = Store;