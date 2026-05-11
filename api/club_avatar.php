<?php
// api/club_avatar.php - 同好会头像、活动海报、刊物图片上传
// scope=club (默认) → data/club_avatars/
// scope=publication → data/publication_images/
// scope=event → data/event_images/

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../includes/auth.php';
$authUser = requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
    exit();
}

$scope = $_GET['scope'] ?? 'club';
$id = $_POST['id'] ?? '';
if (!$id) {
    echo json_encode(['success' => false, 'message' => '缺少 ID']);
    exit();
}

// 权限检查：按 scope 区分
if ($scope === 'club') {
    // 同好会头像：需要俱乐部级管理权限
    if (!canManageClub($authUser, (int)$id)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '无权上传该同好会头像']);
        exit();
    }
} else {
    // 刊物/活动图片：需要系统级管理员角色
    if (!in_array($authUser['role'], ['manager', 'representative', 'super_admin'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '权限不足']);
        exit();
    }
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => '上传失败']);
    exit();
}

$file = $_FILES['image'];

// 最大 2MB
if ($file['size'] > 2 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => '图片大小不能超过 2MB']);
    exit();
}

// 检测图片类型（带多重 fallback）
$detectedType = null;
if (function_exists('exif_imagetype')) {
    $detectedType = @exif_imagetype($file['tmp_name']);
} elseif (function_exists('getimagesize')) {
    $info = @getimagesize($file['tmp_name']);
    $detectedType = $info[2] ?? null;
} else {
    $extMap = [
        'jpg' => IMAGETYPE_JPEG, 'jpeg' => IMAGETYPE_JPEG,
        'png' => IMAGETYPE_PNG, 'gif' => IMAGETYPE_GIF, 'webp' => IMAGETYPE_WEBP,
    ];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $detectedType = $extMap[$ext] ?? null;
}
$allowedTypes = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF, IMAGETYPE_WEBP];
if (!in_array($detectedType, $allowedTypes, true)) {
    echo json_encode(['success' => false, 'message' => '仅支持 JPEG、PNG、GIF、WebP 格式']);
    exit();
}

$extMap = [
    IMAGETYPE_JPEG => 'jpg',
    IMAGETYPE_PNG => 'png',
    IMAGETYPE_GIF => 'gif',
    IMAGETYPE_WEBP => 'webp',
];
$ext = $extMap[$detectedType];

$scopeDirs = [
    'publication' => __DIR__ . '/../data/publication_images',
    'event' => __DIR__ . '/../data/event_images',
];
$dir = $scopeDirs[$scope] ?? __DIR__ . '/../data/club_avatars';

if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

// 删除旧文件（同 ID 不同扩展名）
foreach (['jpg', 'jpeg', 'png', 'gif', 'webp'] as $oldExt) {
    $oldPath = $dir . '/' . $id . '.' . $oldExt;
    if (is_file($oldPath)) @unlink($oldPath);
}

$destPath = $dir . '/' . $id . '.' . $ext;
if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    echo json_encode(['success' => false, 'message' => '文件保存失败']);
    exit();
}

$timestamp = time();
$urlPrefixes = [
    'publication' => 'data/publication_images/',
    'event' => 'data/event_images/',
];
$urlPrefix = $urlPrefixes[$scope] ?? 'data/club_avatars/';
$imageUrl = $urlPrefix . $id . '.' . $ext . '?t=' . $timestamp;

echo json_encode([
    'success' => true,
    'message' => '上传成功',
    'image_url' => $imageUrl,
]);
