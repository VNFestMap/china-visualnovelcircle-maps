import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const editorPath = path.join(rootDir, 'admin', 'wiki_editor.html');
const source = fs.readFileSync(editorPath, 'utf8');

function assertContains(needle, description) {
  if (!source.includes(needle)) {
    throw new Error(`wiki editor contract failed: missing ${description}`);
  }
}

assertContains('wikiEditorDraft:', 'per-club local draft key');
assertContains('beforeunload', 'unsaved-change warning');
assertContains('renderPreview', 'live preview renderer');
assertContains('previewPane', 'preview pane markup');
assertContains('insertTemplateBtn', 'basic section template action');
assertContains('exportJsonBtn', 'JSON export action');
assertContains('importJsonBtn', 'JSON import action');
assertContains('data-action="duplicate-row"', 'duplicate row action');
assertContains('data-field="level"', 'section heading level selector');
assertContains('section.level || 2', 'existing sections default to level 2');
assertContains('restoreDraftBtn', 'draft restore action');
assertContains('clearDraftBtn', 'draft clear action');
assertContains('wikiLangZhBtn', 'Chinese wiki content tab');
assertContains('wikiLangJaBtn', 'Japanese wiki content tab');
assertContains('activeWikiLang', 'active wiki language editor state');
assertContains('i18n: { ja:', 'Japanese wiki content serialization');
assertContains('readWikiResponse', 'shared wiki API response parser');
assertContains('接口返回异常（HTTP ', 'non-JSON wiki API error visibility');
assertContains('await resp.text()', 'wiki API responses parsed from text before JSON');

console.log('wiki editor tool contract ok');
