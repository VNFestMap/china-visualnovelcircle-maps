<?php
// scripts/seed_superadmin.php - 将现有用户提升为超级管理员
// 用法:
//   php scripts/seed_superadmin.php qq <QQ OpenID>
//   php scripts/seed_superadmin.php discord <Discord User ID>
//   php scripts/seed_superadmin.php username <用户名>
//   php scripts/seed_superadmin.php list (列出所有用户)
//
// 步骤:
//   1. 先用本地账号注册并登录一次（会自动创建用户）
//   2. 运行本脚本提升该用户为 super_admin

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/db.php';

$mode = $argv[1] ?? '';

if ($mode === 'list') {
    $db = getDB();
    $stmt = $db->query("SELECT id, username, role, qq_openid, discord_id, created_at FROM users ORDER BY id");
    $users = $stmt->fetchAll();

    if (empty($users)) {
        echo "暂无用户。请先用 QQ 或 Discord 登录一次。\n";
        exit(0);
    }

    echo "用户列表:\n";
    echo str_repeat('-', 80) . "\n";
    printf("%-4s %-20s %-15s %-20s %-20s\n", "ID", "用户名", "角色", "QQ OpenID", "Discord ID");
    echo str_repeat('-', 80) . "\n";
    foreach ($users as $u) {
        printf("%-4d %-20s %-15s %-20s %-20s\n",
            $u['id'],
            mb_substr($u['username'], 0, 20),
            $u['role'],
            mb_substr($u['qq_openid'] ?? '', 0, 20),
            mb_substr($u['discord_id'] ?? '', 0, 20)
        );
    }
    exit(0);
}

if ($mode === 'qq' && !empty($argv[2])) {
    $db = getDB();
    $stmt = $db->prepare("SELECT id, username, role FROM users WHERE qq_openid = ?");
    $stmt->execute([$argv[2]]);
    $user = $stmt->fetch();

    if (!$user) {
        echo "未找到该 QQ OpenID 的用户。请先登录一次。\n";
        exit(1);
    }

    $db->prepare("UPDATE users SET role = 'super_admin', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        ->execute([$user['id']]);
    echo "用户 {$user['username']} (ID: {$user['id']}) 已提升为 super_admin\n";
    exit(0);
}

if ($mode === 'discord' && !empty($argv[2])) {
    $db = getDB();
    $stmt = $db->prepare("SELECT id, username, role FROM users WHERE discord_id = ?");
    $stmt->execute([$argv[2]]);
    $user = $stmt->fetch();

    if (!$user) {
        echo "未找到该 Discord ID 的用户。请先登录一次。\n";
        exit(1);
    }

    $db->prepare("UPDATE users SET role = 'super_admin', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        ->execute([$user['id']]);
    echo "用户 {$user['username']} (ID: {$user['id']}) 已提升为 super_admin\n";
    exit(0);
}

if ($mode === 'username' && !empty($argv[2])) {
    $db = getDB();
    $stmt = $db->prepare("SELECT id, username, role FROM users WHERE username = ?");
    $stmt->execute([$argv[2]]);
    $user = $stmt->fetch();

    if (!$user) {
        echo "未找到用户 \"{$argv[2]}\"。请先注册。\n";
        exit(1);
    }

    $db->prepare("UPDATE users SET role = 'super_admin', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        ->execute([$user['id']]);
    echo "用户 {$user['username']} (ID: {$user['id']}) 已提升为 super_admin\n";
    exit(0);
}

echo "用法:\n";
echo "  php scripts/seed_superadmin.php list                    - 列出所有用户\n";
echo "  php scripts/seed_superadmin.php qq <OpenID>             - 通过 QQ OpenID 提升为超管\n";
echo "  php scripts/seed_superadmin.php discord <DiscordID>     - 通过 Discord ID 提升为超管\n";
echo "  php scripts/seed_superadmin.php username <用户名>        - 通过用户名提升为超管\n";
exit(1);
