import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('scripts/migrate.php');
const authApi = read('api/auth.php');
const authInclude = read('includes/auth.php');

assert.match(migration, /language_preference\s+VARCHAR\(5\)\s+NULL\s+DEFAULT\s+NULL/i,
  'MySQL user schema should include a nullable language preference');
assert.match(migration, /ALTER TABLE users ADD COLUMN language_preference VARCHAR\(5\) NULL DEFAULT NULL/i,
  'MySQL migration should add the language preference to existing databases');
assert.match(migration, /language_preference\s+TEXT\s+NULL/i,
  'SQLite user schema should include a nullable language preference');
assert.match(migration, /ALTER TABLE users ADD COLUMN language_preference TEXT NULL/i,
  'SQLite migration should add the language preference to existing databases');

assert.match(authInclude, /u\.language_preference/,
  'authenticated user lookup should request the account language');
assert.match(authInclude, /\['zh', 'ja'\]/,
  'authenticated user lookup should normalize the allowed language values');
assert.ok((authInclude.match(/'u\.id, u\.username/g) || []).length > 1,
  'authenticated user lookup should retain query fallbacks for old databases');

assert.match(authApi, /'language_preference'\s*=>/,
  'publicAuthUser should expose the account language');
assert.match(authApi, /case 'update_language_preference':/,
  'auth API should expose the account language update action');
assert.match(authApi, /\$_SERVER\['REQUEST_METHOD'\]\s*!==\s*'POST'/,
  'language update should only accept POST');
assert.match(authApi, /authRequireSameOrigin\(\);[\s\S]*?\$user\s*=\s*requireLogin\(\);/,
  'language update should enforce same-origin and login checks');
assert.match(authApi, /in_array\(\$language, \['zh', 'ja'\], true\)/,
  'language update should only accept zh and ja');
assert.match(authApi, /http_response_code\(422\)/,
  'invalid language values should return HTTP 422');
assert.match(authApi, /SET language_preference = \?, updated_at = CURRENT_TIMESTAMP/,
  'language update should persist the value and update the timestamp');
assert.match(authApi, /logAction\('user\.update_language_preference'/,
  'language update should write an operation log');

console.log('language account contract checks passed');
