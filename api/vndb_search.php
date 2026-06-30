<?php
// api/vndb_search.php — VNDB API 搜索 Demo 后端（独立测试文件，可删除）
// 支持 action=vn（作品搜索）和 action=character（角色搜索）

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$action = trim($_GET['action'] ?? 'vn');
$keyword = trim($_GET['keyword'] ?? '');
$limit = max(1, min(30, (int)($_GET['limit'] ?? 12)));

if ($keyword === '') {
    echo json_encode(['success' => false, 'message' => '请输入关键词']);
    exit();
}

if ($action === 'vn') {
    // 作品搜索
    $body = json_encode([
        'filters' => ['search', '=', $keyword],
        'fields' => 'title, aliases, image.url, released, developers.name, description, rating, tags.name',
        'sort' => 'searchrank',
        'results' => $limit,
    ], JSON_UNESCAPED_UNICODE);
    $url = 'https://api.vndb.org/kana/vn';
} elseif ($action === 'character') {
    // 角色搜索
    $body = json_encode([
        'filters' => ['search', '=', $keyword],
        'fields' => 'name, original, aliases, description, image.url, vns.title, vns.id',
        'sort' => 'searchrank',
        'results' => $limit,
    ], JSON_UNESCAPED_UNICODE);
    $url = 'https://api.vndb.org/kana/character';
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
    exit();
}

$httpOpts = [
    'method' => 'POST',
    'timeout' => 10,
    'user_agent' => 'VNFest/1.0 (https://map.vnfest.top; contact@vnfest.top)',
    'ignore_errors' => true,
];

$headers = [];
$headers[] = 'Content-Type: application/json';
$httpOpts['content'] = $body;
if (!empty($headers)) {
    $httpOpts['header'] = implode("\r\n", $headers) . "\r\n";
}

$context = stream_context_create(['http' => $httpOpts]);
$raw = @file_get_contents($url, false, $context);

if ($raw === false) {
    $error = error_get_last();
    echo json_encode([
        'success' => false,
        'message' => 'VNDB API request failed',
        'debug' => $error['message'] ?? 'unknown',
    ]);
    exit();
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    echo json_encode(['success' => false, 'message' => 'JSON parse failed', 'raw' => substr($raw, 0, 500)]);
    exit();
}

$items = $data['results'] ?? [];
$results = [];

foreach ($items as $item) {
    if (!is_array($item)) continue;
    $images = $item['image'] ?? [];

    if ($action === 'vn') {
        $imgUrl = $images['url'] ?? '';
        $developers = $item['developers'] ?? [];
        $tags = $item['tags'] ?? [];
        $results[] = [
            'vndb_id'    => $item['id'] ?? '',
            'title'      => $item['title'] ?? '',
            'title_cn'   => '',
            'aliases'    => $item['aliases'] ?? [],
            'image_url'  => $imgUrl,
            'developers' => array_slice(array_map(fn($d) => $d['name'] ?? '', is_array($developers) ? $developers : []), 0, 3),
            'rating'     => $item['rating'] ?? 0,
            'summary'    => mb_substr($item['description'] ?? '', 0, 240),
            'tags'       => array_slice($tags, 0, 8),
            'released'   => $item['released'] ?? '',
            'url'        => 'https://vndb.org/' . ($item['id'] ?? ''),
        ];
    } else {
        $imgUrl = $images['url'] ?? '';
        $vns = $item['vns'] ?? [];
        $results[] = [
            'vndb_id'    => $item['id'] ?? '',
            'name'       => $item['name'] ?? '',
            'original'   => $item['original'] ?? '',
            'aliases'    => $item['aliases'] ?? [],
            'image_url'  => $imgUrl,
            'summary'    => mb_substr($item['description'] ?? '', 0, 240),
            'vns'        => array_slice($vns, 0, 5),
            'url'        => 'https://vndb.org/' . ($item['id'] ?? ''),
        ];
    }
}

echo json_encode([
    'success' => true,
    'count'   => count($results),
    'data'    => $results,
    '_api'    => $action === 'vn' ? 'POST /kana/vn' : 'POST /kana/character',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
