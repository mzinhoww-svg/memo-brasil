import { describe, expect, it, vi } from 'vitest';
import type { MemoEvent } from '@/domain/event';
import type { Photo } from '@/domain/photo';
import { createMemoryRepositories, createIndexedDbRepositories, RepositoryError } from '@/repositories';
import { createSupabaseRepositories, toRepositoryError } from './supabase';
import { removeGuest, unblockGuest } from '@/features/admin/service';
import { joinEvent } from '@/features/participants/service';
import { react, reportPhoto } from '@/features/photos/service';
import { readEventScoped, readPhotoData } from '@/features/access/read';
import type { SupabaseClient } from '@supabase/supabase-js';
const host = { id: 'host', name: 'Host', createdAt: 1 };
const guest = { id: 'guest', name: 'Ana', createdAt: 1 };
const event: MemoEvent = { id:'event',code:'ABCD2345',title:'Festa',category:'casamento',hostId:host.id,hostName:'Host',startAt:0,durationHours:6,cameraStyle:'original',revealEnabled:false,revealAt:null,revealAnchor:'data',revealOffsetDays:0,timezone:'UTC',revealStatus:'desativada',revealedAt:null,capacity:50,shotsPerPerson:24,everyoneSeesAll:true,reactionsEnabled:true,palette:'salvia',eventFont:'birthstone',moments:[],tables:0,createdAt:1,version:1 };
const photo: Photo = { id:'photo',eventId:event.id,authorId:guest.id,authorName:guest.name,createdAt:1,moment:'Festa',status:'visivel',reports:0,highlighted:false,version:1,uploadStatus:'pronta' };
const data = { bytes: new Uint8Array([1]).buffer, type:'image/jpeg' };
let seq=0;
describe.each([['memory',createMemoryRepositories],['indexeddb',()=>createIndexedDbRepositories(`moderation-${seq++}`)]] as const)('persistent moderation %s',(_,make)=>{
 it('blocked participants receive only the invite preview until the host unblocks them',async()=>{
  const r=make(); await r.events.save(event); await r.users.save(host);
  await joinEvent(r,guest,event.code,guest.name,10); await r.photos.add(photo,data);
  await react(r,event,photo.id,guest.id,'amei',10);
  await removeGuest(r,event.id,guest.id);

  for (const key of [{code:event.code},{id:event.id}]) {
   for (const role of ['convidado','organizador'] as const) {
    const scoped=await readEventScoped(r,key,{userId:guest.id,role},11);
    expect(scoped.access).toBe('convite');
    expect(scoped.preview).toMatchObject({code:event.code,title:'Festa'});
    expect(scoped.event).toBeUndefined();
    expect(scoped.participants).toEqual([]);
    expect(scoped.photos).toEqual([]);
    expect(scoped.reactions).toEqual([]);
    expect(scoped.counts).toEqual({mine:0,total:0});
   }
  }

  await unblockGuest(r,event.id,guest.id);
  const restored=await readEventScoped(r,{code:event.code},{userId:guest.id,role:'convidado'},12);
  expect(restored.access).toBe('membro');
  expect(restored.photos.map(p=>p.id)).toEqual([photo.id]);
  expect(restored.reactions).toHaveLength(1);
  expect(restored.counts).toEqual({mine:1,total:1});
 });
 it('blocked participants cannot read photo bytes while host and master moderation access is preserved',async()=>{
  const r=make(); await r.events.save(event); await r.users.save(host);
  await joinEvent(r,guest,event.code,guest.name,10); await r.photos.add(photo,data);
  await r.photos.add({...photo,id:'host-photo',authorId:host.id,authorName:host.name},data);
  await removeGuest(r,event.id,guest.id);

  for (const role of ['convidado','organizador'] as const) {
   for (const photoId of [photo.id,'host-photo']) {
    expect(await readPhotoData(r,{userId:guest.id,role},event,photoId,11)).toBeUndefined();
   }
  }
  for (const actor of [{userId:host.id,role:'organizador'},{userId:guest.id,role:'master'}] as const) {
   const scoped=await readEventScoped(r,{id:event.id},actor,11);
   expect(scoped.access).toBe('organizador');
   expect(scoped.photos).toHaveLength(2);
   expect(await readPhotoData(r,actor,event,photo.id,11)).toBeDefined();
  }

  await unblockGuest(r,event.id,guest.id);
  expect(await readPhotoData(r,{userId:guest.id,role:'convidado'},event,photo.id,12)).toBeDefined();
 });
 it('blocks rejoining/posting without erasing history; explicit host unblock restores participation',async()=>{
  const r=make();await r.events.save(event);await r.users.save(host);
  await joinEvent(r,guest,event.code,guest.name,10);await r.photos.add(photo,data);
  await r.photos.begin({...photo,id:'pending-photo'}); await r.photos.attach('pending-photo',data);
  await removeGuest(r,event.id,guest.id);
  expect((await r.participants.get(event.id,guest.id))?.blockedAt).toEqual(expect.any(Number));
  expect(await joinEvent(r,guest,event.code,guest.name,11)).toEqual({ok:false,reason:'bloqueado'});
  await expect(r.photos.begin({...photo,id:'blocked-photo'})).rejects.toMatchObject({code:'blocked'});
  await expect(r.photos.add({...photo,id:'blocked-add'},data)).rejects.toMatchObject({code:'blocked'});
  await expect(r.photos.finalize('pending-photo')).rejects.toMatchObject({code:'blocked'});
  await expect(r.participants.put({eventId:event.id,userId:guest.id,name:'New',joinedAt:10})).rejects.toMatchObject({code:'blocked'});
  await expect(r.participants.remove(event.id,guest.id)).rejects.toMatchObject({code:'blocked'});
  expect(await r.photos.get(photo.id)).toMatchObject({id:photo.id});
  expect(await r.events.get(event.id)).toBeDefined();
  await unblockGuest(r,event.id,guest.id);
  expect((await joinEvent(r,guest,event.code,guest.name,12)).ok).toBe(true);
  await expect(r.photos.begin({...photo,id:'allowed-photo'})).resolves.toBeDefined();
 });
 it('generic updates preserve publication and identity while host moderation remains available',async()=>{
  const r=make(); await r.events.save(event); await r.users.save(host);
  await joinEvent(r,guest,event.code,guest.name,10); await r.photos.add(photo,data);
  const pending=await r.photos.begin({...photo,id:'pending-update',caption:'Original',tableLabel:'Mesa 1'});
  await r.photos.attach(pending.id,data); await removeGuest(r,event.id,guest.id);
  await r.users.save(guest);
  const saved=await r.photos.update({...pending,uploadStatus:'pronta',eventId:'another-event',authorId:host.id,authorName:host.name,createdAt:99,capturedAt:98,moment:'Changed',caption:'Changed',tableLabel:'Mesa 2'});
  expect(saved).toMatchObject({...pending,version:pending.version+1});
  expect((await r.photos.listByEvent(event.id)).map(p=>p.id)).toEqual([photo.id]);
  await expect(r.photos.finalize(pending.id)).rejects.toMatchObject({code:'blocked'});
  expect((await r.participants.get(event.id,guest.id))?.blockedAt).toEqual(expect.any(Number));
  await r.users.save(host);
  const moderated=await r.photos.update({...photo,status:'oculta',highlighted:true,reports:0});
  expect(moderated).toMatchObject({eventId:event.id,authorId:guest.id,status:'oculta',highlighted:true,uploadStatus:'pronta'});
 });
 it('another host cannot block or unblock participants',async()=>{
  const r=make();await r.events.save(event);await r.users.save(host);await joinEvent(r,guest,event.code,guest.name,10);
  await r.users.save({...host,id:'other'});
  await expect(removeGuest(r,event.id,guest.id)).rejects.toMatchObject({code:'forbidden'});
  await expect(unblockGuest(r,event.id,guest.id)).rejects.toMatchObject({code:'forbidden'});
  expect((await r.participants.get(event.id,guest.id))?.blockedAt).toBeUndefined();
 });
});
it('reports through the server RPC without generic update and propagates failure',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:null,error:null});const from=vi.fn();
 const r=createSupabaseRepositories({rpc,from} as unknown as SupabaseClient);
 await reportPhoto(r,'photo');expect(rpc).toHaveBeenCalledExactlyOnceWith('report_photo',{p_photo:'photo'});expect(from).not.toHaveBeenCalled();
 rpc.mockResolvedValue({data:null,error:{code:'42501',message:'forbidden'}});
 await expect(reportPhoto(r,'photo')).rejects.toBeInstanceOf(RepositoryError);
});

