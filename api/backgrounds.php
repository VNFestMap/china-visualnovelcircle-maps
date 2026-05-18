<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dir = realpath(__DIR__ . '/../image/background');
$root = realpath(__DIR__ . '/..');
$allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

if (!$dir || !$root || strpos($dir, $root) !== 0 || !is_dir($dir)) {
    echo json_encode(['success' => true, 'images' => []], JSON_UNESCAPED_UNICODE);
    exit();
}

$images = [];
$files = scandir($dir);
foreach ($files as $file) {
    if ($file === '.' || $file === '..') continue;
    $path = $dir . DIRECTORY_SEPARATOR . $file;
    if (!is_file($path)) continue;

    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowed, true)) continue;

    $images[] = [
        'name' => pathinfo($file, PATHINFO_FILENAME),
        'file' => $file,
        'url' => 'image/background/' . rawurlencode($file),
        'mtime' => filemtime($path) ?: 0,
    ];
}

usort($images, function ($a, $b) {
    if ($a['mtime'] === $b['mtime']) {
        return strcmp($a['file'], $b['file']);
    }
    return $b['mtime'] <=> $a['mtime'];
});

echo json_encode(['success' => true, 'images' => $images], JSON_UNESCAPED_UNICODE);
