<?php
// api/bangumi_proxy.php - Bangumi API 代理（避免跨域 + 缓存）
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';

// 缓存目录
$cacheDir = __DIR__ . '/../data/cache/bangumi';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

/**
 * 带缓存的 Bangumi API 请求
 */
function bangumiFetch(string $url, string $cacheKey, int $ttl): array
{
    return bangumiRequest('GET', $url, $cacheKey, $ttl);
}

function bangumiRequest(string $method, string $url, string $cacheKey, int $ttl, ?array $body = null): array
{
    $cacheDir = __DIR__ . '/../data/cache/bangumi';
    $cacheFile = $cacheDir . '/' . $cacheKey . '.json';

    // 命中缓存
    if (file_exists($cacheFile) && time() - filemtime($cacheFile) < $ttl) {
        return json_decode(file_get_contents($cacheFile), true) ?: [];
    }

    $headers = "User-Agent: VNFest/1.0\r\n";
    $options = [
        'method' => $method,
        'timeout' => 10,
        'header' => $headers,
    ];
    if ($body !== null) {
        $payload = json_encode($body, JSON_UNESCAPED_UNICODE);
        $options['header'] .= "Content-Type: application/json\r\n";
        $options['content'] = $payload;
    }

    $context = stream_context_create(['http' => $options]);

    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        // 有缓存时返回过期缓存兜底
        if (file_exists($cacheFile)) {
            return json_decode(file_get_contents($cacheFile), true) ?: [];
        }
        return [];
    }

    $data = json_decode($response, true) ?: [];
    file_put_contents($cacheFile, json_encode($data, JSON_UNESCAPED_UNICODE));
    return $data;
}

function bangumiImage(array $item): string {
    $images = $item['images'] ?? [];
    return $images['medium'] ?? $images['grid'] ?? $images['large'] ?? $images['small'] ?? '';
}

function normalizeBangumiCharacter(array $item): array {
    return [
        'character_id' => (int)($item['id'] ?? 0),
        'name' => $item['name'] ?? '',
        'name_cn' => $item['name_cn'] ?? '',
        'image_url' => bangumiImage($item),
        'summary' => (function_exists('mb_substr') ? mb_substr($item['summary'] ?? '', 0, 240) : substr($item['summary'] ?? '', 0, 240)),
        'relation' => $item['relation'] ?? '',
        'type' => $item['type'] ?? '',
    ];
}

// ===== 搜索 =====
if ($action === 'search' || $action === 'search_subject') {
    $keyword = trim($_GET['keyword'] ?? '');
    $type = (int)($_GET['type'] ?? 4); // 默认 Game

    if ($keyword === '') {
        echo json_encode(['success' => false, 'message' => '请输入关键词']);
        exit();
    }

    $cacheKey = 'search_v2_' . md5(strtolower($keyword) . '_' . $type);
    $data = bangumiFetch(
        'https://api.bgm.tv/search/subject/' . urlencode($keyword) . '?type=' . $type . '&responseGroup=large',
        $cacheKey,
        3600 // 搜索缓存 1 小时
    );

    $results = [];
    foreach ($data['list'] ?? [] as $item) {
        $rating = $item['rating'] ?? [];
        $results[] = [
            'bangumi_id' => (int)$item['id'],
            'title'      => $item['name'] ?? '',
            'title_cn'   => $item['name_cn'] ?? '',
            'image_url'  => $item['images']['medium'] ?? $item['images']['large'] ?? '',
            'rating'     => $rating['score'] ?? $item['score'] ?? 0,
            'summary'    => (function_exists('mb_substr') ? mb_substr($item['summary'] ?? '', 0, 200) : substr($item['summary'] ?? '', 0, 200)),
            'air_date'   => $item['air_date'] ?? '',
        ];
    }

    echo json_encode(['success' => true, 'data' => $results], JSON_UNESCAPED_UNICODE);
    exit();
}

// ===== 角色搜索（萌战提名使用）=====
if ($action === 'search_character') {
    $keyword = trim($_GET['keyword'] ?? '');
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    if ($keyword === '') {
        echo json_encode(['success' => false, 'message' => '请输入角色关键词']);
        exit();
    }

    $cacheKey = 'character_search_v0_' . md5(strtolower($keyword) . '_' . $limit . '_' . $offset);
    $data = bangumiRequest(
        'POST',
        'https://api.bgm.tv/v0/search/characters?limit=' . $limit . '&offset=' . $offset,
        $cacheKey,
        3600,
        ['keyword' => $keyword, 'filter' => ['nsfw' => false]]
    );

    $rows = $data['data'] ?? $data['list'] ?? [];
    $results = [];
    foreach ($rows as $item) {
        if (is_array($item)) {
            $results[] = normalizeBangumiCharacter($item);
        }
    }

    echo json_encode([
        'success' => true,
        'total' => (int)($data['total'] ?? count($results)),
        'data' => $results,
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

// ===== 获取作品角色列表（萌战提名主流程）=====
if ($action === 'subject_characters') {
    $subjectId = (int)($_GET['subject_id'] ?? $_GET['id'] ?? 0);
    if ($subjectId <= 0) {
        echo json_encode(['success' => false, 'message' => '无效作品 ID']);
        exit();
    }

    $cacheKey = 'subject_characters_' . $subjectId;
    $data = bangumiFetch(
        'https://api.bgm.tv/v0/subjects/' . $subjectId . '/characters',
        $cacheKey,
        86400
    );

    $results = [];
    foreach ($data ?? [] as $item) {
        if (!is_array($item)) continue;
        $character = $item['character'] ?? $item;
        if (!is_array($character)) continue;
        $normalized = normalizeBangumiCharacter($character);
        $normalized['relation'] = $item['relation'] ?? ($normalized['relation'] ?? '');
        $results[] = $normalized;
    }

    echo json_encode(['success' => true, 'data' => $results], JSON_UNESCAPED_UNICODE);
    exit();
}

// ===== 获取角色详情 =====
if ($action === 'get_character') {
    $id = (int)($_GET['id'] ?? $_GET['character_id'] ?? 0);
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => '无效角色 ID']);
        exit();
    }

    $cacheKey = 'character_' . $id;
    $data = bangumiFetch(
        'https://api.bgm.tv/v0/characters/' . $id,
        $cacheKey,
        86400
    );

    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit();
}

// ===== 获取单个条目详情 =====
if ($action === 'get') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => '无效 ID']);
        exit();
    }

    $cacheKey = 'subject_' . $id;
    $data = bangumiFetch(
        'https://api.bgm.tv/v0/subjects/' . $id,
        $cacheKey,
        86400 // 条目详情缓存 24 小时
    );

    if (empty($data)) {
        // 回退旧版 API
        $data = bangumiFetch(
            'https://api.bgm.tv/subject/' . $id . '?responseGroup=large',
            $cacheKey . '_v0',
            86400
        );
    }

    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode(['success' => false, 'message' => '未知操作 action=' . $action]);
