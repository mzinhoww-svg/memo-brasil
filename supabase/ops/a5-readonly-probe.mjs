// A.5: leitura por padrão; signup negativo exige --check-disabled-email-signup. Nunca imprime a chave.
// SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... node supabase/ops/a5-readonly-probe.mjs
import { writeFile } from 'node:fs/promises';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (chave pública).');
const origin = new URL(url).origin;
const host = new URL(origin).hostname;
const project = host.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1] ?? (['localhost','127.0.0.1'].includes(host) ? 'local' : host);
if (process.env.A5_EXPECTED_PROJECT && project !== process.env.A5_EXPECTED_PROJECT) throw new Error('Alvo diferente de A5_EXPECTED_PROJECT. Nenhum probe executado.');
const args = process.argv.slice(2);
const checkSignup = args.includes('--check-disabled-email-signup');
const results = [];
async function probe(name, path, expected, body) {
  try {
    const r = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const data = await r.json().catch(() => null);
    const row = { name, status: r.status, pass: expected.includes(r.status), errorCode: data?.error_code ?? data?.code ?? null };
    if (name === 'auth-settings') {
      row.settings = { google: data?.external?.google, email: data?.external?.email, disable_signup: data?.disable_signup, anonymous: data?.external?.anonymous_users };
      row.scv010ProviderDisabled = data?.external?.email === false;
      row.scv010Closed = false;
      row.pass = row.pass && row.settings.google === true && row.settings.email === false && row.settings.anonymous === true;
    }
    if (name === 'email-signup-disabled') {
      row.errorMessage = data?.msg ?? data?.message ?? data?.error_description ?? null;
      row.userCreated = Boolean(data?.user || data?.access_token || data?.session);
    }
    results.push(row);
  } catch (e) { results.push({ name, pass: false, networkError: String(e.message) }); }
}
await probe('auth-settings', '/auth/v1/settings', [200]);
// Prova negativa só quando o servidor anuncia Email desligado. O endereço é sintético e não tem destinatário real.
if (checkSignup && results[0]?.scv010ProviderDisabled) {
  await probe('email-signup-disabled','/auth/v1/signup',[400,422],{email:'a5-blocked-signup@memoriesmt.invalid',password:crypto.randomUUID()+'-Aa1!'});
  const signup = results.at(-1);
  signup.pass = signup.pass && !signup.userCreated && (signup.errorCode === 'email_provider_disabled' || /email.*(disabled|not allowed)|(?:signup|sign.?up).*(disabled|not allowed)/i.test(signup.errorMessage ?? ''));
  results[0].scv010Closed = signup.pass;
}
for (const table of ['events','photos','participants','profiles','audit_logs','platform_roles','event_themes','event_assets','platform_settings','feature_flags','storage_purge_queue','rate_limits','invitations','photo_reports','reactions','account_deletion_requests'])
  await probe(`anon-table-${table}`, `/rest/v1/${table}?select=*&limit=1`, [401,403]);
for (const [name, body] of [['admin_health',{}],['admin_audit_integrity',{}],['admin_dashboard_metrics',{}],['admin_list_events',{p_limit:1,p_offset:0}],['is_master',{}],['get_enabled_flags',{}],['event_preview',{p_code:'ZZZZZZZZ'}]])
  await probe(`anon-rpc-${name}`, `/rest/v1/rpc/${name}`, [401,403], body);
await probe('finalize-asset-no-jwt','/functions/v1/finalize-asset',[401],{});
await probe('purge-storage-no-credential','/functions/v1/purge-storage',[403],{});
await probe('purge-storage-get','/functions/v1/purge-storage',[405]);
for (const bucket of ['event-photos','event-branding']) {
  await probe(`public-${bucket}`, `/storage/v1/object/public/${bucket}/a5-nonexistent-object`, [400,404]);
}
const report = { observedAt: new Date().toISOString(), project, origin, mode:checkSignup ? 'Public key; read-only probes plus explicit negative signup attempt' : 'HTTP read-only probes without a user session; public key only', tests:results.length, passed:results.filter(x=>x.pass).length, results };
const out = args.find(arg => !arg.startsWith('--')) ?? `a5-readonly-http-${Date.now()}.json`;
await writeFile(out, JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({tests:report.tests,passed:report.passed,scv010Closed:results[0].scv010Closed,settings:results[0].settings}));
if (report.passed !== report.tests) process.exitCode=1;
