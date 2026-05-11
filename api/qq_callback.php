<?php
// api/qq_callback.php - QQ OAuth 回调处理
// 支持 login 和 bind 两种模式

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/oauth_qq.php';
require_once __DIR__ . '/../includes/audit.php';

initSession();

$code = $_GET['code'] ?? '';
$state = $_GET['state'] ?? '';

if (!$code || !$state) {
    header('Location: ../index.html?oauth=error&message=缺少参数');
    exit();
}

// 处理回调，获取 QQ 用户信息
$qqUser = qq_handle_callback($code, $state);
if (!$qqUser) {
    header('Location: ../index.html?oauth=error&message=QQ授权失败');
    exit();
}

$mode = $_SESSION['oauth_mode'] ?? 'login';
unset($_SESSION['oauth_mode']);

$db = getDB();

if ($mode === 'bind') {
    // 绑定模式：需要已登录
    $currentUser = getCurrentUser();
    if (!$currentUser) {
        header('Location: ../index.html?oauth=error&message=请先登录再绑定QQ');
        exit();
    }

    // 检查 QQ 是否已被其他账号绑定
    $stmt = $db->prepare('SELECT id FROM users WHERE qq_openid = ? AND id != ?');
    $stmt->execute([$qqUser['openid'], $currentUser['id']]);
    if ($stmt->fetch()) {
        header('Location: ../index.html?oauth=error&message=该QQ已被其他账号绑定');
        exit();
    }

    $db->prepare("UPDATE users SET qq_openid = ?, qq_unionid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        ->execute([$qqUser['openid'], $qqUser['unionid'] ?? '', $currentUser['id']]);

    logAction('user.bind_qq', 'user', $currentUser['id'], ['provider' => 'qq_callback']);
    header('Location: ../index.html?oauth=success&message=QQ绑定成功');
    exit();
}

// 登录模式：查找或创建用户
$stmt = $db->prepare('SELECT * FROM users WHERE qq_openid = ? AND status = \'active\'');
$stmt->execute([$qqUser['openid']]);
$user = $stmt->fetch();

if (!$user) {
    // 创建新用户
    $baseUsername = preg_replace('/[^a-zA-Z0-9_\x{4e00}-\x{9fff}]/u', '', $qqUser['username']);
    if (mb_strlen($baseUsername) < 2) $baseUsername = 'qq_' . substr($qqUser['openid'], 0, 8);
    $username = $baseUsername;
    $suffix = 1;
    while (true) {
        $stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$username]);
        if (!$stmt->fetch()) break;
        $username = $baseUsername . $suffix;
        $suffix++;
    }

    $stmt = $db->prepare(
        "INSERT INTO users (username, nickname, password_hash, qq_openid, qq_unionid, role, status, avatar_url, created_at, updated_at, last_login_at)
         VALUES (?, ?, '', ?, ?, 'visitor', 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    );
    $stmt->execute([$username, $qqUser['username'], $qqUser['openid'], $qqUser['unionid'] ?? '', $qqUser['avatar_url']]);
    $userId = $db->lastInsertId();

    createSession($userId);
    logAction('user.register', 'user', $userId, ['provider' => 'qq']);
    header('Location: ../index.html?oauth=success&message=QQ登录成功');
    exit();
}

// 已有用户，直接登录
createSession($user['id']);
$db->prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$user['id']]);
logAction('user.login', 'user', $user['id'], ['provider' => 'qq']);
header('Location: ../index.html?oauth=success&message=QQ登录成功');
exit();
