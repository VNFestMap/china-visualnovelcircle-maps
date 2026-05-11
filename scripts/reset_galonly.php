<?php
// scripts/reset_galonly.php - 清空 GalOnly 摊位申请数据（保留活动和用户）
// 仅超级管理员可执行，访问前请先登录

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: text/html; charset=utf-8');

$user = getCurrentUser();
if (!$user || $user['role'] !== 'super_admin') {
    die('权限不足，仅超级管理员可执行此操作');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    // 显示确认页面
    echo '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>重置 GalOnly 数据</title>';
    echo '<style>body{font-family:sans-serif;background:#1a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
           .card{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;max-width:480px;text-align:center;}
           h1{font-size:20px;margin-bottom:8px;}p{color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:24px;}
           button{padding:12px 32px;border:none;border-radius:10px;background:#e74c3c;color:#fff;font-size:15px;font-weight:600;cursor:pointer;}
           button:hover{opacity:0.9;}
           .warning{background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.2);border-radius:10px;padding:12px;font-size:13px;color:#e74c3c;margin-bottom:20px;}
           </style></head><body>';
    echo '<div class="card">';
    echo '<h1>⚠️ 重置 GalOnly 数据</h1>';
    echo '<div class="warning">此操作将清空所有申请、投票数据，不可撤销！</div>';
    echo '<p>将清空：摊位申请、关联同好会、审核投票</p>';
    echo '<form method="post"><button type="submit">确认清空</button></form>';
    echo '</div></body></html>';
    exit();
}

// 执行清空
$db = getDB();
$db->beginTransaction();
try {
    $db->exec("DELETE FROM galonly_votes");
    $db->exec("DELETE FROM galonly_application_clubs");
    $db->exec("DELETE FROM galonly_applications");
    $db->commit();
    echo '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>完成</title>';
    echo '<style>body{font-family:sans-serif;background:#1a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
           .card{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;text-align:center;}
           h1{font-size:20px;color:#4caf50;margin-bottom:8px;}p{color:rgba(255,255,255,0.6);font-size:14px;}
           a{color:#e91e63;}</style></head><body>';
    echo '<div class="card"><h1>✅ 已清空</h1>';
    echo '<p>所有 GalOnly 申请、投票数据已清除</p>';
    echo '<p><a href="../admin/Galonly_audit.html">返回审核面板</a></p></div></body></html>';
} catch (Exception $e) {
    $db->rollBack();
    echo '<p style="color:#e74c3c;">清空失败：' . $e->getMessage() . '</p>';
}
