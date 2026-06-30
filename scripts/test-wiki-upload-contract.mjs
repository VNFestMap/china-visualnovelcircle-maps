import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const apiSource = fs.readFileSync(path.join(root, 'api/wiki.php'), 'utf8');
const editorSource = fs.readFileSync(path.join(root, 'admin/wiki_editor.html'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'wiki/index.html'), 'utf8');
const wikiCssSource = fs.readFileSync(path.join(root, 'wiki/wiki.css'), 'utf8');

assert.match(apiSource, /action\s*===\s*['"]upload['"]/, 'wiki API should expose an upload action');
assert.match(apiSource, /wiki\/uploads/, 'wiki uploads should be stored under wiki/uploads');
assert.match(apiSource, /move_uploaded_file/, 'wiki upload should move the uploaded file safely');
assert.match(apiSource, /UPLOAD_ERR_OK/, 'wiki upload should check PHP upload errors');
assert.match(apiSource, /IMAGETYPE_WEBP/, 'wiki upload should allow WebP images');
assert.match(apiSource, /10\s*\*\s*1024\s*\*\s*1024/, 'wiki upload should allow images up to 10MB');
assert.match(apiSource, /width_percent/, 'wiki API should preserve image display width');
assert.match(apiSource, /align/, 'wiki API should preserve image alignment');
assert.match(apiSource, /fit/, 'wiki API should preserve image fit mode');
assert.match(apiSource, /function\s+wikiNormalizeRegionName\s*\(/, 'wiki API should normalize region aliases for index grouping');
assert.match(apiSource, /壮族自治区\|回族自治区\|维吾尔自治区\|特别行政区\|自治区\|省\|市/, 'wiki API should merge Chinese province suffix aliases');
assert.match(apiSource, /if\s*\(!file_exists\(\$homeFile\)\)/, 'wiki save should preserve an existing wiki homepage shell');
assert.match(apiSource, /wikiNormalizeLocalizedContent/, 'wiki API should normalize localized wiki content');
assert.match(apiSource, /i18n[\s\S]*ja/, 'wiki API should preserve Japanese wiki content');
assert.match(apiSource, /catch\s*\(\s*Throwable\s+\$error\s*\)/, 'wiki API should convert runtime failures to JSON');
assert.match(apiSource, /function\s+wikiWriteFile\s*\(/, 'wiki API should use checked file writes');
assert.match(apiSource, /wiki index write failed/, 'wiki API should detect index write failures');
assert.match(apiSource, /wikiServerError/, 'wiki API should log server errors and return JSON');
assert.match(apiSource, /wiki-encyclopedia-layout/, 'wiki API generated homepage should use the encyclopedia layout');
assert.match(apiSource, /recent-updates/, 'wiki API generated homepage should include recent updates');
assert.match(apiSource, /all-pages/, 'wiki API generated homepage should include an all-pages index');
assert.match(apiSource, /maintenance/, 'wiki API generated homepage should include the maintenance center');

assert.match(editorSource, /type="file"/, 'wiki editor should include a file input');
assert.match(editorSource, /FormData/, 'wiki editor should submit uploads with FormData');
assert.match(editorSource, /action=upload/, 'wiki editor should call the wiki upload action');
assert.match(editorSource, /data-action="upload-image"/, 'each image row should have an upload button');
assert.match(editorSource, /WIKI_IMAGE_MAX_BYTES\s*=\s*10\s*\*\s*1024\s*\*\s*1024/, 'wiki editor should enforce a 10MB upload limit');
assert.match(editorSource, /data-field="width_percent"/, 'wiki editor should expose image width controls');
assert.match(editorSource, /data-field="align"/, 'wiki editor should expose image alignment controls');
assert.match(editorSource, /data-field="fit"/, 'wiki editor should expose image fit controls');
assert.match(editorSource, /readWikiResponse/, 'wiki editor should use a shared response parser');
assert.match(editorSource, /await\s+resp\.text\(\)/, 'wiki editor should surface non-JSON API responses');

assert.match(indexSource, /wiki-encyclopedia-layout/, 'wiki index should use the encyclopedia layout');
assert.match(indexSource, /id="recent-updates"/, 'wiki index should include recent updates');
assert.match(indexSource, /id="all-pages"/, 'wiki index should include all pages');
assert.match(indexSource, /id="maintenance"/, 'wiki index should include maintenance');
assert.match(wikiCssSource, /@media\s*\(max-width:\s*1199px\)/, 'wiki CSS should include tablet layout rules');
assert.match(wikiCssSource, /@media\s*\(max-width:\s*760px\)/, 'wiki CSS should include mobile layout rules');

console.log('wiki upload contract tests passed');
