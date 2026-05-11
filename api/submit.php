<?php
// submit_api.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$submissions_file = __DIR__ . '/../data/submissions.json';

// PUT + action=save — 管理员保存提交数据
if ($_SERVER['REQUEST_METHOD'] === 'PUT' && isset($_GET['action']) && $_GET['action'] === 'save') {
    require_once __DIR__ . '/../includes/auth.php';
    requireAdmin();

    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && is_array($input)) {
        file_put_contents($submissions_file, json_encode($input, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => '无效数据']);
    }
    exit();
}

// 获取 POST 数据
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['success' => false, 'message' => '无效的数据']);
    exit;
}

// 读取已有提交记录
$submissions = [];
if (file_exists($submissions_file)) {
    $content = file_get_contents($submissions_file);
    $submissions = json_decode($content, true);
    if (!is_array($submissions)) $submissions = [];
}

// 生成新ID
$maxId = 0;
foreach ($submissions as $item) {
    if (($item['id'] ?? 0) > $maxId) $maxId = $item['id'];
}

// 添加新记录
$input['id'] = $maxId + 1;
$input['status'] = 'pending';
$input['submitted_at'] = date('Y-m-d H:i:s');
$submissions[] = $input;

// 保存
$success = file_put_contents($submissions_file, json_encode($submissions, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

if ($success !== false) {
    echo json_encode(['success' => true, 'message' => '提交成功', 'id' => $input['id']]);
} else {
    echo json_encode(['success' => false, 'message' => '保存失败，请检查文件权限']);
}
?>