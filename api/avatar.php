<?php
// api/avatar.php - 头像上传与获取
// 动作: upload, get

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

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'upload':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $user = requireLogin();
        checkRateLimit('avatar_upload', 5, 1);

        if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
            $errMsg = $_FILES['avatar']['error'] ?? -1;
            echo json_encode(['success' => false, 'message' => '上传失败，错误码: ' . $errMsg]);
            exit();
        }

        $file = $_FILES['avatar'];

        // 验证文件大小（最大 2MB）
        if ($file['size'] > 2 * 1024 * 1024) {
            echo json_encode(['success' => false, 'message' => '图片大小不能超过 2MB']);
            exit();
        }

        // 验证图片类型
        $detectedType = null;
        if (function_exists('exif_imagetype')) {
            $detectedType = @exif_imagetype($file['tmp_name']);
        } elseif (function_exists('getimagesize')) {
            $info = @getimagesize($file['tmp_name']);
            $detectedType = $info[2] ?? null;
        } else {
            // 最后 fallback: 检查扩展名
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

        // 扩展名映射
        $extMap = [
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_GIF => 'gif',
            IMAGETYPE_WEBP => 'webp',
        ];
        $ext = $extMap[$detectedType];

        // 确保目录存在
        $avatarDir = __DIR__ . '/../data/avatars';
        if (!is_dir($avatarDir)) {
            mkdir($avatarDir, 0755, true);
        }

        // 删除旧头像文件（不同扩展名的）
        $userId = (int)$user['id'];
        foreach (['jpg', 'jpeg', 'png', 'gif', 'webp'] as $oldExt) {
            $oldPath = $avatarDir . '/' . $userId . '.' . $oldExt;
            if (is_file($oldPath)) {
                @unlink($oldPath);
            }
        }

        $destPath = $avatarDir . '/' . $userId . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            echo json_encode(['success' => false, 'message' => '文件保存失败']);
            exit();
        }

        $timestamp = time();
        $avatarUrl = 'data/avatars/' . $userId . '.' . $ext . '?t=' . $timestamp;

        // 更新数据库
        $db = getDB();
        $db->prepare(
            "UPDATE users SET avatar_url = ?, avatar_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )->execute([$avatarUrl, $userId]);

        logAction('user.change_avatar', 'user', $userId);

        echo json_encode([
            'success' => true,
            'message' => '头像上传成功',
            'avatar_url' => $avatarUrl,
        ]);
        exit();

    default:
        echo json_encode(['success' => false, 'message' => '未知动作']);
        exit();
}
