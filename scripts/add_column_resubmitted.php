<?php
// scripts/add_column_resubmitted.php - 为 galonly_applications 表添加 resubmitted 列
// 仅超级管理员可执行，访问前请先登录

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: text/html; charset=utf-8');

$user = getCurrentUser();
if (!$user || $user['role'] !== 'super_admin') {
    die('权限不足，仅超级管理员可执行此操作');
}

require_once __DIR__ . '/../includes/db.php';

try {
    $db = getDB();
    if (DB_DRIVER === 'mysql') {
        $db->exec("ALTER TABLE galonly_applications ADD COLUMN resubmitted TINYINT(1) NOT NULL DEFAULT 0");
    } else {
        $db->exec("ALTER TABLE galonly_applications ADD COLUMN resubmitted INTEGER NOT NULL DEFAULT 0");
    }
    echo '<h2>✅ resubmitted 列已成功添加</h2>';
    echo '<p><a href="javascript:history.back()">返回</a></p>';
} catch (PDOException $e) {
    if (str_contains($e->getMessage(), 'Duplicate column') || str_contains($e->getMessage(), 'duplicate column')) {
        echo '<h2>ℹ️ resubmitted 列已存在，无需添加</h2>';
    } else {
        echo '<h2>❌ 添加失败</h2>';
        echo '<pre>' . htmlspecialchars($e->getMessage()) . '</pre>';
    }
}
