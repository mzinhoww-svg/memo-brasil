import { expect, it } from 'vitest';
import type { MemoEvent } from '@/domain/event';
import { endConsequence } from './end-consequence';
const e = { startAt: 0, durationHours: 10, revealEnabled: true, revealAt: 36_000_000, revealAnchor: 'fim', revealOffsetDays: 0, timezone: 'UTC', everyoneSeesAll: false, hostName: 'Ana' } as MemoEvent;
it('encerrar com âncora fim+0 revela agora e explica público restrito', () => {
 expect(endConsequence(e, 1000, 1000)).toMatch(/reveladas agora/);
 expect(endConsequence(e, 1000, 1000)).toMatch(/autor e o anfitrião/);
});
it('data fixa preserva a data e o fuso, fim+N acompanha o novo fim', () => {
 expect(endConsequence({...e, revealAnchor: 'data'}, 1000, 1000)).toMatch(/01 · 01 · 1970.*10h00.*UTC/);
 expect(endConsequence({...e, revealOffsetDays: 2}, 1000, 1000)).toMatch(/03 · 01 · 1970.*UTC/);
});
