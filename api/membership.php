<?php
// api/membership.php - 同好会绑定申请/审批 API
// 动作: my, apply, approve, reject, pending, members

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/audit.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'my':
        // 获取当前用户的所有绑定
        $user = getCurrentUser();
        if (!$user) {
            echo json_encode(['success' => true, 'memberships' => []]);
            exit();
        }
        $db = getDB();
        // 兼容 country 列尚未创建的情况
        try {
            $stmt = $db->prepare(
                "SELECT id, club_id, country, role, status, joined_at
                 FROM club_memberships WHERE user_id = ? ORDER BY joined_at DESC"
            );
            $stmt->execute([$user['id']]);
        } catch (Exception $e) {
            $stmt = $db->prepare(
                "SELECT id, club_id, role, status, joined_at
                 FROM club_memberships WHERE user_id = ? ORDER BY joined_at DESC"
            );
            $stmt->execute([$user['id']]);
        }
        echo json_encode(['success' => true, 'memberships' => $stmt->fetchAll()]);
        exit();

    case 'apply':
        // 申请绑定同好会
        $user = requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) {
            echo json_encode(['success' => false, 'message' => '请求数据格式错误']);
            exit();
        }
        $clubId = (int)($input['club_id'] ?? 0);
        $country = $input['country'] ?? 'china';
        $qqAccount = $input['qq_account'] ?? '';
        $applyRole = $input['apply_role'] ?? 'member';
        $isStudent = !empty($input['is_student']) ? 1 : 0;

        // 验证申请身份
        $validRoles = ['member', 'manager', 'representative'];
        if (!in_array($applyRole, $validRoles)) $applyRole = 'member';

        if (!$clubId) {
            echo json_encode(['success' => false, 'message' => '无效的同好会 ID']);
            exit();
        }

        $db = getDB();

        // 确保扩展列存在（兼容 MySQL 和 SQLite）
        ensureColumnExists($db, 'club_memberships', 'qq_account', "VARCHAR(255) DEFAULT ''");
        ensureColumnExists($db, 'club_memberships', 'apply_role', "VARCHAR(50) DEFAULT 'member'");
        ensureColumnExists($db, 'club_memberships', 'is_student', "INT DEFAULT 0");
        ensureColumnExists($db, 'club_memberships', 'country', "VARCHAR(20) DEFAULT 'china'");

        // 升级唯一约束为包含 country
        ensureUniqueConstraintIncludesCountry($db);

        // 检查是否已经申请过（按 user_id + club_id + country）
        $stmt = $db->prepare(
            "SELECT id, status FROM club_memberships WHERE user_id = ? AND club_id = ? AND country = ?"
        );
        $stmt->execute([$user['id'], $clubId, $country]);
        $existing = $stmt->fetch();

        if ($existing) {
            if ($existing['status'] === 'active') {
                echo json_encode(['success' => false, 'message' => '你已绑定该同好会']);
            } elseif ($existing['status'] === 'pending') {
                echo json_encode(['success' => false, 'message' => '绑定申请已提交，请等待审核']);
            } else {
                echo json_encode(['success' => false, 'message' => '已存在绑定记录']);
            }
            exit();
        }

        // 创建申请（事务保证原子性）
        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                "INSERT INTO club_memberships (user_id, club_id, role, status, qq_account, apply_role, is_student, country)
                 VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)"
            );
            $stmt->execute([$user['id'], $clubId, $applyRole, $qqAccount, $applyRole, $isStudent, $country]);
            $membershipId = $db->lastInsertId();

            logAction('membership.apply', 'club_membership', $membershipId, [
                'club_id' => $clubId, 'country' => $country, 'apply_role' => $applyRole
            ]);

            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            echo json_encode(['success' => false, 'message' => '操作失败：' . $e->getMessage()]);
            exit();
        }

        echo json_encode([
            'success' => true,
            'message' => '绑定申请已提交，等待管理员审核',
            'membership' => [
                'id' => (int)$membershipId,
                'status' => 'pending'
            ]
        ]);
        exit();

    case 'members':
        // 获取指定俱乐部的成员名单
        $clubId = (int)($_GET['club_id'] ?? 0);
        if (!$clubId) {
            echo json_encode(['success' => false, 'message' => '无效的俱乐部 ID']);
            exit();
        }

        // 权限：管理员/负责人可查看（按 club_id + country）
        $currentUser = requireLogin();
        $country = $_GET['country'] ?? 'china';
        if (!canManageClubInCountry($currentUser, $clubId, $country)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => '权限不足']);
            exit();
        }

        $db = getDB();
        // 兼容 country 列尚未创建的情况
        try {
            $stmt = $db->prepare(
                "SELECT cm.id, cm.user_id, cm.role, cm.status, cm.joined_at,
                        u.username, u.avatar_url
                 FROM club_memberships cm
                 JOIN users u ON u.id = cm.user_id
                 WHERE cm.club_id = ? AND cm.country = ? AND cm.status = 'active'
                 ORDER BY cm.joined_at ASC"
            );
            $stmt->execute([$clubId, $country]);
        } catch (Exception $e) {
            $stmt = $db->prepare(
                "SELECT cm.id, cm.user_id, cm.role, cm.status, cm.joined_at,
                        u.username, u.avatar_url
                 FROM club_memberships cm
                 JOIN users u ON u.id = cm.user_id
                 WHERE cm.club_id = ? AND cm.status = 'active'
                 ORDER BY cm.joined_at ASC"
            );
            $stmt->execute([$clubId]);
        }
        $members = $stmt->fetchAll();

        // 转换 int 类型
        foreach ($members as &$m) {
            $m['id'] = (int)$m['id'];
            $m['user_id'] = (int)$m['user_id'];
        }

        echo json_encode(['success' => true, 'members' => $members]);
        exit();

    case 'pending':
        // 获取待审批列表
        $currentUser = requireLogin();
        $db = getDB();

        // 确保扩展列存在（兼容旧表结构）
        ensureColumnExists($db, 'club_memberships', 'qq_account', "VARCHAR(255) DEFAULT ''");
        ensureColumnExists($db, 'club_memberships', 'apply_role', "VARCHAR(50) DEFAULT 'member'");
        ensureColumnExists($db, 'club_memberships', 'is_student', "INT DEFAULT 0");
        ensureColumnExists($db, 'club_memberships', 'country', "VARCHAR(20) DEFAULT 'china'");

        // 支持按状态筛选（默认 pending，传 all 返回全部）
        $statusFilter = $_GET['status'] ?? 'pending';
        $statusCondition = $statusFilter === 'all' ? '' : "AND cm.status = 'pending'";

        if ($currentUser['role'] === 'super_admin') {
            // 超级管理员：查看所有
            $stmt = $db->query(
                "SELECT cm.id, cm.user_id, cm.club_id, cm.country, cm.status, cm.joined_at,
                        cm.apply_role, cm.qq_account, cm.is_student, u.username
                 FROM club_memberships cm
                 JOIN users u ON u.id = cm.user_id
                 WHERE 1=1 $statusCondition
                 ORDER BY cm.joined_at ASC"
            );
        } else {
            // 负责人/管理员：只查看自己俱乐部的待审批（按 club_id + country 匹配）
            $stmt = $db->prepare(
                "SELECT cm.id, cm.user_id, cm.club_id, cm.country, cm.status, cm.joined_at,
                        cm.apply_role, cm.qq_account, cm.is_student, u.username
                 FROM club_memberships cm
                 JOIN users u ON u.id = cm.user_id
                 WHERE 1=1 $statusCondition
                   AND EXISTS (
                       SELECT 1 FROM club_memberships mgr
                       WHERE mgr.user_id = ?
                         AND mgr.role IN ('representative', 'manager')
                         AND mgr.status = 'active'
                         AND mgr.club_id = cm.club_id
                         AND mgr.country = cm.country
                   )
                 ORDER BY cm.joined_at ASC"
            );
            $stmt->execute([$currentUser['id']]);
        }

        $memberships = $stmt->fetchAll();
        foreach ($memberships as &$m) {
            $m['id'] = (int)$m['id'];
            $m['user_id'] = (int)$m['user_id'];
            $m['club_id'] = (int)$m['club_id'];
        }

        echo json_encode(['success' => true, 'memberships' => $memberships]);
        exit();

    case 'approve':
        // 批准绑定
        $currentUser = requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        $membershipId = (int)($input['membership_id'] ?? 0);

        if (!$membershipId) {
            echo json_encode(['success' => false, 'message' => '无效的成员 ID']);
            exit();
        }

        $db = getDB();

        // 获取申请信息用于权限检查
        $stmt = $db->prepare("SELECT cm.*, cm.club_id FROM club_memberships cm WHERE cm.id = ?");
        $stmt->execute([$membershipId]);
        $membership = $stmt->fetch();

        if (!$membership || $membership['status'] !== 'pending') {
            echo json_encode(['success' => false, 'message' => '未找到待审批的申请']);
            exit();
        }

        // 权限检查（按 club_id + country，避免中日 ID 重叠）
        if (!canManageClubInCountry($currentUser, $membership['club_id'], $membership['country'] ?? 'china')) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => '权限不足']);
            exit();
        }

        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                "UPDATE club_memberships SET status = 'active' WHERE id = ? AND status = 'pending'"
            );
            $stmt->execute([$membershipId]);

            if ($stmt->rowCount() === 0) {
                $db->rollBack();
                echo json_encode(['success' => false, 'message' => '未找到待审批的申请']);
                exit();
            }

            logAction('membership.approve', 'club_membership', $membershipId, [
                'club_id' => $membership['club_id'],
            ]);
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            echo json_encode(['success' => false, 'message' => '操作失败：' . $e->getMessage()]);
            exit();
        }
        echo json_encode(['success' => true, 'message' => '已批准绑定']);
        exit();

    case 'reject':
        // 拒绝绑定
        $currentUser = requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        $membershipId = (int)($input['membership_id'] ?? 0);

        if (!$membershipId) {
            echo json_encode(['success' => false, 'message' => '无效的成员 ID']);
            exit();
        }

        $db = getDB();

        // 获取申请信息用于权限检查
        $stmt = $db->prepare("SELECT cm.*, cm.club_id FROM club_memberships cm WHERE cm.id = ?");
        $stmt->execute([$membershipId]);
        $membership = $stmt->fetch();

        if (!$membership || $membership['status'] !== 'pending') {
            echo json_encode(['success' => false, 'message' => '未找到待审批的申请']);
            exit();
        }

        // 权限检查（按 club_id + country）
        if (!canManageClubInCountry($currentUser, $membership['club_id'], $membership['country'] ?? 'china')) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => '权限不足']);
            exit();
        }

        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                "UPDATE club_memberships SET status = 'rejected' WHERE id = ? AND status = 'pending'"
            );
            $stmt->execute([$membershipId]);

            if ($stmt->rowCount() === 0) {
                $db->rollBack();
                echo json_encode(['success' => false, 'message' => '未找到待审批的申请']);
                exit();
            }

            logAction('membership.reject', 'club_membership', $membershipId, [
                'club_id' => $membership['club_id'],
            ]);
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            echo json_encode(['success' => false, 'message' => '操作失败：' . $e->getMessage()]);
            exit();
        }
        echo json_encode(['success' => true, 'message' => '已拒绝绑定']);
        exit();

    case 'leave':
        // 用户自行退出同好会
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $currentUser = requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        $membershipId = (int)($input['membership_id'] ?? 0);
        $clubId = (int)($input['club_id'] ?? 0);
        $country = $input['country'] ?? 'china';

        $db = getDB();

        // 支持通过 club_id 查找 membership（按 club_id + country）
        if (!$membershipId && $clubId > 0) {
            $stmt = $db->prepare("SELECT id FROM club_memberships WHERE user_id = ? AND club_id = ? AND country = ? AND status = 'active'");
            $stmt->execute([$currentUser['id'], $clubId, $country]);
            $row = $stmt->fetch();
            if ($row) {
                $membershipId = (int)$row['id'];
            }
        }

        if (!$membershipId) {
            echo json_encode(['success' => false, 'message' => '无效的成员 ID']);
            exit();
        }

        // 获取申请信息
        $stmt = $db->prepare("SELECT * FROM club_memberships WHERE id = ?");
        $stmt->execute([$membershipId]);
        $membership = $stmt->fetch();

        if (!$membership) {
            echo json_encode(['success' => false, 'message' => '未找到绑定记录']);
            exit();
        }

        // 只能退出自己的绑定
        if ((int)$membership['user_id'] !== (int)$currentUser['id']) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => '只能退出自己的同好会绑定']);
            exit();
        }

        // 只能退出 active 状态的绑定
        if ($membership['status'] !== 'active') {
            echo json_encode(['success' => false, 'message' => '该绑定记录已经处于非活跃状态']);
            exit();
        }

        $db->prepare(
            "UPDATE club_memberships SET status = 'left', left_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'"
        )->execute([$membershipId]);

        logAction('membership.leave', 'club_membership', $membershipId, [
            'club_id' => $membership['club_id'],
        ]);
        echo json_encode(['success' => true, 'message' => '已退出同好会']);
        exit();

    case 'kick':
        // 踢出成员（负责人/管理员操作）
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $currentUser = requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        $membershipId = (int)($input['membership_id'] ?? 0);

        if (!$membershipId) {
            echo json_encode(['success' => false, 'message' => '无效的成员 ID']);
            exit();
        }

        $db = getDB();

        // 获取目标成员记录
        $stmt = $db->prepare("SELECT * FROM club_memberships WHERE id = ?");
        $stmt->execute([$membershipId]);
        $membership = $stmt->fetch();

        if (!$membership || $membership['status'] !== 'active') {
            echo json_encode(['success' => false, 'message' => '未找到活跃的成员记录']);
            exit();
        }

        // 权限检查：是否可管理该俱乐部（按 club_id + country）
        if (!canManageClubInCountry($currentUser, $membership['club_id'], $membership['country'] ?? 'china')) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => '权限不足']);
            exit();
        }

        // 不能踢自己
        if ((int)$membership['user_id'] === (int)$currentUser['id']) {
            echo json_encode(['success' => false, 'message' => '不能踢出自己']);
            exit();
        }

        // 非 super_admin 需要按角色限制可踢的目标
        if ($currentUser['role'] !== 'super_admin') {
            $stmt = $db->prepare("SELECT role FROM club_memberships WHERE user_id = ? AND club_id = ? AND country = ? AND status = 'active'");
            $stmt->execute([$currentUser['id'], $membership['club_id'], $membership['country'] ?? 'china']);
            $myRole = $stmt->fetchColumn();

            if ($myRole === 'manager' && $membership['role'] !== 'member') {
                echo json_encode(['success' => false, 'message' => '管理员只能踢出普通成员']);
                exit();
            }
            if ($myRole === 'representative' && !in_array($membership['role'], ['member', 'manager'])) {
                echo json_encode(['success' => false, 'message' => '无法踢出该角色的成员']);
                exit();
            }
        }

        $db->prepare("UPDATE club_memberships SET status = 'kicked', left_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$membershipId]);

        logAction('membership.kick', 'club_membership', $membershipId, [
            'club_id' => $membership['club_id'],
            'target_user_id' => $membership['user_id'],
        ]);
        echo json_encode(['success' => true, 'message' => '已踢出成员']);
        exit();

    case 'change_role':
        // 修改成员角色（负责人操作）
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $currentUser = requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        $membershipId = (int)($input['membership_id'] ?? 0);
        $newRole = $input['role'] ?? '';

        if (!$membershipId) {
            echo json_encode(['success' => false, 'message' => '无效的成员 ID']);
            exit();
        }

        $validRoles = ['member', 'manager', 'representative'];
        if (!in_array($newRole, $validRoles)) {
            echo json_encode(['success' => false, 'message' => '无效的角色']);
            exit();
        }

        $db = getDB();

        // 获取目标成员记录
        $stmt = $db->prepare("SELECT * FROM club_memberships WHERE id = ?");
        $stmt->execute([$membershipId]);
        $membership = $stmt->fetch();

        if (!$membership || $membership['status'] !== 'active') {
            echo json_encode(['success' => false, 'message' => '未找到活跃的成员记录']);
            exit();
        }

        // 权限检查：是否可管理该俱乐部（按 club_id + country）
        if (!canManageClubInCountry($currentUser, $membership['club_id'], $membership['country'] ?? 'china')) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => '权限不足']);
            exit();
        }

        // 非 super_admin 权限限制
        if ($currentUser['role'] !== 'super_admin') {
            // 获取当前用户在俱乐部中的角色（按 club_id + country）
            $stmt = $db->prepare("SELECT role FROM club_memberships WHERE user_id = ? AND club_id = ? AND country = ? AND status = 'active'");
            $stmt->execute([$currentUser['id'], $membership['club_id'], $membership['country'] ?? 'china']);
            $myRole = $stmt->fetchColumn();

            // 只有负责人可以修改角色
            if ($myRole !== 'representative') {
                echo json_encode(['success' => false, 'message' => '只有负责人可以修改成员角色']);
                exit();
            }

            // 不能设为负责人
            if ($newRole === 'representative') {
                echo json_encode(['success' => false, 'message' => '无权设置为负责人角色']);
                exit();
            }

            // 不能修改负责人的角色
            if ($membership['role'] === 'representative') {
                echo json_encode(['success' => false, 'message' => '无法修改负责人的角色']);
                exit();
            }
        }

        $oldRole = $membership['role'];
        $db->prepare("UPDATE club_memberships SET role = ? WHERE id = ?")
            ->execute([$newRole, $membershipId]);

        logAction('membership.change_role', 'club_membership', $membershipId, [
            'club_id' => $membership['club_id'],
            'old_role' => $oldRole,
            'new_role' => $newRole,
        ]);
        echo json_encode(['success' => true, 'message' => '角色已更新']);
        exit();

    case 'transfer':
        // 转让负责人身份
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
            exit();
        }
        $currentUser = requireLogin();
        $input = json_decode(file_get_contents('php://input'), true);
        $targetMembershipId = (int)($input['membership_id'] ?? 0);
        $clubId = (int)($input['club_id'] ?? 0);
        $country = $input['country'] ?? 'china';

        if (!$targetMembershipId || !$clubId) {
            echo json_encode(['success' => false, 'message' => '参数不完整']);
            exit();
        }

        $db = getDB();

        // 验证当前用户是俱乐部的负责人（按 club_id + country）
        $stmt = $db->prepare("SELECT role FROM club_memberships WHERE user_id = ? AND club_id = ? AND country = ? AND status = 'active'");
        $stmt->execute([$currentUser['id'], $clubId, $country]);
        $myRole = $stmt->fetchColumn();
        if ($myRole !== 'representative') {
            echo json_encode(['success' => false, 'message' => '只有负责人可以转让身份']);
            exit();
        }

        // 获取目标成员记录
        $stmt = $db->prepare("SELECT * FROM club_memberships WHERE id = ? AND club_id = ? AND country = ? AND status = 'active'");
        $stmt->execute([$targetMembershipId, $clubId, $country]);
        $target = $stmt->fetch();

        if (!$target) {
            echo json_encode(['success' => false, 'message' => '未找到目标成员']);
            exit();
        }
        if ((int)$target['user_id'] === (int)$currentUser['id']) {
            echo json_encode(['success' => false, 'message' => '不能转让给自己']);
            exit();
        }
        if ($target['role'] === 'representative') {
            echo json_encode(['success' => false, 'message' => '目标已经是负责人']);
            exit();
        }

        // 事务：交换角色
        $db->beginTransaction();
        try {
            // 当前负责人降级为管理员
            $stmt = $db->prepare("UPDATE club_memberships SET role = 'manager' WHERE user_id = ? AND club_id = ? AND country = ? AND status = 'active'");
            $stmt->execute([$currentUser['id'], $clubId, $country]);

            // 目标升为负责人
            $stmt = $db->prepare("UPDATE club_memberships SET role = 'representative' WHERE id = ? AND club_id = ? AND status = 'active'");
            $stmt->execute([$targetMembershipId, $clubId]);

            logAction('membership.transfer', 'club_membership', $targetMembershipId, [
                'club_id' => $clubId,
                'from_user_id' => $currentUser['id'],
                'to_user_id' => $target['user_id'],
            ]);
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            echo json_encode(['success' => false, 'message' => '操作失败：' . $e->getMessage()]);
            exit();
        }

        echo json_encode(['success' => true, 'message' => '负责人已转让']);
        exit();

    default:
        echo json_encode(['success' => false, 'message' => '未知动作', 'available_actions' => [
            'my', 'apply', 'approve', 'reject', 'pending', 'members', 'leave', 'kick', 'change_role', 'transfer'
        ]]);
        exit();
}

