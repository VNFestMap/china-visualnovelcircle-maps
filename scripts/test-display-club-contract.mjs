import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const authApi = read('api/auth.php');
const membershipApi = read('api/membership.php');
const authInclude = read('includes/auth.php');
const displayHelper = read('includes/display_club.php');
const migrate = read('scripts/migrate.php');
const userSource = read('user-v2-react/src/App.jsx');
const userHtml = read('user.html');
const userPackage = read('user-v2-react/package.json');

assert.match(migrate, /display_membership_id INT NULL/);
assert.match(migrate, /display_membership_id INTEGER/);
assert.match(migrate, /idx_users_display_membership/);
assert.match(authInclude, /u\.display_membership_id/);
assert.match(authApi, /case 'update_display_club'/);
assert.match(authApi, /displayClubSelectableMembership/);
assert.match(authApi, /authRequireSameOrigin/);
assert.match(authApi, /'old' => displayClubMembershipKey/);
assert.match(authApi, /'new' => displayClubMembershipKey/);
assert.match(authApi, /'display_club' => \$displayClub/);
assert.match(authApi, /SELECT id, club_id, country, role, status FROM club_memberships/);
for (const role of ['member', 'manager', 'representative']) assert.ok(displayHelper.includes(`'${role}'`));
assert.ok(displayHelper.includes("['china', 'japan']"));
assert.match(displayHelper, /cm\.id = u\.display_membership_id AND cm\.user_id = u\.id/);
for (const lifecycle of ['membership.reapply', 'membership.leave', 'membership.kick']) {
  const index = membershipApi.indexOf(lifecycle);
  assert.ok(index >= 0, `${lifecycle} lifecycle is missing`);
  const window = membershipApi.slice(Math.max(0, index - 1800), index + 600);
  assert.match(window, /displayClubClearSelection/);
}
assert.match(userSource, /代表同好会/);
assert.match(userSource, /saveDisplayClub/);
assert.match(userSource, /display_membership_id/);
assert.match(userSource, /DisplayClubTag/);
assert.match(userSource, /clubDirectoryAvailability/);
assert.match(userPackage, /sync-user-v2-assets\.mjs/);
assert.ok(fs.existsSync('scripts/sync-user-v2-assets.mjs'), 'user-center asset sync script is missing');
const jsAsset = userHtml.match(/src="\.\/(user-v2-assets\/[^\"]+\.js)"/)?.[1];
const cssAsset = userHtml.match(/href="\.\/(user-v2-assets\/[^\"]+\.css)"/)?.[1];
assert.ok(jsAsset && fs.existsSync(jsAsset), 'built user-center JavaScript asset is missing');
assert.ok(cssAsset && fs.existsSync(cssAsset), 'built user-center CSS asset is missing');
const builtJs = read(jsAsset);
const builtCss = read(cssAsset);
assert.ok(builtJs.includes('update_display_club') && builtJs.includes('代表同好会'), 'built user center does not contain display-club behavior');
assert.ok(builtCss.includes('vn-display-club-setting') && builtCss.includes('vn-display-club-tag'), 'built user center does not contain display-club styles');

console.log('display club account, lifecycle, migration, and built-asset contracts passed');
