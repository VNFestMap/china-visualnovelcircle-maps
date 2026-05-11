<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

$dataFile = __DIR__ . '/../data/manuscripts.json';
$uploadDir = __DIR__ . '/../data/manuscripts/';

function loadManuscripts() {
    global $dataFile;
    if (!file_exists($dataFile)) return [];
    $data = json_decode(file_get_contents($dataFile), true);
    return is_array($data) ? $data : [];
}

function saveManuscripts($list) {
    global $dataFile;
    file_put_contents($dataFile, json_encode($list, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

$action = $_GET['action'] ?? '';

// list_by_publication — 公开
if ($action === 'list_by_publication') {
    $pubId = intval($_GET['publication_id'] ?? 0);
    $all = loadManuscripts();
    $filtered = array_filter($all, fn($m) => $m['publication_id'] === $pubId);
    echo json_encode(['success' => true, 'manuscripts' => array_values($filtered)]);
    exit();
}

// list_by_club — 需要管理权限
if ($action === 'list_by_club') {
    $user = requireLogin();
    requireAdmin();
    $clubId = intval($_GET['club_id'] ?? 0);
    $country = $_GET['country'] ?? 'china';
    if ($clubId <= 0) {
        echo json_encode(['success' => false, 'message' => '无效同好会ID']);
        exit();
    }
    // Verify user manages this specific club
    if ($user['role'] !== 'super_admin') {
        $db = getDB();
        $stmt = $db->prepare("SELECT id FROM club_memberships WHERE user_id = ? AND club_id = ? AND country = ? AND role IN ('representative', 'manager') AND status = 'active'");
        $stmt->execute([$user['id'], $clubId, $country]);
        if (!$stmt->fetch()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => '权限不足']);
            exit();
        }
    }
    $all = loadManuscripts();
    $filtered = array_filter($all, function($m) use ($clubId, $country) {
        foreach ($m['club_ids'] ?? [] as $c) {
            if ($c['id'] == $clubId && $c['country'] === $country) return true;
        }
        return false;
    });
    echo json_encode(['success' => true, 'manuscripts' => array_values($filtered)]);
    exit();
}

// upload — 需要登录
if ($action === 'upload') {
    $user = requireLogin();
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(['success' => false, 'message' => '文件上传失败']);
        exit();
    }
    $file = $_FILES['file'];
    $maxSize = 10 * 1024 * 1024; // 10MB
    if ($file['size'] > $maxSize) {
        echo json_encode(['success' => false, 'message' => '文件大小超过10MB限制']);
        exit();
    }
    $allowedExt = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt)) {
        echo json_encode(['success' => false, 'message' => '不支持的文件类型']);
        exit();
    }

    $publicationId = intval($_POST['publication_id'] ?? 0);
    $contact = trim($_POST['contact'] ?? '');
    $remark = trim($_POST['remark'] ?? '');

    // 获取 publication 信息（用于继承 club_ids）
    $pubFile = __DIR__ . '/../data/publications.json';
    $pubData = json_decode(file_get_contents($pubFile), true);
    $publications = $pubData['publications'] ?? [];
    $targetPub = null;
    foreach ($publications as $p) {
        if ($p['id'] === $publicationId) { $targetPub = $p; break; }
    }
    if (!$targetPub) {
        echo json_encode(['success' => false, 'message' => '刊物不存在']);
        exit();
    }

    $all = loadManuscripts();
    $maxId = 0;
    foreach ($all as $m) { if (($m['id'] ?? 0) > $maxId) $maxId = $m['id']; }

    $safeName = $maxId + 1 . '_' . preg_replace('/[^a-zA-Z0-9_\-\x{4e00}-\x{9fa5}]/u', '_', $file['name']);
    $destPath = $uploadDir . $safeName;
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        echo json_encode(['success' => false, 'message' => '文件保存失败']);
        exit();
    }

    $manuscript = [
        'id' => $maxId + 1,
        'publication_id' => $publicationId,
        'publication_name' => $targetPub['publicationName'] ?? '',
        'club_ids' => $targetPub['club_ids'] ?? [],
        'submitter_id' => $user['id'],
        'submitter_name' => $user['nickname'] ?: $user['username'] ?: '未知',
        'contact' => $contact,
        'file_name' => $file['name'],
        'file_path' => 'data/manuscripts/' . $safeName,
        'remark' => $remark,
        'submitted_at' => date('Y-m-d H:i:s')
    ];
    $all[] = $manuscript;
    saveManuscripts($all);
    echo json_encode(['success' => true, 'message' => '上传成功', 'manuscript' => $manuscript]);
    exit();
}

// delete — 需要管理权限或本人
if ($action === 'delete') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $all = loadManuscripts();
    $found = null;
    foreach ($all as $m) { if ($m['id'] === $id) { $found = $m; break; } }
    if (!$found) {
        echo json_encode(['success' => false, 'message' => '稿件不存在']);
        exit();
    }
    $user = requireLogin();
    $isOwner = ($found['submitter_id'] === $user['id']);
    $isAdmin = ($user['role'] === 'super_admin');
    if (!$isOwner && !$isAdmin) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '权限不足']);
        exit();
    }
    // 删除文件
    $filePath = __DIR__ . '/../' . $found['file_path'];
    if (file_exists($filePath)) unlink($filePath);
    // 删除记录
    $newList = array_filter($all, fn($m) => $m['id'] !== $id);
    saveManuscripts(array_values($newList));
    echo json_encode(['success' => true, 'message' => '删除成功']);
    exit();
}

// download — 文件下载（登录即可）
if ($action === 'download') {
    $id = intval($_GET['id'] ?? 0);
    $all = loadManuscripts();
    $found = null;
    foreach ($all as $m) { if ($m['id'] === $id) { $found = $m; break; } }
    if (!$found) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => '稿件不存在']);
        exit();
    }
    $filePath = __DIR__ . '/../' . $found['file_path'];
    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => '文件不存在']);
        exit();
    }
    requireLogin();
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename*=UTF-8\'\'' . rawurlencode($found['file_name']));
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit();
}

echo json_encode(['success' => false, 'message' => '未知 action']);
