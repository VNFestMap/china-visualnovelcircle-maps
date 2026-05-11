<?php
// api_events.php - 活动数据管理 API
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dataFile = __DIR__ . '/../data/events.json';

// GET - 读取数据
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // action=registrations: 获取报名数据（公开）
    if (isset($_GET['action']) && $_GET['action'] === 'registrations') {
        $regFile = __DIR__ . '/../data/event_registrations.json';
        $registrations = [];
        if (file_exists($regFile)) {
            $content = file_get_contents($regFile);
            $decoded = json_decode($content, true);
            if (is_array($decoded)) $registrations = $decoded;
        }

        $eventId = isset($_GET['event_id']) ? (int)$_GET['event_id'] : 0;
        if ($eventId > 0) {
            $registrations = array_values(array_filter($registrations, function($r) use ($eventId) {
                return $r['event_id'] === $eventId;
            }));
        }

        echo json_encode(['success' => true, 'registrations' => $registrations]);
        exit();
    }

    if (file_exists($dataFile)) {
        $content = file_get_contents($dataFile);
        // 验证 JSON 格式
        if (json_decode($content) === null) {
            // JSON 格式错误，返回空数组
            echo json_encode(['events' => []]);
        } else {
            echo $content;
        }
    } else {
        echo json_encode(['events' => []]);
    }
    exit();
}

// POST - 保存数据（需要验证）
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/../includes/auth.php';

    // action=add: 任何登录用户可添加单条活动（无需审核）
    if (isset($_GET['action']) && $_GET['action'] === 'add') {
        requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['event']) || !isset($input['date'])) {
            echo json_encode(['success' => false, 'message' => '缺少必填字段']);
            exit();
        }

        $current = json_decode(file_get_contents($dataFile), true);
        $events = $current['events'] ?? [];

        $maxId = 0;
        foreach ($events as $e) {
            if (($e['id'] ?? 0) > $maxId) $maxId = $e['id'];
        }

        $newEvent = [
            'id' => $maxId + 1,
            'event' => $input['event'],
            'date' => $input['date'],
            'date_end' => $input['date_end'] ?? null,
            'image' => $input['image'] ?? '',
            'raw_text' => $input['raw_text'] ?? '',
            'offical' => $input['offical'] ?? 0,
            'description' => $input['description'] ?? '',
            'link' => $input['link'] ?? '',
            'created_at' => date('Y-m-d H:i:s'),
        ];

        $events[] = $newEvent;
        file_put_contents($dataFile, json_encode(['events' => $events], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'message' => '活动已添加', 'event' => $newEvent]);
        exit();
    }

    // action=register: 登录用户报名活动
    if (isset($_GET['action']) && $_GET['action'] === 'register') {
        requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['event_id'])) {
            echo json_encode(['success' => false, 'message' => '缺少活动 ID']);
            exit();
        }

        $user = getCurrentUser();
        $eventId = (int)$input['event_id'];
        $regFile = __DIR__ . '/../data/event_registrations.json';

        $registrations = [];
        if (file_exists($regFile)) {
            $content = file_get_contents($regFile);
            $decoded = json_decode($content, true);
            if (is_array($decoded)) $registrations = $decoded;
        }

        // 检查是否已报名
        foreach ($registrations as $r) {
            if ($r['event_id'] === $eventId && $r['user_id'] === (int)$user['id']) {
                echo json_encode(['success' => false, 'message' => '您已报名该活动']);
                exit();
            }
        }

        $registrations[] = [
            'event_id' => $eventId,
            'user_id' => (int)$user['id'],
            'username' => $user['nickname'] ?? $user['username'],
            'registered_at' => date('Y-m-d H:i:s'),
        ];

        file_put_contents($regFile, json_encode($registrations, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'message' => '报名成功']);
        exit();
    }

    // action=unregister: 取消报名
    if (isset($_GET['action']) && $_GET['action'] === 'unregister') {
        requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['event_id'])) {
            echo json_encode(['success' => false, 'message' => '缺少活动 ID']);
            exit();
        }

        $user = getCurrentUser();
        $eventId = (int)$input['event_id'];
        $regFile = __DIR__ . '/../data/event_registrations.json';

        $registrations = [];
        if (file_exists($regFile)) {
            $content = file_get_contents($regFile);
            $decoded = json_decode($content, true);
            if (is_array($decoded)) $registrations = $decoded;
        }

        $found = false;
        $newRegs = [];
        foreach ($registrations as $r) {
            if ($r['event_id'] === $eventId && $r['user_id'] === (int)$user['id']) {
                $found = true;
                continue;
            }
            $newRegs[] = $r;
        }

        if (!$found) {
            echo json_encode(['success' => false, 'message' => '您未报名该活动']);
            exit();
        }

        file_put_contents($regFile, json_encode($newRegs, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'message' => '已取消报名']);
        exit();
    }

    requireAdmin();

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['events'])) {
        echo json_encode(['success' => false, 'message' => '无效的数据']);
        exit();
    }

    $result = ['events' => $input['events']];
    $success = file_put_contents($dataFile, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    if ($success !== false) {
        echo json_encode(['success' => true, 'message' => '保存成功']);
    } else {
        echo json_encode(['success' => false, 'message' => '保存失败，请检查文件权限']);
    }
    exit();
}

echo json_encode(['success' => false, 'message' => '不支持的请求方法']);
?>