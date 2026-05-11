<?php
// api/auth.php - 认证端点（本地用户名/密码注册登录）
// 动作: login_local, register_local, logout, me

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/rate_limit.php';
require_once __DIR__ . '/../includes/audit.php';
require_once __DIR__ . '/../includes/mailer.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'register_local':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        checkRateLimit('register_local', 5, 1); // 每分钟最多 5 次注册

        $input = json_decode(file_get_contents('php://input'), true);
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';

        // 验证用户名
        if (!preg_match('/^[a-zA-Z0-9_\x{4e00}-\x{9fff}]{2,20}$/u', $username)) {
            echo json_encode(['success' => false, 'message' => '用户名需为 2-20 位的中文、字母、数字或下划线']);
            exit();
        }
        // 验证密码
        if (strlen($password) < 6 || strlen($password) > 128) {
            echo json_encode(['success' => false, 'message' => '密码需为 6-128 位']);
            exit();
        }

        $db = getDB();

        // 检查重复用户名
        $stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => '用户名已被注册']);
            exit();
        }

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $db->prepare(
            "INSERT INTO users (username, nickname, password_hash, role, status, avatar_url, created_at, updated_at, last_login_at)
             VALUES (?, ?, ?, 'visitor', 'active', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        );
        $stmt->execute([$username, $username, $hash]);
        $userId = $db->lastInsertId();

        createSession($userId);
        logAction('user.register', 'user', $userId, ['provider' => 'local']);

        echo json_encode([
            'success' => true,
            'message' => '注册成功',
            'user' => [
                'id' => (int)$userId,
                'username' => $username,
                'nickname' => $username,
                'avatar_url' => '',
                'role' => 'visitor',
                'email' => '',
                'qq_openid' => '',
                'discord_id' => '',
                'profile_bio' => '',
            ]
        ]);
        exit();

    case 'login_local':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        checkRateLimit('login_local', 10, 1); // 每分钟最多 10 次登录尝试

        $input = json_decode(file_get_contents('php://input'), true);
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';

        if (!$username || !$password) {
            echo json_encode(['success' => false, 'message' => '请输入用户名和密码']);
            exit();
        }

        $db = getDB();

        // 先按用户名查找，再按邮箱查找
        $stmt = $db->prepare('SELECT * FROM users WHERE username = ? AND status = \'active\'');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user) {
            $stmt = $db->prepare('SELECT * FROM users WHERE email = ? AND status = \'active\'');
            $stmt->execute([$username]);
            $user = $stmt->fetch();
        }

        if (!$user || !password_verify($password, $user['password_hash'] ?? '')) {
            echo json_encode(['success' => false, 'message' => '用户名或密码错误']);
            exit();
        }

        // 更新最后登录时间
        $db->prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$user['id']]);

        createSession($user['id']);
        logAction('user.login', 'user', $user['id'], ['provider' => 'local']);

        // 加载绑定信息
        $stmt = $db->prepare("SELECT club_id, role, status FROM club_memberships WHERE user_id = ? AND status = 'active'");
        $stmt->execute([$user['id']]);

        echo json_encode([
            'success' => true,
            'message' => '登录成功',
            'user' => [
                'id' => (int)$user['id'],
                'username' => $user['username'],
                'nickname' => $user['nickname'] ?? $user['username'],
                'avatar_url' => $user['avatar_url'],
                'role' => $user['role'],
                'email' => $user['email'] ?? '',
                'qq_openid' => $user['qq_openid'] ?? '',
                'discord_id' => $user['discord_id'] ?? '',
                'profile_bio' => $user['profile_bio'] ?? '',
                'is_audit' => (int)($user['is_audit'] ?? 0),
            ],
            'memberships' => $stmt->fetchAll(),
        ]);
        exit();

    case 'logout':
        $user = getCurrentUser();
        if ($user) {
            logAction('user.logout', 'user', $user['id']);
        }
        destroySession();
        echo json_encode(['success' => true, 'message' => '已退出登录']);
        exit();

    case 'me':
        $user = getCurrentUser();
        if ($user) {
            // 加载用户绑定信息（兼容 country 列尚未创建的情况）
            $db = getDB();
            $memberships = [];
            try {
                $stmt = $db->prepare(
                    "SELECT club_id, country, role, status FROM club_memberships WHERE user_id = ? AND status = 'active'"
                );
                $stmt->execute([$user['id']]);
                $memberships = $stmt->fetchAll();
            } catch (Exception $e) {
                // country 列不存在时回退
                $stmt = $db->prepare(
                    "SELECT club_id, role, status FROM club_memberships WHERE user_id = ? AND status = 'active'"
                );
                $stmt->execute([$user['id']]);
                $memberships = $stmt->fetchAll();
            }

            echo json_encode([
                'logged_in' => true,
                'user' => [
                    'id' => (int)$user['id'],
                    'username' => $user['username'],
                    'nickname' => $user['nickname'] ?? $user['username'],
                    'avatar_url' => $user['avatar_url'],
                    'role' => $user['role'],
                    'email' => $user['email'] ?? '',
                    'qq_openid' => $user['qq_openid'] ?? '',
                    'discord_id' => $user['discord_id'] ?? '',
                    'profile_bio' => $user['profile_bio'] ?? '',
                    'is_audit' => (int)($user['is_audit'] ?? 0),
                ],
                'memberships' => $memberships,
            ]);
        } else {
            echo json_encode([
                'logged_in' => false,
                'user' => null,
                'memberships' => [],
            ]);
        }
        exit();

    case 'change_password':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $user = requireLogin();
        checkRateLimit('change_password', 3, 1);

        $input = json_decode(file_get_contents('php://input'), true);
        $currentPassword = $input['current_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';

        if (strlen($newPassword) < 6 || strlen($newPassword) > 128) {
            echo json_encode(['success' => false, 'message' => '新密码需为 6-128 位']);
            exit();
        }

        $db = getDB();
        $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $row = $stmt->fetch();

        if (!$row || !password_verify($currentPassword, $row['password_hash'] ?? '')) {
            echo json_encode(['success' => false, 'message' => '当前密码错误']);
            exit();
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$newHash, $user['id']]);

        logAction('user.change_password', 'user', $user['id']);
        echo json_encode(['success' => true, 'message' => '密码修改成功']);
        exit();

    case 'send_code':
        // 发送邮箱验证码
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $user = requireLogin();
        checkRateLimit('send_code', 3, 1); // 每分钟最多 3 次

        $input = json_decode(file_get_contents('php://input'), true);
        $email = trim($input['email'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => '邮箱格式不正确']);
            exit();
        }

        // 检查邮箱唯一性
        $db = getDB();
        $stmt = $db->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
        $stmt->execute([$email, $user['id']]);
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => '该邮箱已被其他账号绑定']);
            exit();
        }

        // 生成 6 位验证码
        $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // 使之前的验证码失效
        $db->prepare("UPDATE email_verifications SET used = 1 WHERE user_id = ? AND email = ? AND used = 0")
            ->execute([$user['id'], $email]);

        // 存储新验证码（5 分钟有效）
        $expiresAt = date('Y-m-d H:i:s', time() + 300);
        $stmt = $db->prepare(
            "INSERT INTO email_verifications (user_id, email, code, expires_at) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([$user['id'], $email, $code, $expiresAt]);

        // 发送邮件
        $subject = ($subjectPrefix ?? '') . '邮箱验证码';
        $message = "您的验证码是：{$code}\n\n";
        $message .= "验证码 5 分钟内有效。如果不是您本人操作，请忽略此邮件。\n";
        $mailSent = sendMail($email, $subject, $message);

        logAction('user.send_code', 'user', $user['id'], ['email' => $email, 'mail_sent' => $mailSent]);

        // 即使邮件发送失败也返回 success（开发环境 mail() 可能不可用）
        echo json_encode([
            'success' => true,
            'message' => '验证码已发送至 ' . $email,
            'debug_code' => $mailSent ? null : $code, // 开发调试用
        ]);
        exit();

    case 'bind_email':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $user = requireLogin();
        checkRateLimit('bind_email', 5, 1);

        $input = json_decode(file_get_contents('php://input'), true);
        $email = trim($input['email'] ?? '');
        $code = trim($input['code'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => '邮箱格式不正确']);
            exit();
        }

        if (!preg_match('/^\d{6}$/', $code)) {
            echo json_encode(['success' => false, 'message' => '验证码格式不正确']);
            exit();
        }

        $db = getDB();

        // 验证验证码
        $stmt = $db->prepare(
            "SELECT id FROM email_verifications WHERE user_id = ? AND email = ? AND code = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP"
        );
        $stmt->execute([$user['id'], $email, $code]);
        $verification = $stmt->fetch();

        if (!$verification) {
            echo json_encode(['success' => false, 'message' => '验证码无效或已过期']);
            exit();
        }

        // 标记验证码已使用
        $db->prepare("UPDATE email_verifications SET used = 1 WHERE id = ?")->execute([$verification['id']]);

        // 检查邮箱唯一性
        $stmt = $db->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
        $stmt->execute([$email, $user['id']]);
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => '该邮箱已被其他账号绑定']);
            exit();
        }

        $db->prepare(
            "UPDATE users SET email = ?, email_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )->execute([$email, $user['id']]);

        logAction('user.bind_email', 'user', $user['id'], ['email' => $email]);
        echo json_encode(['success' => true, 'message' => '邮箱绑定成功', 'email' => $email]);
        exit();

    case 'unbind_email':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $user = requireLogin();

        $db = getDB();
        $db->prepare(
            "UPDATE users SET email = NULL, email_verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )->execute([$user['id']]);

        logAction('user.unbind_email', 'user', $user['id']);
        echo json_encode(['success' => true, 'message' => '邮箱已解绑']);
        exit();

    case 'update_profile':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $user = requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);

        $nickname = isset($input['nickname']) ? trim($input['nickname']) : null;
        $bio = isset($input['profile_bio']) ? trim($input['profile_bio']) : null;

        if ($nickname === null && $bio === null) {
            echo json_encode(['success' => false, 'message' => '没有需要更新的字段']);
            exit();
        }

        // 先验证所有字段，再执行更新
        if ($nickname !== null && (mb_strlen($nickname) < 1 || mb_strlen($nickname) > 30)) {
            echo json_encode(['success' => false, 'message' => '昵称需为 1-30 个字符']);
            exit();
        }
        if ($bio !== null && mb_strlen($bio) > 300) {
            echo json_encode(['success' => false, 'message' => '个性签名不能超过 300 个字符']);
            exit();
        }

        $db = getDB();
        if ($nickname !== null) {
            $db->prepare("UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                ->execute([$nickname, $user['id']]);
        }
        if ($bio !== null) {
            $db->prepare("UPDATE users SET profile_bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                ->execute([$bio, $user['id']]);
        }

        logAction('user.update_profile', 'user', $user['id'], ['nickname' => $nickname, 'bio' => $bio]);
        echo json_encode(['success' => true, 'message' => '已更新']);
        exit();

    case 'qq_auth':
        // 跳转到 QQ OAuth 授权页面
        initSession();
        require_once __DIR__ . '/../includes/oauth_qq.php';
        $_SESSION['oauth_mode'] = $_GET['mode'] ?? 'login';
        $url = qq_get_authorization_url();
        header('Location: ' . $url);
        exit();

    case 'discord_auth':
        // 跳转到 Discord OAuth 授权页面
        initSession();
        require_once __DIR__ . '/../includes/oauth_discord.php';
        $_SESSION['oauth_mode'] = $_GET['mode'] ?? 'login';
        $url = discord_get_authorization_url();
        header('Location: ' . $url);
        exit();

    case 'bind_qq':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $user = requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        $openid = trim($input['openid'] ?? '');
        $unionid = trim($input['unionid'] ?? '');

        if (!$openid) {
            echo json_encode(['success' => false, 'message' => 'QQ OpenID 不能为空']);
            exit();
        }

        // 检查是否已被其他账号绑定
        $db = getDB();
        $stmt = $db->prepare('SELECT id FROM users WHERE qq_openid = ? AND id != ?');
        $stmt->execute([$openid, $user['id']]);
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => '该 QQ 账号已被其他用户绑定']);
            exit();
        }

        $db->prepare("UPDATE users SET qq_openid = ?, qq_unionid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$openid, $unionid, $user['id']]);

        logAction('user.bind_qq', 'user', $user['id']);
        echo json_encode(['success' => true, 'message' => 'QQ 绑定成功']);
        exit();

    case 'unbind_qq':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $user = requireLogin();
        $db = getDB();
        $db->prepare("UPDATE users SET qq_openid = NULL, qq_unionid = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$user['id']]);

        logAction('user.unbind_qq', 'user', $user['id']);
        echo json_encode(['success' => true, 'message' => 'QQ 已解绑']);
        exit();

    case 'bind_discord':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $user = requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        $discordId = trim($input['discord_id'] ?? '');

        if (!$discordId) {
            echo json_encode(['success' => false, 'message' => 'Discord ID 不能为空']);
            exit();
        }

        // 检查是否已被其他账号绑定
        $db = getDB();
        $stmt = $db->prepare('SELECT id FROM users WHERE discord_id = ? AND id != ?');
        $stmt->execute([$discordId, $user['id']]);
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => '该 Discord 账号已被其他用户绑定']);
            exit();
        }

        $db->prepare("UPDATE users SET discord_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$discordId, $user['id']]);

        logAction('user.bind_discord', 'user', $user['id']);
        echo json_encode(['success' => true, 'message' => 'Discord 绑定成功']);
        exit();

    case 'unbind_discord':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $user = requireLogin();
        $db = getDB();
        $db->prepare("UPDATE users SET discord_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$user['id']]);

        logAction('user.unbind_discord', 'user', $user['id']);
        echo json_encode(['success' => true, 'message' => 'Discord 已解绑']);
        exit();

    case 'oauth_config':
        echo json_encode([
            'success' => true,
            'qq_configured' => defined('QQ_APPID') && QQ_APPID !== '',
            'discord_configured' => defined('DISCORD_CLIENT_ID') && DISCORD_CLIENT_ID !== '',
        ]);
        exit();

    default:
        echo json_encode(['success' => false, 'message' => '未知动作', 'available_actions' => [
            'login_local', 'register_local', 'logout', 'me', 'change_password',
            'send_code', 'bind_email', 'unbind_email', 'update_profile',
            'bind_qq', 'unbind_qq', 'bind_discord', 'unbind_discord',
            'qq_auth', 'discord_auth', 'oauth_config'
        ]]);
        exit();
}
