import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = readFileSync(path.join(root, 'index.html'), 'utf8');
const hub = readFileSync(path.join(root, 'js', 'project-hub.js'), 'utf8');
const styles = readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

assert.match(index, /id="hubFilterToggle"[^>]*aria-expanded="false"[^>]*aria-controls="hubFilterPanel"/, 'hub should expose one accessible filter trigger');
assert.match(index, /id="hubFilterPanel" hidden aria-label="筛选企划"/, 'hub filter choices should live in a hidden popover panel');
assert.doesNotMatch(index, /class="hub-filter-bar"/, 'hub types should no longer consume a permanently visible filter row');
assert.doesNotMatch(index, /class="hub-status-row"/, 'hub statuses should no longer consume a permanently visible filter row');
assert.match(index, /id="hubFilterReset"/, 'hub filter panel should provide reset');
assert.match(index, /id="hubFilterDone"/, 'hub filter panel should provide a mobile completion action');
assert.match(index, /id="hubFilterBackdrop"[^>]*hidden/, 'hub filter panel should provide a mobile backdrop');

assert.match(hub, /function setHubFilterPanelOpen\(open, restoreFocus\)/, 'hub should manage the filter panel state');
assert.match(hub, /function resetHubFilters\(\)/, 'hub should reset both filter dimensions together');
assert.match(hub, /hubFilterPanelOpen && panel && toggle && !panel\.contains\(event\.target\) && !toggle\.contains\(event\.target\)/, 'desktop clicks outside the filter panel should close it');
assert.match(hub, /hubFilterType !== 'all' && project\.project_type !== hubFilterType/, 'type filtering behavior must remain intact');
assert.match(hub, /hubFilterStatus !== 'all' && project\.status !== hubFilterStatus/, 'status filtering behavior must remain intact');
assert.match(hub, /else if \(hubFilterPanelOpen\) setHubFilterPanelOpen\(false, true\)/, 'Escape should close the open filter panel before the parent modal');

assert.match(styles, /\.hub-filter-panel\s*\{[\s\S]*?position: absolute;/, 'desktop filter panel should overlay instead of consuming sidebar height');
assert.match(styles, /@media \(max-width: 768px\)[\s\S]*?\.hub-filter-panel\s*\{[\s\S]*?position: fixed;/, 'mobile filter panel should become a bottom sheet');
assert.match(styles, /\.hub-filter-options \.hub-filter-type,[\s\S]*?min-height: 42px/, 'mobile filter choices should retain touch-sized controls');

console.log('project hub filter contract checks passed');
