import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./a5-readonly-probe.mjs',import.meta.url));
async function run(settings, extra = [], env = {}) {
  const dir = await mkdtemp(join(tmpdir(),'a5-probe-test-'));
  let signupCalls = 0;
  const server = createServer((req,res) => {
    res.setHeader('content-type','application/json');
    if (req.url === '/auth/v1/settings') return res.end(JSON.stringify({external:settings,disable_signup:false}));
    if (req.url === '/auth/v1/signup') { signupCalls++;res.statusCode=400;return res.end(JSON.stringify({error_code:'email_provider_disabled'})); }
    if (req.url.startsWith('/functions/v1/purge-storage')) res.statusCode=req.method==='GET'?405:403;
    else if(req.url.startsWith('/storage/'))res.statusCode=400;
    else res.statusCode=401;
    res.end(JSON.stringify({code:'42501'}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try {
    const out=join(dir,'result.json');
    const child=spawn(process.execPath,[script,out,...extra],{env:{...process.env,SUPABASE_URL:origin,SUPABASE_PUBLISHABLE_KEY:'test-public-key',...env},stdio:'ignore'});
    const exit=await new Promise(resolve=>child.on('exit',resolve));
    const report=await readFile(out,'utf8').then(JSON.parse).catch(()=>null);
    return {exit,report,signupCalls,origin};
  } finally { await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true}); }
}

test('fails the gate when email signup becomes enabled',async()=>{
  const r=await run({google:true,email:true,anonymous_users:true});
  assert.equal(r.exit,1);
  assert.equal(r.signupCalls,0);
});
test('default read-only run does not attempt signup and identifies actual local origin',async()=>{
  const r=await run({google:true,email:false,anonymous_users:true});
  assert.equal(r.exit,0);assert.equal(r.signupCalls,0);
  assert.equal(r.report.origin,r.origin);assert.equal(r.report.project,'local');
});
test('refuses a target that differs from the explicitly expected project',async()=>{
  const r=await run({google:true,email:false,anonymous_users:true},[],{A5_EXPECTED_PROJECT:'asyaegeodyttttaubvxh'});
  assert.equal(r.exit,1);assert.equal(r.report,null);assert.equal(r.signupCalls,0);
});
test('explicit negative signup validates the disabled provider without reporting a new user',async()=>{
  const r=await run({google:true,email:false,anonymous_users:true},['--check-disabled-email-signup']);
  assert.equal(r.exit,0);assert.equal(r.signupCalls,1);
  assert.equal(r.report.results[0].scv010Closed,true);
});
