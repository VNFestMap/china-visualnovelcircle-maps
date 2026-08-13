import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const registered = {};
const window = {
  VNFLanguage: { register(language, messages, apiMessages) { registered[language] = { messages, apiMessages }; } },
  addEventListener() {},
};
vm.runInNewContext(fs.readFileSync('js/language-catalog.js', 'utf8'), { window }, { filename: 'language-catalog.js' });

assert.deepEqual(Object.keys(registered.zh.messages).sort(), Object.keys(registered.ja.messages).sort(), 'Chinese and Japanese catalog keys must match');
assert.deepEqual(Object.keys(registered.zh.apiMessages).sort(), Object.keys(registered.ja.apiMessages).sort(), 'Chinese and Japanese API message keys must match');

function placeholders(value) {
  return [...String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}
for (const key of Object.keys(registered.zh.messages)) {
  assert.ok(String(registered.zh.messages[key]).trim(), `${key} needs Chinese text`);
  assert.ok(String(registered.ja.messages[key]).trim(), `${key} needs Japanese text`);
  assert.deepEqual(placeholders(registered.zh.messages[key]), placeholders(registered.ja.messages[key]), `${key} interpolation variables must match`);
}

for (const file of fs.readdirSync('wiki/content').filter((name) => name.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join('wiki/content', file), 'utf8'));
  const ja = data.i18n?.ja;
  assert.ok(ja?.title && ja?.summary && ja?.infobox, `${file} needs complete Japanese metadata`);
  assert.equal(ja.sections?.length, data.sections?.length, `${file} Japanese section count must match Chinese`);
  for (const [index, section] of data.sections.entries()) {
    assert.equal(ja.sections[index]?.body?.length, section.body?.length, `${file} section ${index + 1} paragraph count must match`);
  }
  assert.equal(ja.images?.length || 0, data.images?.length || 0, `${file} Japanese image metadata must match`);
  assert.equal(ja.references?.length || 0, data.references?.length || 0, `${file} Japanese references must match`);
}

console.log('i18n catalog contract tests passed');
