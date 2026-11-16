const SqliteStore = require('./sqlite');

function createStore(dataDir) {
  return new SqliteStore(dataDir);
}

module.exports = createStore;
module.exports.createStore = createStore;
module.exports.SqliteStore = SqliteStore;
module.exports.default = createStore;