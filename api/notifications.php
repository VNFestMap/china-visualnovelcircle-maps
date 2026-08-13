<?php
// api/notifications.php - 通知系统 API
// 动作: list, count_unread, mark_read, mark_all_read

header('Content-Type: application/json; charset=utf-8');
// 通知未读数会被主站定期拉取；禁止客户端和中间缓存复用旧响应。
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../includes/auth.php';

$action = $_GET['action'] ?? '';

$nowExpr = DB_DRIVER === 'mysql' ? 'NOW()' : "datetime('now')";

function getUnreadNotificationCount(PDO $db, int $userId): int {
    $stmt = $db->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND is_read = 0');
    $stmt->execute([':uid' => $userId]);
    return (int)$stmt->fetchColumn();
}

switch ($action) {
    case 'list':
        // GET /api/notifications.php?action=list&page=1&limit=20
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            echo json_encode(['success' => false, 'message' => '仅支持 GET 请求'], JSON_UNESCAPED_UNICODE);
            exit();
        }
        $user = requireLogin();
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = max(1, min(100, intval($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $db = getDB();

        // 总数
        $countStmt = $db->prepare("SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = :uid");
        $countStmt->execute([':uid' => $user['id']]);
        $total = intval($countStmt->fetchColumn());

        // 未读数
        $unreadCount = getUnreadNotificationCount($db, (int)$user['id']);

        // 列表
        $stmt = $db->prepare("
            SELECT id, type, title, message, link, related_type, related_id, is_read, created_at
            FROM notifications
            WHERE user_id = :uid
            ORDER BY created_at DESC
            LIMIT :lim OFFSET :off
        ");
        $stmt->bindValue(':uid', $user['id'], PDO::PARAM_INT);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $notifications = $stmt->fetchAll();
        // 确保 is_read 是整数，避免 JS 中 "0" 被当作 truthy
        $notifications = array_map(function ($n) {
            $n['is_read'] = (int)$n['is_read'];
            return $n;
        }, $notifications);

        echo json_encode([
            'success'      => true,
            'notifications' => $notifications,
            'unread_count'  => $unreadCount,
            'total'         => $total,
            'page'          => $page,
            'limit'         => $limit,
            'total_pages'  => max(1, ceil($total / $limit)),
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'count_unread':
        // GET /api/notifications.php?action=count_unread
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            echo json_encode(['success' => false, 'message' => '仅支持 GET 请求'], JSON_UNESCAPED_UNICODE);
            exit();
        }
        $user = requireLogin();
        $db = getDB();
        $count = getUnreadNotificationCount($db, (int)$user['id']);

        echo json_encode(['success' => true, 'count' => $count]);
        break;

    case 'mark_read':
        // POST /api/notifications.php?action=mark_read  body: { id: N }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求'], JSON_UNESCAPED_UNICODE);
            exit();
        }
        $user = requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        $notifId = intval($input['id'] ?? 0);

        if ($notifId <= 0) {
            echo json_encode(['success' => false, 'message' => '无效的通知 ID'], JSON_UNESCAPED_UNICODE);
            exit();
        }

        $db = getDB();
        $stmt = $db->prepare("UPDATE notifications SET is_read = 1, read_at = {$nowExpr} WHERE id = :id AND user_id = :uid");
        $stmt->execute([':id' => $notifId, ':uid' => $user['id']]);
        $unreadCount = getUnreadNotificationCount($db, (int)$user['id']);

        echo json_encode(['success' => true, 'unread_count' => $unreadCount]);
        break;

    case 'mark_all_read':
        // POST /api/notifications.php?action=mark_all_read  body: {}
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求'], JSON_UNESCAPED_UNICODE);
            exit();
        }
        $user = requireLogin();
        $db = getDB();
        $stmt = $db->prepare("UPDATE notifications SET is_read = 1, read_at = {$nowExpr} WHERE user_id = :uid AND is_read = 0");
        $stmt->execute([':uid' => $user['id']]);
        $unreadCount = getUnreadNotificationCount($db, (int)$user['id']);

        echo json_encode(['success' => true, 'unread_count' => $unreadCount]);
        break;

    default:
        echo json_encode(['success' => false, 'message' => '未知操作'], JSON_UNESCAPED_UNICODE);
        break;
}
