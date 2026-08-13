import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const script = path.join(root, 'scripts', 'sync-wiki-guide-seed.php');
const sourceSeed = JSON.parse(fs.readFileSync(path.join(root, 'wiki', 'guide', 'seed', 'zh-CN', 'documents.json'), 'utf8'));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vnfest-guide-sync-'));
const seedPath = path.join(tempRoot, 'wiki', 'guide', 'seed', 'zh-CN', 'documents.json');
const runtimePath = path.join(tempRoot, 'data', 'wiki-guide', 'zh-CN', 'documents.json');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function run(...args) {
  return spawnSync('php', [script, '--lang=zh-CN', `--root=${tempRoot}`, ...args], { encoding: 'utf8' });
}

try {
  writeJson(seedPath, sourceSeed);
  const originalGroups = sourceSeed.groups.slice(0, -1);
  const originalArticles = sourceSeed.articles.slice(0, 11);
  const runtimeArticles = Object.fromEntries(originalArticles.map((article, index) => [article.id, {
    id: article.id,
    seedRevision: 'existing-revision',
    status: 'published',
    draft: index === 0 ? { ...article, title: '保留的运营草稿' } : null,
    published: index === 0 ? { ...article, title: '保留的线上标题' } : article,
    updatedAt: '2026-08-01T00:00:00+08:00',
    updatedBy: 42,
  }]));
  const originalRuntime = { version: 1, seedRevision: 'existing-revision', groups: originalGroups, articles: runtimeArticles };
  writeJson(runtimePath, originalRuntime);
  const originalBytes = fs.readFileSync(runtimePath, 'utf8');

  const dryRun = run();
  assert.equal(dryRun.status, 0, dryRun.stderr);
  const dryResult = JSON.parse(dryRun.stdout);
  assert.equal(dryResult.mode, 'dry-run');
  assert.equal(dryResult.groupsChanged, true);
  assert.deepEqual(dryResult.addedArticleIds, sourceSeed.articles.slice(11).map(article => article.id));
  assert.equal(fs.readFileSync(runtimePath, 'utf8'), originalBytes, 'dry-run must not modify runtime data');

  const apply = run('--apply', '--publish-new');
  assert.equal(apply.status, 0, apply.stderr);
  const applyResult = JSON.parse(apply.stdout);
  assert.equal(applyResult.mode, 'apply');
  assert.ok(applyResult.backup && fs.existsSync(applyResult.backup), 'apply must create a readable backup');
  const merged = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
  assert.deepEqual(merged.groups, sourceSeed.groups, 'apply must synchronize guide groups');
  assert.deepEqual(merged.articles[originalArticles[0].id], originalRuntime.articles[originalArticles[0].id], 'existing published and draft records must be preserved');
  for (const article of sourceSeed.articles.slice(11)) {
    assert.equal(merged.articles[article.id].status, 'published', `${article.id} must be published`);
    assert.deepEqual(merged.articles[article.id].published, article, `${article.id} must use the seed article`);
  }

  const backupCount = fs.readdirSync(path.dirname(runtimePath)).filter(name => name.includes('.bak-')).length;
  const secondApply = run('--apply', '--publish-new');
  assert.equal(secondApply.status, 0, secondApply.stderr);
  const secondResult = JSON.parse(secondApply.stdout);
  assert.equal(secondResult.changed, false, 'second apply must be idempotent');
  assert.equal(fs.readdirSync(path.dirname(runtimePath)).filter(name => name.includes('.bak-')).length, backupCount, 'idempotent apply must not create another backup');

  fs.writeFileSync(seedPath, '{ invalid json', 'utf8');
  const beforeInvalidRun = fs.readFileSync(runtimePath, 'utf8');
  const invalid = run('--apply', '--publish-new');
  assert.notEqual(invalid.status, 0, 'invalid seed must fail');
  assert.equal(fs.readFileSync(runtimePath, 'utf8'), beforeInvalidRun, 'invalid seed must not alter runtime data');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('wiki guide seed sync tests passed');

