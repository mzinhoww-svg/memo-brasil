import { describe, expect, it, vi } from 'vitest';
import type { MemoEvent } from '@/domain/event';
import type { Photo } from '@/domain/photo';
import { createMemoryRepositories, createIndexedDbRepositories, RepositoryError } from '@/repositories';
import { createSupabaseRepositories, toRepositoryError } from './supabase';
import { removeGuest, unblockGuest } from '@/features/admin/service';
import { joinEvent } from '@/features/participants/service';
import { reportPhoto } from '@/features/photos/service';
import type { SupabaseClient } from '@supabase/supabase-js';
const host = { id: 'host', name: 'Host', createdAt: 1 };
const guest = { id: 'guest', name: 'Ana', createdAt: 1 };
const event: MemoEvent = { id:'event',code:'ABCD2345',title:'Festa',category:'casamento',hostId:host.id,hostName:'Host',startAt:0,durationHours:6,cameraStyle:'original',revealEnabled:false,revealAt:null,revealAnchor:'data',revealOffsetDays:0,timezone:'UTC',revealStatus:'desativada',revealedAt:null,capacity:50,shotsPerPerson:24,everyoneSeesAll:true,reactionsEnabled:true,palette:'salvia',eventFont:'birthstone',moments:[],tables:0,createdAt:1,version:1 };
const photo: Photo = { id:'photo',eventId:event.id,authorId:guest.id,authorName:guest.name,createdAt:1,moment:'Festa',status:'visivel',reports:0,highlighted:false,version:1,uploadStatus:'pronta' };
const data = { bytes: new Uint8Array([1]).buffer, type:'image/jpeg' };
let seq=0;
describe.each([['memory',createMemoryRepositories],['indexeddb',()=>createIndexedDbRepositories(`moderation-${seq++}`)]] as const)('persistent moderation %s',(_,make)=>{
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
