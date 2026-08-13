<?php
/**
 * api/quiz_auth.php - Makoquiz（答题游戏）跨站身份共享端点
 *
 * 模式与 narrative_auth.php 相同：makoquiz 前端带着浏览器 cookie
 * 直连本端点，认到本站登录态就返回公开身份资料。
 *
 * 与 narrative_auth 的差别：多发一个 bind_token ——
 * 用 QUIZ_LINK_SECRET 对身份资料做 HMAC 签名，makoquiz 服务端验签后
 * 才承认玩家“绑定了 VNFestmap 账号”，防止前端伪造他人身份入场。
 *
 * 注意：Access-Control-Allow-Origin 必须按白名单回显（带 credentials 时
 * 浏览器不接受 *）；本地开发把 http://localhost:3000 也放进白名单。
 */

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originAllowed = $origin === 'https://makoquiz.vnfest.top'
    || (bool)preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin);
if ($originAllowed) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, max-age=300');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../includes/auth.php';

$user = getCurrentUser();

if (!$user) {
    echo json_encode(['ok' => false, 'user' => null]);
    exit;
}

$public = [
    'id' => (int)($user['id'] ?? 0),
    'username' => $user['username'] ?? '',
    'nickname' => ($user['nickname'] ?? '') ?: ($user['username'] ?? ''),
    'avatar_url' => (function($url) {
        if (!$url) return null;
        // DB 里存的可能是相对路径 data/avatars/7.png，补全成绝对 URL
        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) return $url;
        $base = defined('SITE_URL') ? rtrim(SITE_URL, '/') : '';
        return $base ? $base . '/' . ltrim($url, '/') : $url;
    })($user['avatar_url'] ?? null),
    'role' => $user['role'] ?? 'visitor',
];

// 查询用户在所有活跃社团中的最高角色（给 makoquiz 管理后台做权限判断用）
$teamInfo = ['is_member' => false, 'role' => null];
try {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT role FROM club_memberships
        WHERE user_id = ? AND status = 'active'
        ORDER BY CASE role
            WHEN 'representative' THEN 3
            WHEN 'manager' THEN 2
            WHEN 'member' THEN 1
            WHEN 'external' THEN 0
            ELSE 0
        END DESC
        LIMIT 1
    ");
    $stmt->execute([$public['id']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $teamInfo = ['is_member' => true, 'role' => $row['role']];
    }
} catch (\Exception $e) {
    // 查询失败不阻断基础认证，makoquiz 侧会降级处理
}
$public['team'] = $teamInfo;

// bind_token：base64url(payload) + '.' + HMAC-SHA256，7 天有效
$bindToken = null;
if (defined('QUIZ_LINK_SECRET') && QUIZ_LINK_SECRET) {
    $payload = [
        'uid' => $public['id'],
        'username' => $public['username'],
        'nickname' => $public['nickname'],
        'avatar_url' => $public['avatar_url'],
        'team' => $public['team'],
        'exp' => time() + 7 * 24 * 3600,
    ];
    $b64 = rtrim(strtr(base64_encode(json_encode($payload, JSON_UNESCAPED_UNICODE)), '+/', '-_'), '=');
    $sig = hash_hmac('sha256', $b64, QUIZ_LINK_SECRET);
    $bindToken = $b64 . '.' . $sig;
}

echo json_encode([
    'ok' => true,
    'user' => $public,
    'bind_token' => $bindToken,
]);
