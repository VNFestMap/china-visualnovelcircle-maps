<?php
// api/bangumi_v0_search.php — Bangumi v0 搜索 Demo 后端
// 测试完成后可直接删除

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$keyword = trim($_GET['keyword'] ?? '');
$limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));

if ($keyword === '') {
    echo json_encode(['success' => false, 'message' => '请输入关键词']);
    exit();
}

// 使用与 bgmFetch 完全一致的方式请求
$url = 'https://api.bgm.tv/v0/search/subjects';
$params = http_build_query(['limit' => $limit]);
$urlWithParams = $url . '?' . $params;

$httpOpts = [
    'method' => 'POST',
    'timeout' => 10,
    'user_agent' => 'VNFest/1.0 (https://map.vnfest.top; contact@vnfest.top)',
    'ignore_errors' => true,
];

$headers = [];
$headers[] = 'Content-Type: application/json';
$httpOpts['content'] = json_encode([
    'keyword' => $keyword,
    'filter' => ['type' => [4]],
    'sort' => 'rank',
], JSON_UNESCAPED_UNICODE);

if (!empty($headers)) {
    $httpOpts['header'] = implode("\r\n", $headers) . "\r\n";
}

$context = stream_context_create(['http' => $httpOpts]);
$raw = @file_get_contents($urlWithParams, false, $context);

if ($raw === false) {
    $error = error_get_last();
    echo json_encode([
        'success' => false,
        'message' => 'Bangumi API request failed',
        'debug' => $error['message'] ?? 'unknown error',
        'url' => $urlWithParams,
    ]);
    exit();
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    echo json_encode(['success' => false, 'message' => 'JSON parse failed', 'raw' => substr($raw, 0, 500)]);
    exit();
}

$items = $data['data'] ?? [];
$total = $data['total'] ?? count($items);
$results = [];

foreach ($items as $item) {
    if (!is_array($item)) continue;
    $rating = $item['rating'] ?? [];
    $images = $item['images'] ?? [];

    $imgUrl = $images['medium'] ?? $images['large'] ?? $images['small'] ?? $images['grid'] ?? $images['common'] ?? '';
    if ($imgUrl !== '') {
        $imgUrl = '/api/image_proxy.php?url=' . urlencode($imgUrl);
    }

    $results[] = [
        'bangumi_id' => (int)$item['id'],
        'title'      => $item['name'] ?? '',
        'title_cn'   => $item['name_cn'] ?? '',
        'image_url'  => $imgUrl,
        'rating'     => $rating['score'] ?? 0,
        'rating_total' => $rating['total'] ?? 0,
        'summary'    => function_exists('mb_substr')
                        ? mb_substr($item['summary'] ?? '', 0, 240)
                        : substr($item['summary'] ?? '', 0, 240),
        'date'       => $item['date'] ?? '',
        'tags'       => $item['tags'] ?? [],
        'rank'       => $item['rank'] ?? 0,
    ];
}

echo json_encode([
    'success' => true,
    'total'   => $total,
    'data'    => $results,
    '_api'    => 'POST /v0/search/subjects',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
