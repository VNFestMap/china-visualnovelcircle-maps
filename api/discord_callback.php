<?php
// api/discord_callback.php - Discord OAuth 回调处理
// 支持 login 和 bind 两种模式

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/oauth_discord.php';
require_once __DIR__ . '/../includes/audit.php';

initSession();

$code = $_GET['code'] ?? '';
$state = $_GET['state'] ?? '';

if (!$code || !$state) {
    header('Location: ../index.html?oauth=error&message=缺少参数');
    exit();
}

// 处理回调，获取 Discord 用户信息
$discordUser = discord_handle_callback($code, $state);
if (!$discordUser) {
    header('Location: ../index.html?oauth=error&message=Discord授权失败');
    exit();
}

$mode = $_SESSION['oauth_mode'] ?? 'login';
unset($_SESSION['oauth_mode']);

$db = getDB();

if ($mode === 'bind') {
    // 绑定模式：需要已登录
    $currentUser = getCurrentUser();
    if (!$currentUser) {
        header('Location: ../index.html?oauth=error&message=请先登录再绑定Discord');
        exit();
    }

    // 检查 Discord 是否已被其他账号绑定
    $stmt = $db->prepare('SELECT id FROM users WHERE discord_id = ? AND id != ?');
    $stmt->execute([$discordUser['discord_id'], $currentUser['id']]);
    if ($stmt->fetch()) {
        header('Location: ../index.html?oauth=error&message=该Discord已被其他账号绑定');
        exit();
    }

    $db->prepare("UPDATE users SET discord_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        ->execute([$discordUser['discord_id'], $currentUser['id']]);

    logAction('user.bind_discord', 'user', $currentUser['id'], ['provider' => 'discord_callback']);
    header('Location: ../index.html?oauth=success&message=Discord绑定成功');
    exit();
}

// 登录模式：查找或创建用户
$stmt = $db->prepare('SELECT * FROM users WHERE discord_id = ? AND status = \'active\'');
$stmt->execute([$discordUser['discord_id']]);
$user = $stmt->fetch();

if (!$user) {
    // 创建新用户
    $baseUsername = preg_replace('/[^a-zA-Z0-9_\x{4e00}-\x{9fff}]/u', '', $discordUser['username']);
    if (mb_strlen($baseUsername) < 2) $baseUsername = 'discord_' . substr($discordUser['discord_id'], 0, 8);
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
        "INSERT INTO users (username, nickname, password_hash, discord_id, role, status, avatar_url, created_at, updated_at, last_login_at)
         VALUES (?, ?, '', ?, 'visitor', 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    );
    $stmt->execute([$username, $discordUser['username'], $discordUser['discord_id'], $discordUser['avatar_url']]);
    $userId = $db->lastInsertId();

    createSession($userId);
    logAction('user.register', 'user', $userId, ['provider' => 'discord']);
    header('Location: ../index.html?oauth=success&message=Discord登录成功');
    exit();
}

// 已有用户，直接登录
createSession($user['id']);
$db->prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$user['id']]);
logAction('user.login', 'user', $user['id'], ['provider' => 'discord']);
header('Location: ../index.html?oauth=success&message=Discord登录成功');
exit();
