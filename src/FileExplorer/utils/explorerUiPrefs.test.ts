import assert from 'node:assert/strict';
import { clampPreviewSize, wheelToSize, parseUiPrefs, serializeUiPrefs } from './explorerUiPrefs.ts';

// clamp + passo de 4
assert.equal(clampPreviewSize(10), 24);
assert.equal(clampPreviewSize(500), 96);
assert.equal(clampPreviewSize(50), 52);   // 50 -> arredonda pro múltiplo de 4 mais próximo
assert.equal(clampPreviewSize(48), 48);
assert.equal(clampPreviewSize(NaN), 48);

// roda do mouse: um "clique" (deltaY=-100) sobe ~8px; pra baixo desce
assert.equal(wheelToSize(48, -100), 56);
assert.equal(wheelToSize(48, 100), 40);
// nunca passa dos limites
assert.equal(wheelToSize(94, -500), 96);
assert.equal(wheelToSize(26, 500), 24);

// touchpad: deltas pequenos precisam se acumular no valor "quebrado" até virar um passo
let f = 48;
for (let i = 0; i < 10; i++) f = wheelToSize(f, -5);   // 10 * 0.4px = 4px
assert.equal(clampPreviewSize(f), 52);

// prefs: parse tolerante e ida e volta
assert.deepEqual(parseUiPrefs('{}'), { previewSize: 48 });
assert.deepEqual(parseUiPrefs(''), { previewSize: 48 });
assert.deepEqual(parseUiPrefs('lixo{'), { previewSize: 48 });
assert.deepEqual(parseUiPrefs('{"previewSize":"grande"}'), { previewSize: 48 });
assert.deepEqual(parseUiPrefs('{"previewSize":999}'), { previewSize: 96 });
assert.deepEqual(parseUiPrefs(serializeUiPrefs({ previewSize: 72 })), { previewSize: 72 });
console.log('prefs de ícones: todos os testes passaram');
