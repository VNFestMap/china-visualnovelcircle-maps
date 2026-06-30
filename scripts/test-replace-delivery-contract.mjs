import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), 'utf8');

const requiredFiles = [
  'user.html',
  'user-v2.html',
  'Galgame_events/galgameonly_list.html',
  'Galgame_events/galonly_staff_guidelines.html',
  'Galgame_events/galonly_staff_submit.html',
  'admin/Galonly_audit.html',
  'api/galonly.php',
  'scripts/migrate.php',
  '参考/交付1/_交付整理/2026-06-30_replace_delivery/originals/user.html',
  '参考/交付1/_交付整理/2026-06-30_replace_delivery/originals/api_galonly.php',
  '参考/交付1/_交付整理/2026-06-30_replace_delivery/manifest.md',
  '参考/交付1/_交付整理/2026-06-30_replace_delivery/sources/source-map.md',
];

for (const file of requiredFiles) {
  assert.ok(existsSync(path.join(root, file)), `Missing delivery file: ${file}`);
}

const userHtml = read('user.html');
const jsAsset = userHtml.match(/user-v2-assets\/index-[\w-]+\.js/)?.[0];
const cssAsset = userHtml.match(/user-v2-assets\/index-[\w-]+\.css/)?.[0];
assert.ok(jsAsset, 'user.html should load built React JS');
assert.ok(cssAsset, 'user.html should load built React CSS');
assert.ok(existsSync(path.join(root, jsAsset)), `Missing built JS asset: ${jsAsset}`);
assert.ok(existsSync(path.join(root, cssAsset)), `Missing built CSS asset: ${cssAsset}`);

const userV2 = read('user-v2.html');
assert.match(userV2, /window\.location\.replace\('\.\/user\.html'/, 'user-v2.html should redirect to canonical user.html');

const api = read('api/galonly.php');
for (const action of [
  'submit_staff',
  'get_staff_application',
  'update_staff',
  'delete_staff_application',
  'list_staff_applications',
  'vote_staff',
  'withdraw_staff_vote',
  'finalize_staff_roster',
  'unlock_staff_roster',
  'update_staff_event_config',
]) {
  assert.ok(api.includes(`case '${action}'`), `api/galonly.php missing ${action}`);
}
assert.ok(api.includes('galonly_staff_applications'), 'api/galonly.php should manage staff table');
assert.ok(api.includes('staff_current_applicants'), 'list_events should expose staff_current_applicants');
assert.ok(api.includes('set_exception_handler'), 'api/galonly.php should return JSON for uncaught staff/runtime errors');
const apiStaffCreate = api.match(/CREATE TABLE IF NOT EXISTS galonly_staff_applications \([\s\S]*?\) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/)?.[0] || '';
assert.ok(!apiStaffCreate.includes('FOREIGN KEY'), 'runtime staff table creation should not depend on foreign key compatibility');

const migrate = read('scripts/migrate.php');
assert.ok(migrate.includes('galonly_staff_applications'), 'migration should create staff table');
assert.ok(migrate.includes('staff_registration_open'), 'migration should add staff_registration_open');
const migrateStaffCreate = migrate.match(/CREATE TABLE IF NOT EXISTS galonly_staff_applications \([\s\S]*?\) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/)?.[0] || '';
assert.ok(!migrateStaffCreate.includes('FOREIGN KEY'), 'migration staff table creation should not depend on foreign key compatibility');

const listPage = read('Galgame_events/galgameonly_list.html');
assert.ok(!listPage.includes('api/user.php'), 'activity list must not call removed api/user.php');
assert.ok(!listPage.includes('href="galonly_audit.html"'), 'activity list must link admin audit page with correct relative path');
assert.ok(!listPage.includes('galonly_submit.html'), 'activity list must use existing booth submit page');
assert.ok(listPage.includes('../api/auth.php?action=me'), 'activity list should use existing auth endpoint');
assert.ok(listPage.includes('Shanghai_Galonly_submit.html'), 'activity list should keep booth application flow wired');

const staffSubmit = read('Galgame_events/galonly_staff_submit.html');
assert.ok(staffSubmit.includes("params.get('application_id') || params.get('app_id')"), 'staff form should accept app_id and application_id');
assert.ok(staffSubmit.includes('!meData.logged_in'), 'staff form should use auth.php logged_in field');
assert.ok(staffSubmit.includes('data.clubs || data.data || []'), 'staff form should accept both clubs response shapes');
assert.ok(staffSubmit.includes('readJsonResponse'), 'staff form should surface backend JSON/non-JSON errors');
assert.ok(staffSubmit.includes('服务器返回了非 JSON 响应'), 'staff form should not collapse PHP errors into a generic network message');

const audit = read('admin/Galonly_audit.html');
assert.ok(audit.includes('list_staff_applications'), 'audit page should load staff applications');
assert.ok(audit.includes('data-field="staff_registration_open"'), 'audit page should expose staff registration switch');
assert.ok(audit.includes('currentUser = data.user || data'), 'audit page should normalize auth response');

console.log('Replacement delivery contract checks passed.');
