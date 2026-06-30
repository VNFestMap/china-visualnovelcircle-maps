import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const listPage = readFileSync(new URL('../Galgame_events/galgameonly_list.html', import.meta.url), 'utf8');
const staffPage = readFileSync(new URL('../Galgame_events/Shanghai_Galonly_staff.html', import.meta.url), 'utf8');
const staffApi = readFileSync(new URL('../api/galonly_staff.php', import.meta.url), 'utf8');
const galonlyApi = readFileSync(new URL('../api/galonly.php', import.meta.url), 'utf8');
const auditPage = readFileSync(new URL('../admin/Galonly_audit.html', import.meta.url), 'utf8');
const migrate = readFileSync(new URL('../scripts/migrate.php', import.meta.url), 'utf8');

assert.match(listPage, /Shanghai_Galonly_staff\.html\?event_id=/, 'event list should expose staff application entry per event');
assert.match(listPage, /user_staff_application_status/, 'event list should render current user staff application status');
assert.match(listPage, /GalOnly 活动申请通道/, 'event list copy should no longer be booth-only');
assert.match(listPage, /\.event-footer\s*\{[^}]*grid-template-columns:\s*1fr;/s, 'event list should stack booth and staff application lanes vertically');
assert.match(listPage, /application-lane-title">摊位申请/, 'event list should render a booth application lane');
assert.match(listPage, /application-lane-title">工作人员申请/, 'event list should render a staff application lane');

assert.match(staffPage, /api\/galonly_staff\.php\?action=submit/, 'staff page should submit to the staff API');
assert.match(staffPage, /preferred_roles/, 'staff page should collect preferred staff roles');

assert.match(staffApi, /CREATE TABLE IF NOT EXISTS galonly_staff_applications/, 'staff API should ensure its table exists');
assert.match(staffApi, /CREATE TABLE IF NOT EXISTS galonly_staff_votes/, 'staff API should ensure its vote table exists');
assert.match(staffApi, /case 'submit':/, 'staff API should expose submit action');
assert.match(staffApi, /case 'list_applications':/, 'staff API should expose reviewer listing action');
assert.match(staffApi, /case 'vote':/, 'staff API should expose vote action');
assert.match(staffApi, /case 'withdraw_vote':/, 'staff API should expose withdraw vote action');
assert.match(staffApi, /galonlyStaffStatusFromVotes/, 'staff API should resolve status from vote thresholds');
assert.match(staffApi, /hasAuditPermission/, 'reviewer-only staff actions should require audit permission');

assert.match(galonlyApi, /galonlyAttachStaffApplications/, 'GalOnly event API should attach staff application state');
assert.match(galonlyApi, /user_staff_application_id/, 'GalOnly event API should include staff application id');

assert.match(auditPage, /id="applicationTypeTabs"/, 'audit page should expose application type tabs');
assert.match(auditPage, /data-type="booth">摊位申请/, 'audit page should include booth review type');
assert.match(auditPage, /data-type="staff">工作人员申请/, 'audit page should include staff review type');
assert.match(auditPage, /applicationApiUrl\('list_applications'\)/, 'audit page should load applications through type-aware API');
assert.match(auditPage, /applicationApiUrl\('vote'\)/, 'audit page should vote through type-aware API');
assert.match(auditPage, /applicationApiUrl\('withdraw_vote'\)/, 'audit page should withdraw votes through type-aware API');
assert.match(auditPage, /function renderStaffAppCard/, 'audit page should render staff application cards separately');

const tableMentions = migrate.match(/CREATE TABLE IF NOT EXISTS galonly_staff_applications/g) || [];
assert.equal(tableMentions.length, 2, 'migrations should create staff application table for MySQL and SQLite');
const voteTableMentions = migrate.match(/CREATE TABLE IF NOT EXISTS galonly_staff_votes/g) || [];
assert.equal(voteTableMentions.length, 2, 'migrations should create staff vote table for MySQL and SQLite');

console.log('galonly staff contract ok');
