<?php
// api/toggle_visibility.php - 切换俱乐部公开可见性
// 负责人/管理员可以设置俱乐部的 info 是否默认公开

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
    exit();
}

$user = requireLogin();
$input = json_decode(file_get_contents('php://input'), true);
$clubId = (int)($input['club_id'] ?? 0);
$country = $input['country'] ?? 'china';
$visible = !empty($input['visible']);

if (!$clubId) {
    echo json_encode(['success' => false, 'message' => '无效的俱乐部 ID']);
    exit();
}

// 权限检查：超级管理员可直接操作，负责人/管理员需验证俱乐部归属
$userRole = $user['role'];
if ($userRole !== 'super_admin') {
    $db = getDB();
    $stmt = $db->prepare(
        "SELECT id FROM club_memberships WHERE user_id = ? AND club_id = ? AND role IN ('representative', 'manager') AND status = 'active'"
    );
    $stmt->execute([$user['id'], $clubId]);
    if (!$stmt->fetch()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '权限不足']);
        exit();
    }
}

// 确定数据文件
$dataFile = $country === 'japan'
    ? __DIR__ . '/../data/clubs_japan.json'
    : __DIR__ . '/../data/clubs.json';

if (!file_exists($dataFile)) {
    echo json_encode(['success' => false, 'message' => '数据文件不存在']);
    exit();
}

$json = json_decode(file_get_contents($dataFile), true);
$rows = &$json['data'];
$found = false;

foreach ($rows as &$item) {
    if (($item['id'] ?? 0) == $clubId) {
        $item['visible_by_default'] = $visible;
        $found = true;
        break;
    }
}
unset($item);

if (!$found) {
    echo json_encode(['success' => false, 'message' => '未找到该俱乐部']);
    exit();
}

file_put_contents($dataFile, json_encode($json, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

logAction('club.toggle_visibility', 'club', $clubId, [
    'visible_by_default' => $visible,
    'country' => $country,
]);

echo json_encode([
    'success' => true,
    'message' => $visible ? '联系方式已设为公开' : '联系方式已设为隐藏',
    'visible_by_default' => $visible,
]);
