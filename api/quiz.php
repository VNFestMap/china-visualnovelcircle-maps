<?php
/**
 * api/quiz.php - Makoquiz 答题游戏战绩回传与查询
 *
 * submit_results: makoquiz 服务端用 Bearer QUIZ_API_KEY 提交一局战绩，
 *   (room_code, vnfest_user_id, ended_at) 已有 UNIQUE 约束，重试/重复提交直接忽略
 * my_results:   已登录用户查询自己的答题记录（预留，用户中心后续接入）
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config.php';

$action = $_GET['action'] ?? '';

switch ($action) {

    // --- makoquiz 服务端提交战绩（Bearer 鉴权） ---
    case 'submit_results':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST']);
            exit;
        }

        // 校验 Bearer token
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/^Bearer\s+(.+)$/', $auth, $m)) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => '未提供 API Key']);
            exit;
        }
        $key = $m[1];
        if (!defined('QUIZ_API_KEY') || QUIZ_API_KEY === '' || !hash_equals(QUIZ_API_KEY, $key)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'API Key 无效']);
            exit;
        }

        $body = json_decode(file_get_contents('php://input'), true);
        if (!$body || empty($body['room_code']) || empty($body['players'])) {
            echo json_encode(['success' => false, 'message' => '缺少 room_code / players']);
            exit;
        }

        $roomCode  = substr((string)$body['room_code'], 0, 16);
        $quizTitle = mb_substr((string)($body['quiz_title'] ?? ''), 0, 255);
        $endedAt   = (int)($body['ended_at'] ?? 0);
        if ($endedAt < 1000000000000) {
            // 防止传秒级时间戳（makoquiz 一定传 ms，但保险起见挡一下）
            $endedAt = $endedAt * 1000;
        }
        $players   = $body['players'] ?? [];
        $total     = count($players);

        $db = getDB();
        $isMysql = defined('DB_DRIVER') && DB_DRIVER === 'mysql';
        $inserted = 0;

        $sql = $isMysql
            ? 'INSERT IGNORE INTO quiz_results (vnfest_user_id, room_code, quiz_title, player_name, score, player_rank, players_count, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            : 'INSERT OR IGNORE INTO quiz_results (vnfest_user_id, room_code, quiz_title, player_name, score, player_rank, players_count, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        $stmt = $db->prepare($sql);

        foreach ($players as $p) {
            $uid = (int)($p['vnfest_id'] ?? 0);
            if ($uid <= 0) continue;

            // 确认这个 user 真实存在，避免塞垃圾外键
            $chk = $db->prepare('SELECT id FROM users WHERE id = ? AND status = ?');
            $chk->execute([$uid, 'active']);
            if (!$chk->fetch()) continue;

            try {
                $stmt->execute([
                    $uid,
                    $roomCode,
                    $quizTitle,
                    mb_substr((string)($p['name'] ?? ''), 0, 64),
                    (int)($p['score'] ?? 0),
                    (int)($p['rank'] ?? 0),
                    $total,
                    $endedAt,
                ]);
                if ($stmt->rowCount() > 0) $inserted++;
            } catch (PDOException $e) {
                // UNIQUE 约束冲突（重复提交 / 重试）——跳过，其他类型的错记日志
                $msg = $e->getMessage();
                if (stripos($msg, 'UNIQUE') === false && stripos($msg, 'duplicate') === false) {
                    error_log('[quiz] insert error: ' . $msg);
                }
            }
        }

        echo json_encode(['success' => true, 'inserted' => $inserted, 'received' => count($players)]);
        break;

    // --- 用户查询自己的答题记录（预留） ---
    case 'my_results':
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            echo json_encode(['success' => false, 'message' => '仅支持 GET']);
            exit;
        }
        $user = requireLogin();
        $db = getDB();
        $stmt = $db->prepare(
            'SELECT room_code, quiz_title, player_name, score, player_rank, players_count, ended_at
             FROM quiz_results
             WHERE vnfest_user_id = ?
             ORDER BY ended_at DESC
             LIMIT 30'
        );
        $stmt->execute([(int)$user['id']]);
        echo json_encode(['success' => true, 'results' => $stmt->fetchAll()]);
        break;

    default:
        echo json_encode(['success' => false, 'message' => '未知操作，可用: submit_results, my_results']);
        break;
}
