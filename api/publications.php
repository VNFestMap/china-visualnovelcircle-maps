<?php
// api_publications.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dataFile = __DIR__ . '/../data/publications.json';

// GET - 读取数据
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($dataFile)) {
        echo file_get_contents($dataFile);
    } else {
        echo json_encode(['publications' => []]);
    }
    exit();
}

// 以下需要验证
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';
// requireLogin 确保有用户，具体权限由各方法自行检查
$authUser = requireLogin();

/**
 * 通过俱乐部名称查找 club_id（支持中文/日本数据）
 */
function findClubIdByName(string $clubName): int {
    $files = [
        __DIR__ . '/../data/clubs.json',
        __DIR__ . '/../data/clubs_japan.json'
    ];
    foreach ($files as $file) {
        if (!file_exists($file)) continue;
        $json = json_decode(file_get_contents($file), true);
        $rows = $json['data'] ?? [];
        foreach ($rows as $item) {
            if (($item['name'] ?? '') === $clubName || ($item['display_name'] ?? '') === $clubName) {
                return (int)($item['id'] ?? 0);
            }
        }
    }
    return 0;
}

/**
 * 检查用户是否有权限管理指定俱乐部
 */
function canManagePublicationClub(array $user, int $clubId, string $country = ''): bool {
    if ($user['role'] === 'super_admin') return true;
    $db = getDB();
    $sql = "SELECT id FROM club_memberships WHERE user_id = ? AND club_id = ? AND role IN ('representative', 'manager') AND status = 'active'";
    $params = [$user['id'], $clubId];
    if ($country) {
        $sql .= " AND country = ?";
        $params[] = $country;
    }
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return (bool)$stmt->fetch();
}

/**
 * 检查用户是否有权限管理该刊物（匹配其管理的俱乐部）
 */
function canManagePublication(array $user, array $publication): bool {
    if ($user['role'] === 'super_admin') return true;
    $clubIds = $publication['club_ids'] ?? [];
    if (empty($clubIds)) {
        // 向后兼容：尝试通过 clubName 查找
        $clubId = findClubIdByName($publication['clubName'] ?? '');
        if ($clubId > 0) {
            return canManagePublicationClub($user, $clubId);
        }
        return false;
    }
    foreach ($clubIds as $c) {
        if (canManagePublicationClub($user, $c['id'], $c['country'] ?? '')) return true;
    }
    return false;
}

// POST - 添加
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['clubName']) || !isset($input['publicationName'])) {
        echo json_encode(['success' => false, 'message' => '缺少必填字段']);
        exit();
    }

    // 权限检查: super_admin 或可管理该俱乐部的负责人
    $clubId = isset($input['club_id']) ? (int)$input['club_id'] : 0;
    // 兼容前端发送 club_ids 数组的情况
    if ($clubId === 0 && !empty($input['club_ids']) && is_array($input['club_ids'])) {
        $clubId = (int)$input['club_ids'][0]['id'];
    }
    $canManage = false;
    if ($authUser['role'] === 'super_admin') {
        $canManage = true;
    } elseif ($clubId > 0) {
        $canManage = canManagePublicationClub($authUser, $clubId);
    }
    if (!$canManage) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '权限不足，仅同好会负责人可添加刊物']);
        exit();
    }
    
    $current = json_decode(file_get_contents($dataFile), true);
    $publications = $current['publications'] ?? [];
    
    $maxId = 0;
    foreach ($publications as $item) {
        if (($item['id'] ?? 0) > $maxId) $maxId = $item['id'];
    }
    
    $newItem = [
        'id' => $maxId + 1,
        'clubName' => $input['clubName'],
        'publicationName' => $input['publicationName'],
        'status' => $input['status'] ?? 'planning',
        'submitContact' => $input['submitContact'] ?? '',  // 改为 submitContact（投稿账号/邮箱）
        'submitLink' => $input['submitLink'] ?? '',        // 保留链接作为备用
        'deadline' => $input['deadline'] ?? '',
        'description' => $input['description'] ?? '',
        'image_url' => $input['image_url'] ?? '',
        'club_ids' => $input['club_ids'] ?? [],
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ];
    
    $publications[] = $newItem;
    $result = ['publications' => $publications];
    file_put_contents($dataFile, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo json_encode(['success' => true, 'message' => '添加成功', 'data' => $newItem]);
    exit();
}

// PUT - 更新
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['id'])) {
        echo json_encode(['success' => false, 'message' => '无效数据']);
        exit();
    }

    $current = json_decode(file_get_contents($dataFile), true);
    $publications = $current['publications'] ?? [];
    $updated = false;
    $targetItem = null;

    foreach ($publications as $item) {
        if ($item['id'] == $input['id']) { $targetItem = $item; break; }
    }

    // 权限检查
    if (!$targetItem || !canManagePublication($authUser, $targetItem)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '权限不足']);
        exit();
    }

    foreach ($publications as $i => $item) {
        if ($item['id'] == $input['id']) {
            $publications[$i]['clubName'] = $input['clubName'] ?? $item['clubName'];
            $publications[$i]['publicationName'] = $input['publicationName'] ?? $item['publicationName'];
            $publications[$i]['status'] = $input['status'] ?? $item['status'];
            $publications[$i]['submitContact'] = $input['submitContact'] ?? $item['submitContact'];
            $publications[$i]['submitLink'] = $input['submitLink'] ?? $item['submitLink'];
            $publications[$i]['deadline'] = $input['deadline'] ?? $item['deadline'];
            $publications[$i]['description'] = $input['description'] ?? $item['description'];
            $publications[$i]['image_url'] = $input['image_url'] ?? $item['image_url'] ?? '';
            $publications[$i]['club_ids'] = $input['club_ids'] ?? $item['club_ids'] ?? [];
            $publications[$i]['updated_at'] = date('Y-m-d H:i:s');
            $updated = true;
            break;
        }
    }

    if (!$updated) {
        echo json_encode(['success' => false, 'message' => '未找到要更新的数据']);
        exit();
    }

    $result = ['publications' => $publications];
    file_put_contents($dataFile, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo json_encode(['success' => true, 'message' => '更新成功']);
    exit();
}

// DELETE - 删除
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['id'])) {
        echo json_encode(['success' => false, 'message' => '无效数据']);
        exit();
    }

    $current = json_decode(file_get_contents($dataFile), true);
    $publications = $current['publications'] ?? [];
    $targetItem = null;

    foreach ($publications as $item) {
        if ($item['id'] == $input['id']) { $targetItem = $item; break; }
    }

    // 权限检查
    if (!$targetItem || !canManagePublication($authUser, $targetItem)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => '权限不足']);
        exit();
    }

    $newPublications = [];
    foreach ($publications as $item) {
        if ($item['id'] != $input['id']) {
            $newPublications[] = $item;
        }
    }

    $result = ['publications' => $newPublications];
    file_put_contents($dataFile, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo json_encode(['success' => true, 'message' => '删除成功']);
    exit();
}

echo json_encode(['success' => false, 'message' => '不支持的请求方法']);
?>