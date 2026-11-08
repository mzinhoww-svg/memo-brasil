import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// The CLI streams each pgTAP file into its runner. Expand psql's relative includes
// first so migration fixtures exercise the actual migration source in CI too.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv.slice(2);
if (input.some(p => p.startsWith('-'))) throw new Error('Only local SQL file/directory paths are accepted');
const files = [];
function discover(p) {
  if (statSync(p).isDirectory()) for (const e of readdirSync(p).sort()) discover(path.join(p, e));
  else if (p.endsWith('.sql')) files.push(realpathSync(p));
}
for (const p of input.length ? input : ['supabase/tests/database']) discover(path.resolve(project, p));
if (!files.length) throw new Error('No SQL test files found');
function expand(file, stack = []) {
  file = realpathSync(file);
  if (stack.includes(file)) throw new Error('Circular SQL include: ' + file);
  return readFileSync(file, 'utf8').replace(/^\s*\\ir\s+([^\r\n]+)\s*$/gm, (_, requested) => {
    const name = requested.trim().replace(/^(['"])(.*)\1$/, '$2');
    const target = path.resolve(path.dirname(file), name);
    return `\n-- Included migration source: ${path.basename(target)}\n${expand(target, [...stack, file])}\n`;
  });
}
const directory = mkdtempSync(path.join(tmpdir(), 'memoriesmt-db-tests-'));
let result;
try {
  files.forEach((file, index) => writeFileSync(path.join(directory, `${String(index).padStart(3, '0')}-${path.basename(file)}`), expand(file)));
  const env = { ...process.env };
  delete env.SUPABASE_PROJECT_ID; // A hosted ref must never change this local test target.
  const binary = env.SUPABASE_TEST_CLI_PATH;
  const args = [...(binary ? [] : ['--yes', 'supabase@3.0.0']), 'test', 'db', directory, '--workdir', project];
  result = spawnSync(binary || 'npx', args, { cwd: project, env, stdio: 'inherit' });
  if (result.error) throw result.error;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
process.exitCode = result.status ?? 1;
