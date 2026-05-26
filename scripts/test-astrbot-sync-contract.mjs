import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const botApi = read('api/bot.php');
assert.ok(botApi.includes("case 'membership_applications'"), 'bot API should expose membership_applications action');
assert.ok(botApi.includes('function botMembershipApplications'), 'bot API should implement membership application listing');
assert.ok(botApi.includes('botEnsureMembershipApplicationColumns'), 'bot API should self-heal missing membership application columns');
assert.ok(botApi.includes('since_id'), 'membership application API should support since_id');
assert.ok(botApi.includes("order'] ?? 'asc'") && botApi.includes("'DESC'"), 'membership application API should support newest-first ordering');
assert.ok(botApi.includes('club_key'), 'membership application API should support club_key');
assert.ok(botApi.includes("scope'] ?? 'all'"), 'membership application API should support all-scope sync');
assert.ok(botApi.includes('join_method_label'), 'membership application rows should include join method labels');
assert.ok(botApi.includes('role_label'), 'membership application rows should include role labels');
assert.ok(botApi.includes('external_club_name') && botApi.includes('apply_reason'), 'external exchange fields should be exposed');
assert.ok(botApi.includes('pending_memberships_school_no_code'), 'admin summary should split school no-code applications');
assert.ok(botApi.includes('pending_memberships_external_exchange'), 'admin summary should split external exchange applications');
assert.ok(botApi.includes('function botMoeKing') && botApi.includes("row['moe_king']"), 'club detail API should include moe king data');

const plugin = read('astrbot_plugin_galgamemap/main.py');
assert.ok(plugin.includes('v0.2.1'), 'plugin version should be bumped');
assert.ok(plugin.includes('sync_enabled'), 'plugin should read sync_enabled config');
assert.ok(plugin.includes('sync_auto_enable_on_bind'), 'plugin should support auto-enable after binding');
assert.ok(plugin.includes('sync_interval_seconds'), 'plugin should read sync interval config');
assert.ok(plugin.includes('sync_group_bindings'), 'plugin should support club sync bindings');
assert.ok(plugin.includes('super_admin_sync_origins'), 'plugin should support super admin sync origins');
assert.ok(plugin.includes('asyncio.create_task') || plugin.includes('loop.create_task'), 'plugin should start a background sync task');
assert.ok(plugin.includes('async def initialize') && plugin.includes('_ensure_sync_task'), 'plugin should restart the sync task after AstrBot lifecycle initialization');
assert.ok(plugin.includes('membership_applications'), 'plugin should poll membership applications');
assert.ok(plugin.includes('unified_msg_origin'), 'plugin should bind active push targets by unified_msg_origin');
assert.ok(plugin.includes('self.context.send_message'), 'plugin should actively send messages through AstrBot context');
assert.ok(plugin.includes('MessageChain([Plain(text)])') && plugin.includes('candidates.append(text)'), 'plugin should try multiple active-message payload formats');
assert.ok(plugin.includes('def _binding_key') && plugin.includes('disabled_binding_keys'), 'plugin should track sync bindings per club and destination, not just per club');
assert.ok(plugin.includes('def _is_valid_unified_origin') && plugin.includes('invalid unified_msg_origin'), 'plugin should reject invalid active-message sessions before sending');
assert.ok(plugin.includes('_resolve_club_candidates') && plugin.includes('同步搜索'), 'plugin should support Chinese fuzzy sync binding search');
assert.ok(plugin.includes('_exact_club_candidates') && plugin.includes('_sync_check_single_club'), 'plugin should support precise fuzzy binding and single-club sync checks');
assert.ok(plugin.includes('reverse=True') && plugin.includes('sent_ids'), 'plugin should send newest application notifications first without advancing last_seen on partial sends');
assert.ok(plugin.includes('item_signatures') && plugin.includes('_application_signature'), 'plugin should detect changed pending applications, not only new IDs');
assert.ok(plugin.includes('"order": "desc"'), 'plugin should request newest pending applications first');
assert.ok(plugin.includes('"since_id"'), 'plugin should pass since_id to API for incremental sync');
assert.ok(botApi.includes("case 'auto_approve'"), 'bot API should expose auto_approve action for bot-triggered approval');
assert.ok(plugin.includes('auto_approve_on_sync'), 'plugin should support auto_approve_on_sync config');
assert.ok(plugin.includes('"auto_approve"'), 'plugin should call auto_approve endpoint when configured');
assert.ok(plugin.includes('同步开启') && plugin.includes('同步关闭') && plugin.includes('同步配置'), 'plugin should expose runtime sync configuration commands');
assert.ok(plugin.includes('os.replace(tmp_path, path)'), 'plugin should save sync state atomically');
assert.ok(plugin.includes('同步绑定') && plugin.includes('同步超管') && plugin.includes('同步检测') && plugin.includes('同步取消超管'), 'plugin should expose sync owner commands');
assert.ok(plugin.includes('JOIN_METHOD_LABELS') && plugin.includes('ROLE_LABELS'), 'plugin should render join method and role labels');
assert.ok(plugin.includes('萌王') && plugin.includes('moe_king'), 'plugin club detail should render moe king');
assert.ok(plugin.includes('外交成员（IEM）'), 'plugin should render IEM role label');

const schema = read('astrbot_plugin_galgamemap/_conf_schema.json');
const parsedSchema = JSON.parse(schema);
for (const key of [
  'sync_enabled',
  'sync_auto_enable_on_bind',
  'sync_interval_seconds',
  'sync_first_run_silence',
  'sync_group_bindings',
  'super_admin_sync_origins',
  'sync_max_items_per_tick',
  'auto_approve_on_sync',
]) {
  assert.ok(Object.hasOwn(parsedSchema, key), `config schema should include ${key}`);
}

const metadata = read('astrbot_plugin_galgamemap/metadata.yaml');
assert.ok(metadata.includes('v0.2.1'), 'metadata should advertise v0.2.1');
assert.ok(metadata.includes('申请同步') && metadata.includes('IEM') && metadata.includes('萌王') && metadata.includes('中文模糊绑定'), 'metadata should mention the new information surface');

const readme = read('astrbot_plugin_galgamemap/README.md');
assert.ok(readme.includes('同步绑定') && readme.includes('同步超管') && readme.includes('unified_msg_origin'), 'README should document sync commands and active message origin');
assert.ok(readme.includes('/gal地图 同步绑定 北大') && readme.includes('不合法的 session 字符串'), 'README should document fuzzy binding and invalid session recovery');
assert.ok(readme.includes('/gal地图 同步检测 北大'), 'README should document single-club sync check');
assert.ok(readme.includes('membership_applications'), 'README should document the new bot API action');

console.log('astrbot sync contract tests passed');
