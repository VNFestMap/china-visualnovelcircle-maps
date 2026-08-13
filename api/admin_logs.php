<?php
// api/admin_logs.php - 操作日志 API（仅超级管理员可用）
// 动作: list

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';

// 仅超级管理员可访问
$currentUser = requireLogin();
if ($currentUser['role'] !== 'super_admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => '权限不足']);
    exit();
}

$action = $_GET['action'] ?? '';
if ($action !== 'list') {
    echo json_encode(['success' => false, 'message' => '未知动作', 'available_actions' => ['list']]);
    exit();
}

$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = min(200, max(1, (int)($_GET['per_page'] ?? 50)));
$type = trim((string)($_GET['type'] ?? 'all'));
$dateFrom = trim((string)($_GET['date_from'] ?? ''));
$dateTo = trim((string)($_GET['date_to'] ?? ''));
$search = trim((string)($_GET['search'] ?? ''));

$where = [];
$params = [];

// 类型过滤：review / user / club / announce / system
$typeConditions = [
    'review'   => "al.action LIKE 'galonly.%' OR al.action LIKE 'review.%'",
    'user'     => "al.action LIKE 'user.%' OR al.action LIKE 'users.%'",
    'club'     => "al.action LIKE 'membership.%' OR al.action LIKE 'club.%' OR al.action LIKE 'club_moe_king.%' OR al.action LIKE 'star_union.%' OR al.action IN ('generate_club_code','revoke_club_code','redeem_club_code','delete_club_comment','add_recommendation')",
    'announce' => "al.action LIKE 'announcement.%' OR al.action LIKE 'announce.%'",
    'system'   => "al.action NOT LIKE 'galonly.%' AND al.action NOT LIKE 'review.%' AND al.action NOT LIKE 'user.%' AND al.action NOT LIKE 'users.%' AND al.action NOT LIKE 'membership.%' AND al.action NOT LIKE 'club.%' AND al.action NOT LIKE 'club_moe_king.%' AND al.action NOT LIKE 'star_union.%' AND al.action NOT IN ('generate_club_code','revoke_club_code','redeem_club_code','delete_club_comment','add_recommendation') AND al.action NOT LIKE 'announcement.%' AND al.action NOT LIKE 'announce.%'",
];
if ($type !== 'all' && isset($typeConditions[$type])) {
    $where[] = '(' . $typeConditions[$type] . ')';
}
if ($dateFrom !== '') {
    $where[] = 'al.created_at >= ?';
    $params[] = $dateFrom . ' 00:00:00';
}
if ($dateTo !== '') {
    $where[] = 'al.created_at <= ?';
    $params[] = $dateTo . ' 23:59:59';
}
if ($search !== '') {
    $where[] = '(al.action LIKE ? OR u.username LIKE ? OR u.nickname LIKE ? OR al.details LIKE ?)';
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$whereClause = count($where) ? 'WHERE ' . implode(' AND ', $where) : '';

$db = getDB();
$countStmt = $db->prepare(
    "SELECT COUNT(*)
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     $whereClause"
);
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$dataStmt = $db->prepare(
    "SELECT al.id, al.user_id, al.action, al.target_type, al.target_id, al.details, al.ip_address, al.created_at,
            u.username, u.nickname
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     $whereClause
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT ? OFFSET ?"
);
$bindIdx = 1;
foreach ($params as $p) {
    $dataStmt->bindValue($bindIdx++, $p, PDO::PARAM_STR);
}
$dataStmt->bindValue($bindIdx++, $perPage, PDO::PARAM_INT);
$dataStmt->bindValue($bindIdx++, ($page - 1) * $perPage, PDO::PARAM_INT);
$dataStmt->execute();
$logs = $dataStmt->fetchAll();
foreach ($logs as &$l) {
    $l['id'] = (int)$l['id'];
    $l['user_id'] = $l['user_id'] !== null ? (int)$l['user_id'] : null;
    $l['target_id'] = $l['target_id'] !== null ? (int)$l['target_id'] : null;
}
unset($l);

echo json_encode([
    'success' => true,
    'logs' => $logs,
    'total' => $total,
    'page' => $page,
    'per_page' => $perPage,
], JSON_UNESCAPED_UNICODE);
exit();