// ====== 辅助函数 ======

/**
 * 检查用户是否有权限管理指定国家的俱乐部（解决中日 ID 重叠问题）
 */
function canManageClubInCountry(array $user, int $clubId, string $country): bool {
    if ($user['role'] === 'super_admin') return true;
    $db = getDB();
    try {
        $stmt = $db->prepare(
            "SELECT id FROM club_memberships WHERE user_id = ? AND club_id = ? AND country = ? AND role IN ('representative', 'manager') AND status = 'active'"
        );
        $stmt->execute([$user['id'], $clubId, $country]);
        return (bool)$stmt->fetch();
    } catch (Exception $e) {
        // country 列不存在时回退到不区分国家的检查
        return canManageClub($user, $clubId);
    }
}

/**
 * 将 club_memberships 的唯一约束升级为包含 country
 * 旧: UNIQUE(user_id, club_id) → 新: UNIQUE(user_id, club_id, country)
 */
function ensureUniqueConstraintIncludesCountry(PDO $db): void {
    try {
        // 尝试直接创建新索引——如果已存在则忽略错误
        $db->exec("ALTER TABLE club_memberships ADD UNIQUE INDEX `uk_user_club_country` (`user_id`, `club_id`, `country`)");
        // 创建成功 => 旧索引 'user_id' 还在，需要删除
        try { $db->exec("ALTER TABLE club_memberships DROP INDEX `user_id`"); } catch (Exception $e2) {}
        try { $db->exec("ALTER TABLE club_memberships DROP INDEX `uk_user_club`"); } catch (Exception $e2) {}
    } catch (Exception $e) {
        // uk_user_club_country 已存在 => 是最新格式，不需要改动
    }
}

/**
 * 检查列是否存在，不存在则添加（兼容 MySQL 和 SQLite）
 */
function ensureColumnExists(PDO $db, string $table, string $column, string $definition): void {
    try {
        // SQLite
        $stmt = $db->query("PRAGMA table_info($table)");
        $cols = $stmt->fetchAll(PDO::FETCH_COLUMN, 1);
        if (in_array($column, $cols)) return;
    } catch (Exception $e) {
        // MySQL
        try {
            $stmt = $db->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
            if ($stmt->fetch()) return;
        } catch (Exception $e2) {}
    }
    try {
        $db->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
    } catch (Exception $e) {}
}

