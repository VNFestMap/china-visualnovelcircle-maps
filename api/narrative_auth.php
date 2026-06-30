<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://narrative.map.vnfest.top');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../includes/auth.php';

$user = getCurrentUser();

if ($user) {
    $public = publicAuthUser($user);
    echo json_encode([
        'ok' => true,
        'user' => [
            'id' => $public['id'],
            'username' => $public['username'],
            'nickname' => $public['nickname'] ?: $public['username'],
            'avatar_url' => $public['avatar_url'] ?? null,
            'role' => $public['role'] ?? 'visitor',
            'is_audit' => $public['is_audit'] ?? 0
        ]
    ]);
} else {
    echo json_encode(['ok' => false, 'user' => null]);
}
