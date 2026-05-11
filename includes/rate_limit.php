<?php
// includes/rate_limit.php - IP 限流
require_once __DIR__ . '/db.php';

function checkRateLimit(string $endpoint, int $maxHits = 60, int $windowMinutes = 1): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $db = getDB();

    // 清理过期窗口（PHP 计算时间，兼容 SQLite 和 MySQL）
    $cutoff = date('Y-m-d H:i:s', time() - $windowMinutes * 60);
    $stmt = $db->prepare("DELETE FROM rate_limits WHERE window_start < ?");
    $stmt->execute([$cutoff]);

    $stmt = $db->prepare(
        "SELECT hit_count, window_start FROM rate_limits WHERE ip_address = ? AND endpoint = ?"
    );
    $stmt->execute([$ip, $endpoint]);
    $row = $stmt->fetch();

    if ($row) {
        $windowStart = strtotime($row['window_start']);
        $now = time();

        if (($now - $windowStart) < $windowMinutes * 60) {
            if ($row['hit_count'] >= $maxHits) {
                http_response_code(429);
                echo json_encode(['success' => false, 'message' => '请求过于频繁，请稍后再试']);
                exit();
            }
            $db->prepare(
                "UPDATE rate_limits SET hit_count = hit_count + 1 WHERE ip_address = ? AND endpoint = ?"
            )->execute([$ip, $endpoint]);
        } else {
            // 窗口过期，重置
            $db->prepare(
                "UPDATE rate_limits SET hit_count = 1, window_start = CURRENT_TIMESTAMP WHERE ip_address = ? AND endpoint = ?"
            )->execute([$ip, $endpoint]);
        }
    } else {
        $db->prepare(
            "INSERT INTO rate_limits (ip_address, endpoint, hit_count) VALUES (?, ?, 1)"
        )->execute([$ip, $endpoint]);
    }
}
