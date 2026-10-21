// Worker de purga (SCV-004). Só contra Supabase local: usa o service_role local para semear a fila.
import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !SVC) throw new Error("defina SUPABASE_URL e SUPABASE_SERVICE_KEY");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(URL)) throw new Error("recusado: alvo não é local");
const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const call = (token) => fetch(`${URL}/functions/v1/purge-storage`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
const existe = async (bucket, path) => !(await admin.storage.from(bucket).download(path)).error;

test("recusa quem não é o service_role", async () => {
  assert.equal((await call("nada")).status, 403);
  assert.equal((await fetch(`${URL}/functions/v1/purge-storage`, { method: "POST" })).status, 403);
});

test("remove objetos dos dois buckets e esvazia a fila; caminho inexistente não trava", async () => {
  const id = crypto.randomUUID();
  const fotos = `purge-${id}/a.jpg`, marca = `purge-${id}/logo.png`, fantasma = `purge-${id}/nao-existe.jpg`;
  const png = new Uint8Array([137, 80, 78, 71]);
  assert.equal((await admin.storage.from("event-photos").upload(fotos, png, { contentType: "image/png" })).error, null);
  assert.equal((await admin.storage.from("event-branding").upload(marca, png, { contentType: "image/png" })).error, null);
  const ins = await admin.from("storage_purge_queue").insert([{ path: fotos, bucket: "event-photos" }, { path: marca, bucket: "event-branding" }, { path: fantasma, bucket: "event-photos" }]);
  assert.equal(ins.error, null);
  const r = await call(SVC);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(await existe("event-photos", fotos), false);
  assert.equal(await existe("event-branding", marca), false);
  const { data } = await admin.from("storage_purge_queue").select("path").in("path", [fotos, marca, fantasma]);
  assert.equal(data.length, 0);
});
