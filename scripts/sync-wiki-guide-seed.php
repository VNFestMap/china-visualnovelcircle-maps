<?php
declare(strict_types=1);

function fail(string $message, int $code = 1): never
{
    fwrite(STDERR, $message . PHP_EOL);
    exit($code);
}

function readJsonFile(string $path, string $label): array
{
    if (!is_file($path)) {
        fail($label . ' does not exist: ' . $path);
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        fail('Unable to read ' . $label . ': ' . $path);
    }
    try {
        $value = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        fail($label . ' contains invalid JSON: ' . $error->getMessage());
    }
    if (!is_array($value)) {
        fail($label . ' must contain a JSON object.');
    }
    return $value;
}

function guideId(string $id): string
{
    $id = trim($id);
    return preg_match('/^[a-z0-9][a-z0-9\/-]{1,100}$/', $id) ? $id : '';
}

function validateSeed(array $seed): array
{
    if (!isset($seed['groups'], $seed['articles']) || !is_array($seed['groups']) || !is_array($seed['articles'])) {
        fail('Guide seed must contain groups and articles arrays.');
    }
    $articles = [];
    foreach ($seed['articles'] as $article) {
        if (!is_array($article)) fail('Guide seed contains an invalid article.');
        $id = guideId((string)($article['id'] ?? ''));
        if ($id === '') fail('Guide seed contains an invalid article ID.');
        if (isset($articles[$id])) fail('Guide seed contains a duplicate article ID: ' . $id);
        if (trim((string)($article['title'] ?? '')) === '' || trim((string)($article['summary'] ?? '')) === '') {
            fail('Guide seed article requires title and summary: ' . $id);
        }
        $articles[$id] = $article;
    }
    foreach ($seed['groups'] as $group) {
        if (!is_array($group) || !is_array($group['articleIds'] ?? null)) fail('Guide seed contains an invalid group.');
        foreach ($group['articleIds'] as $id) {
            if (!isset($articles[(string)$id])) fail('Guide group references an unknown article: ' . (string)$id);
        }
    }
    return $articles;
}

function revision(array $seed): string
{
    return hash('sha256', json_encode($seed, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
}

function backupPath(string $path): string
{
    $base = $path . '.bak-' . date('Ymd-His');
    $candidate = $base;
    $suffix = 1;
    while (file_exists($candidate)) {
        $candidate = $base . '-' . $suffix;
        $suffix += 1;
    }
    return $candidate;
}

function writeJsonWithBackup(string $path, array $value): string
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        fail('Unable to create runtime directory: ' . $directory);
    }
    $backup = '';
    if (is_file($path)) {
        $backup = backupPath($path);
        if (!copy($path, $backup)) fail('Unable to create runtime backup: ' . $backup);
    }
    $json = json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    $temp = tempnam($directory, '.guide-sync-');
    if ($temp === false) fail('Unable to create a temporary runtime file.');
    try {
        if (file_put_contents($temp, $json, LOCK_EX) === false) fail('Unable to write the temporary runtime file.');
        if (!copy($temp, $path)) fail('Unable to replace the guide runtime file.');
    } finally {
        if (is_file($temp)) @unlink($temp);
    }
    return $backup;
}

$options = getopt('', ['lang:', 'root:', 'apply', 'publish-new']);
$language = (string)($options['lang'] ?? '');
if (!in_array($language, ['zh-CN', 'ja-JP'], true)) {
    fail('Usage: php scripts/sync-wiki-guide-seed.php --lang=zh-CN|ja-JP [--root=/path] [--apply --publish-new]', 2);
}
$root = isset($options['root']) ? rtrim((string)$options['root'], "\\/") : dirname(__DIR__);
$apply = array_key_exists('apply', $options);
$publishNew = array_key_exists('publish-new', $options);
$seedPath = $root . '/wiki/guide/seed/' . $language . '/documents.json';
$runtimePath = $root . '/data/wiki-guide/' . $language . '/documents.json';

$seed = readJsonFile($seedPath, 'Guide seed');
$seedArticles = validateSeed($seed);
$seedRevision = revision($seed);
if (is_file($runtimePath)) {
    $runtime = readJsonFile($runtimePath, 'Guide runtime');
    if (!isset($runtime['articles']) || !is_array($runtime['articles'])) fail('Guide runtime must contain an articles object.');
} else {
    $runtime = ['version' => 1, 'seedRevision' => '', 'groups' => [], 'articles' => []];
}

$existingIds = array_keys($runtime['articles']);
$addedIds = array_values(array_diff(array_keys($seedArticles), $existingIds));
$groupsChanged = json_encode($runtime['groups'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !== json_encode($seed['groups'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$revisionChanged = (string)($runtime['seedRevision'] ?? '') !== $seedRevision;
$changed = $groupsChanged || $addedIds !== [] || $revisionChanged;

if ($apply && $addedIds !== [] && !$publishNew) {
    fail('New seed articles were found. Re-run with --publish-new after reviewing the dry-run output.', 3);
}

$backup = null;
if ($apply && $changed) {
    $runtime['version'] = 1;
    $runtime['groups'] = $seed['groups'];
    foreach ($addedIds as $id) {
        $runtime['articles'][$id] = [
            'id' => $id,
            'seedRevision' => $seedRevision,
            'status' => 'published',
            'draft' => null,
            'published' => $seedArticles[$id],
            'updatedAt' => date(DATE_ATOM),
            'updatedBy' => 0,
        ];
    }
    $runtime['seedRevision'] = $seedRevision;
    $backup = writeJsonWithBackup($runtimePath, $runtime);
}

echo json_encode([
    'success' => true,
    'mode' => $apply ? 'apply' : 'dry-run',
    'language' => $language,
    'changed' => $changed,
    'groupsChanged' => $groupsChanged,
    'addedArticleIds' => $addedIds,
    'preservedArticleCount' => count($existingIds),
    'backup' => $backup,
    'runtimePath' => $runtimePath,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;

