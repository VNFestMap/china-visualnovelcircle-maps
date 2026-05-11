<?php
// includes/audit.php - 审计日志
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

function logAction(string $action, ?string $targetType = null, ?int $targetId = null, ?array $details = null): void {
    $user = getCurrentUser();
    $db = getDB();
    $stmt = $db->prepare(
        "INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $user['id'] ?? null,
        $action,
        $targetType,
        $targetId,
        $details ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
        $_SERVER['REMOTE_ADDR'] ?? ''
    ]);
}