it('sends the report reason as p_reason only when informed',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:null,error:null});
 const r=createSupabaseRepositories({rpc,from:vi.fn()} as unknown as SupabaseClient);
 await reportPhoto(r,'photo','improprio');
 expect(rpc).toHaveBeenCalledExactlyOnceWith('report_photo',{p_photo:'photo',p_reason:'improprio'});
});

it('asks the server whether the original may be downloaded',async()=>{
 const rpc=vi.fn().mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data:false,error:null});
 const r=createSupabaseRepositories({rpc,from:vi.fn()} as unknown as SupabaseClient);
 expect(await r.photos.downloadAllowed!('photo')).toBe(true);
 expect(await r.photos.downloadAllowed!('photo')).toBe(false);
 expect(rpc).toHaveBeenCalledWith('photo_download_allowed',{p_photo:'photo'});
});

it('maps the dedicated blocked SQLSTATE without reusing financial codes',()=>{
 expect(toRepositoryError({code:'MM015'}).code).toBe('blocked');
 expect(toRepositoryError({code:'MM004'}).code).toBe('forbidden');
});
it('uses host-scoped moderation RPCs',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:null,error:null});const from=vi.fn();
 const r=createSupabaseRepositories({rpc,from} as unknown as SupabaseClient);
 await removeGuest(r,'event','guest'); await unblockGuest(r,'event','guest');
 expect(rpc).toHaveBeenNthCalledWith(1,'block_participant',{p_event:'event',p_user:'guest'});
 expect(rpc).toHaveBeenNthCalledWith(2,'unblock_participant',{p_event:'event',p_user:'guest'});
 expect(from).not.toHaveBeenCalled();
});
it('keeps blocked metadata across IndexedDB repository instances',async()=>{
 const name=`moderation-reopen-${seq++}`;
 const first=createIndexedDbRepositories(name); await first.events.save(event); await first.users.save(host);
 await joinEvent(first,guest,event.code,guest.name,10); await removeGuest(first,event.id,guest.id);
 const reopened=createIndexedDbRepositories(name);
 expect((await reopened.participants.get(event.id,guest.id))?.blockedAt).toEqual(expect.any(Number));
 expect(await joinEvent(reopened,guest,event.code,guest.name,11)).toEqual({ok:false,reason:'bloqueado'});
});
