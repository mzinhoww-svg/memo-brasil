// Registra as telas do console Master (M15 a M32): converte os HTML novos, acrescenta ao registry e ao índice de componentes.
// Uso: node scripts/gen-master-console.mjs   (depois: node scripts/html-to-tsx.mjs <nomes…>, já chamado aqui)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const csv = readFileSync(join(root, "design-system/revela/master/INDICE.csv"), "utf8").replace(/^﻿/, "").split(/\r?\n/).slice(1).filter(Boolean);
const rows = csv.map((l) => { const c = l.match(/("([^"]|"")*"|[^;]*)(;|$)/g).map((x) => x.replace(/;$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')); return { id: c[0], title: c[1], html: c[2].replace(/^html\//, "").replace(/\.html$/, ""), png: c[3] }; });
const pascal = (f) => f.split("-").filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join("");
const regPath = join(root, "web/src/revela/registry.ts");
let reg = readFileSync(regPath, "utf8");
const have = new Set([...reg.matchAll(/"html": "([^"]+)"/g)].map((m) => m[1]));
const add = rows.filter((r) => !have.has(r.html));
const r = spawnSync("node", ["scripts/html-to-tsx.mjs", ...add.map((x) => x.html), "--force"], { cwd: join(root, "web"), stdio: "inherit" });
if (r.status) process.exit(r.status);
const entries = add.map((x) => ` {\n  "id": ${JSON.stringify(x.id.replace(".", "-"))},\n  "title": ${JSON.stringify(x.title)},\n  "webp": ${JSON.stringify("master/" + x.png)},\n  "html": ${JSON.stringify(x.html)},\n  "name": ${JSON.stringify(pascal(x.html))},\n  "master": true\n }`).join(",\n");
reg = reg.replace(/\n \}\n\];\s*$/, `\n },\n${entries}\n];\n`);
writeFileSync(regPath, reg);
const idxPath = join(root, "web/src/revela/screens/index.ts");
let idx = readFileSync(idxPath, "utf8");
const imports = add.map((x) => `import { ${pascal(x.html)} } from "./${pascal(x.html)}";`).join("\n");
const map = add.map((x) => `  ${JSON.stringify(x.html)}: ${pascal(x.html)},`).join("\n");
idx = idx.replace(/\nexport const COMPONENTS/, `\n${imports}\nexport const COMPONENTS`).replace(/\n\};\s*$/, `\n${map}\n};\n`);
writeFileSync(idxPath, idx);
console.log(`${add.length} telas registradas`);
