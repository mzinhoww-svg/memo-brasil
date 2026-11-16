// Detecção de navegador embutido (Instagram, WhatsApp, Facebook, TikTok…) pelo user agent.
// A mesma função roda no servidor (testes) e no navegador (public/camera.html).
const test = require('node:test');
const assert = require('node:assert/strict');
const { ehNavegadorEmbutido, appEmbutido } = require('../src/embutido.js');

const UAS = {
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.0.0',
  whatsapp: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 WhatsApp/2.23.24',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/400.0.0.1;FBBV/1;FBID/phone;]',
  messenger: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/400.0.0.1;]',
  tiktok: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 TikTok 30.0.0',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
};

test('reconhece Instagram, WhatsApp, Facebook, Messenger e TikTok', () => {
  assert.equal(appEmbutido(UAS.instagram), 'Instagram');
  assert.equal(appEmbutido(UAS.whatsapp), 'WhatsApp');
  assert.equal(appEmbutido(UAS.facebook), 'Facebook');
  assert.equal(appEmbutido(UAS.messenger), 'Messenger');
  assert.equal(appEmbutido(UAS.tiktok), 'TikTok');
});

test('não confunde navegadores normais (Safari e Chrome) com navegador embutido', () => {
  assert.equal(ehNavegadorEmbutido(UAS.safari), false);
  assert.equal(ehNavegadorEmbutido(UAS.chromeAndroid), false);
  assert.equal(ehNavegadorEmbutido(''), false);
  assert.equal(ehNavegadorEmbutido(undefined), false);
});
