import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'js/app.js'), 'utf8');

assert.match(
  source,
  /club-detail-action-buttons/,
  'detail action buttons should use a dedicated class'
);
assert.match(
  source,
  /content\.querySelector\(['"]\.club-detail-action-buttons['"]\)/,
  'event binding should target the dedicated action button container'
);
assert.match(
  source,
  /id="clubWikiActionWrap"/,
  'wiki action wrapper should remain separate from main detail actions'
);
assert.doesNotMatch(
  source,
  /const actionsContainer = content\.querySelector\(['"]\.club-detail-actions['"]\)/,
  'main action binding must not grab the wiki action wrapper'
);
assert.match(source, /wikiLangParam/, 'wiki links should carry the current UI language');
assert.match(source, /lang=ja/, 'Japanese UI should open wiki in Japanese mode');
assert.doesNotMatch(source, /club-detail-wallpaper/, 'detail modal should not include club wallpaper controls');
assert.doesNotMatch(source, /club_wallpaper/, 'detail modal should not call club wallpaper APIs');

console.log('club detail action tests passed');
