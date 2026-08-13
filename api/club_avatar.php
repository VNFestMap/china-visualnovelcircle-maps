<?php
// api/club_avatar.php - 同好会头像、活动海报、刊物图片上传
// scope=club (默认) -> data/club_avatars/
// scope=publication -> data/publication_images/
// scope=event -> data/event_images/

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 禁止 PHP 警告以 HTML 形式输出污染 JSON 响应
ini_set('display_errors', '0');

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
$rawId = trim((string)($_POST['id'] ?? ''));
$country = $_POST['country'] ?? 'china';
$allowedCountries = ['china', 'japan', 'overseas'];
if (!in_array($country, $allowedCountries, true)) {
    $country = 'china';
}

if ($scope === 'club') {
    $id = (string)(int)$rawId;
    if ((int)$id <= 0) {
        echo json_encode(['success' => false, 'message' => '缺少同好会 ID']);
        exit();
    }
    if (!canManageClubInCountry($authUser, (int)$id, $country)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '无权上传该同好会头像']);
        exit();
    }
} else {
    $id = preg_replace('/[^A-Za-z0-9_-]/', '_', $rawId);
    if ($id === '') {
        $id = $scope . '_' . time() . '_' . bin2hex(random_bytes(4));
    }
    if (!in_array($authUser['role'], ['manager', 'representative', 'super_admin'], true)) {
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

if ($file['size'] > 2 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => '图片大小不能超过 2MB']);
    exit();
}

$detectedType = null;
if (function_exists('exif_imagetype')) {
    $detectedType = @exif_imagetype($file['tmp_name']);
} elseif (function_exists('getimagesize')) {
    $info = @getimagesize($file['tmp_name']);
    $detectedType = $info[2] ?? null;
} else {
    $extMap = [
        'jpg' => IMAGETYPE_JPEG,
        'jpeg' => IMAGETYPE_JPEG,
        'png' => IMAGETYPE_PNG,
        'gif' => IMAGETYPE_GIF,
        'webp' => IMAGETYPE_WEBP,
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
    if (!mkdir($dir, 0755, true)) {
        echo json_encode(['success' => false, 'message' => '无法创建目录: ' . basename($dir)]);
        exit();
    }
}

if (!is_writable($dir)) {
    echo json_encode(['success' => false, 'message' => '目录无写入权限: ' . basename($dir)]);
    exit();
}

$fileBase = $scope === 'club' ? $country . '_' . $id : $id;

foreach (['jpg', 'jpeg', 'png', 'gif', 'webp'] as $oldExt) {
    $oldPath = $dir . '/' . $fileBase . '.' . $oldExt;
    if (is_file($oldPath)) {
        @unlink($oldPath);
    }
}

$destPath = $dir . '/' . $fileBase . '.' . $ext;
if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    echo json_encode(['success' => false, 'message' => '文件保存失败，请检查服务器目录权限: ' . basename($dir)]);
    exit();
}

$timestamp = time();
$urlPrefixes = [
    'publication' => 'data/publication_images/',
    'event' => 'data/event_images/',
];
$urlPrefix = $urlPrefixes[$scope] ?? 'data/club_avatars/';
$imageUrl = $urlPrefix . $fileBase . '.' . $ext . '?t=' . $timestamp;

echo json_encode([
    'success' => true,
    'message' => '上传成功',
    'image_url' => $imageUrl,
]);
