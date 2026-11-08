import { expect, it } from 'vitest';
import { offlineDestination } from './offline-destination';
it('retoma a navegação original do fallback e aceita retorno interno explícito', () => {
 expect(offlineDestination('https://festa.test/e/ABCDEFGH/postar?mesa=1')).toBe('/e/ABCDEFGH/postar?mesa=1');
 expect(offlineDestination('https://festa.test/offline?from=%2Fpainel%2Fe%2Fdownloads')).toBe('/painel/e/downloads');
});
it('recusa retornos externos e loops offline', () => {
 for (const from of ['//evil.test/a','https://evil.test','/offline','/\\evil.test']) expect(offlineDestination(`https://festa.test/offline?from=${encodeURIComponent(from)}`)).toBe('/');
});
