import assert from 'node:assert/strict';
import { parseGroups, serializeGroups, addPathsToGroup, remapPath, remapGroups, type FolderGroup } from './folderGroups.ts';

// parse tolerante
assert.deepEqual(parseGroups('{}'), []);
assert.deepEqual(parseGroups(''), []);
assert.deepEqual(parseGroups('lixo{'), []);
assert.deepEqual(parseGroups(JSON.stringify({ groups: [{ id: 'a', name: 'X', paths: ['C:\\u\\a', 'c:/U/a/', 5, ''], collapsed: true }, { name: 'sem id' }, null] })),
  [{ id: 'a', name: 'X', paths: ['C:\\u\\a'], collapsed: true }]);

// ida e volta
const g: FolderGroup[] = [{ id: '1', name: 'Trabalho', paths: ['C:\\Users\\x\\Docs'], collapsed: false }];
assert.deepEqual(parseGroups(serializeGroups(g)), g);

// adicionar sem duplicar e reabrindo grupo recolhido
let grp: FolderGroup = { id: '1', name: 'T', paths: ['/h/a'], collapsed: true };
assert.equal(addPathsToGroup(grp, ['/h/a/']), grp);                 // duplicata: mesma referência
grp = addPathsToGroup(grp, ['/h/b', '/h/A']);                        // /h/A = /h/a (ignora maiúscula)
assert.deepEqual(grp.paths, ['/h/a', '/h/b']);
assert.equal(grp.collapsed, false);

// remapear: pasta renomeada, subpasta, e quem não tem relação
assert.equal(remapPath('C:\\u\\Docs', 'C:\\u\\Docs', 'C:\\u\\Docs2'), 'C:\\u\\Docs2');
assert.equal(remapPath('C:\\u\\Docs\\sub\\x', 'C:\\u\\Docs', 'C:\\u\\Docs2'), 'C:\\u\\Docs2\\sub\\x');
assert.equal(remapPath('/h/Docs', '/h/Doc', '/h/Z'), null);          // prefixo parcial não conta
assert.equal(remapPath('/h/a', '/h/b', '/h/c'), null);
// movida pra outra pasta
assert.equal(remapPath('/h/a/proj', '/h/a', '/h/arq/a'), '/h/arq/a/proj');

// remapGroups: referência igual quando nada muda; dedupe quando dois viram o mesmo
const groups: FolderGroup[] = [{ id: '1', name: 'T', paths: ['/h/a', '/h/b'], collapsed: false }];
assert.equal(remapGroups(groups, [{ from: '/h/zzz', to: '/h/y' }]), groups);
const out = remapGroups(groups, [{ from: '/h/a', to: '/h/b' }]);
assert.deepEqual(out[0].paths, ['/h/b']);
console.log('grupos: todos os testes passaram');
