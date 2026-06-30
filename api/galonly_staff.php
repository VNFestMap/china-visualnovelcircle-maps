<?php
// api/galonly_staff.php - GalOnly staff application API
// Actions: get_my, submit, list_applications, vote, withdraw_vote, update_status

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

function galonlyStaffRespond(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit();
}

function galonlyStaffJsonInput(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function galonlyStaffEnsureSchema(PDO $db): void {
    $isMysql = defined('DB_DRIVER') && DB_DRIVER === 'mysql';
    if ($isMysql) {
        $db->exec("
            CREATE TABLE IF NOT EXISTS galonly_staff_applications (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                event_id        INT NOT NULL,
                user_id         INT NOT NULL,
                real_name       VARCHAR(120) NOT NULL DEFAULT '',
                contact         VARCHAR(255) NOT NULL DEFAULT '',
                preferred_roles TEXT,
                availability    TEXT,
                experience      TEXT,
                notes           TEXT,
                status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                reviewer_notes  TEXT,
                created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_galonly_staff_user_event (user_id, event_id),
                FOREIGN KEY (event_id) REFERENCES galonly_events(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        try { $db->exec("CREATE INDEX idx_galonly_staff_event ON galonly_staff_applications(event_id)"); } catch (PDOException $e) {}
        try { $db->exec("CREATE INDEX idx_galonly_staff_status ON galonly_staff_applications(status)"); } catch (PDOException $e) {}
        $db->exec("
            CREATE TABLE IF NOT EXISTS galonly_staff_votes (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                application_id  INT NOT NULL,
                auditer_id      INT NOT NULL,
                vote            VARCHAR(10) NOT NULL,
                created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_galonly_staff_vote (application_id, auditer_id),
                FOREIGN KEY (application_id) REFERENCES galonly_staff_applications(id),
                FOREIGN KEY (auditer_id) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        try { $db->exec("CREATE INDEX idx_galonly_staff_votes_app ON galonly_staff_votes(application_id)"); } catch (PDOException $e) {}
        return;
    }

    $db->exec("
        CREATE TABLE IF NOT EXISTS galonly_staff_applications (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id        INTEGER NOT NULL REFERENCES galonly_events(id),
            user_id         INTEGER NOT NULL REFERENCES users(id),
            real_name       TEXT NOT NULL DEFAULT '',
            contact         TEXT NOT NULL DEFAULT '',
            preferred_roles TEXT,
            availability    TEXT,
            experience      TEXT,
            notes           TEXT,
            status          TEXT NOT NULL DEFAULT 'pending'
                            CHECK(status IN ('pending','approved','rejected')),
            reviewer_notes  TEXT,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(user_id, event_id)
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_galonly_staff_event ON galonly_staff_applications(event_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_galonly_staff_status ON galonly_staff_applications(status)");
    $db->exec("
        CREATE TABLE IF NOT EXISTS galonly_staff_votes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id  INTEGER NOT NULL REFERENCES galonly_staff_applications(id),
            auditer_id      INTEGER NOT NULL REFERENCES users(id),
            vote            TEXT NOT NULL CHECK(vote IN ('approve','reject')),
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(application_id, auditer_id)
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_galonly_staff_votes_app ON galonly_staff_votes(application_id)");
}

function galonlyStaffDecodeRoles(?string $raw): array {
    $decoded = json_decode((string)$raw, true);
    return is_array($decoded) ? array_values($decoded) : [];
}

function galonlyStaffNormalizeRoles($roles): array {
    $allowed = ['checkin', 'guide', 'queue', 'booth', 'stage', 'media', 'logistics', 'other'];
    if (!is_array($roles)) {
        return [];
    }

    $result = [];
    foreach ($roles as $role) {
        $role = trim((string)$role);
        if (in_array($role, $allowed, true) && !in_array($role, $result, true)) {
            $result[] = $role;
        }
    }
    return $result;
}

function galonlyStaffHydrate(array $row): array {
    $row['preferred_roles'] = galonlyStaffDecodeRoles($row['preferred_roles'] ?? '');
    return $row;
}

function galonlyStaffVoteCounts(PDO $db, int $applicationId): array {
    $stmt = $db->prepare("SELECT vote, COUNT(*) as cnt FROM galonly_staff_votes WHERE application_id = ? GROUP BY vote");
    $stmt->execute([$applicationId]);
    $counts = ['approve' => 0, 'reject' => 0];
    foreach ($stmt->fetchAll() as $row) {
        if (isset($counts[$row['vote']])) {
            $counts[$row['vote']] = (int)$row['cnt'];
        }
    }
    return $counts;
}

function galonlyStaffStatusFromVotes(array $counts): string {
    if (($counts['approve'] ?? 0) >= 4) {
        return 'approved';
    }
    if (($counts['reject'] ?? 0) >= 4) {
        return 'rejected';
    }
    return 'pending';
}

$db = getDB();
galonlyStaffEnsureSchema($db);

switch ($action) {
    case 'get_my':
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            galonlyStaffRespond(['success' => false, 'message' => '仅支持 GET 请求'], 405);
        }

        $user = requireLogin();
        $eventId = (int)($_GET['event_id'] ?? 0);
        if (!$eventId) {
            galonlyStaffRespond(['success' => false, 'message' => '缺少 event_id 参数']);
        }

        $stmt = $db->prepare("SELECT * FROM galonly_staff_applications WHERE event_id = ? AND user_id = ? LIMIT 1");
        $stmt->execute([$eventId, $user['id']]);
        $application = $stmt->fetch();
        galonlyStaffRespond([
            'success' => true,
            'application' => $application ? galonlyStaffHydrate($application) : null,
        ]);

    case 'submit':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            galonlyStaffRespond(['success' => false, 'message' => '仅支持 POST 请求'], 405);
        }

        $user = requireLogin();
        $input = galonlyStaffJsonInput();

        $eventId = (int)($input['event_id'] ?? 0);
        $realName = trim((string)($input['real_name'] ?? ''));
        $contact = trim((string)($input['contact'] ?? ''));
        $availability = trim((string)($input['availability'] ?? ''));
        $experience = trim((string)($input['experience'] ?? ''));
        $notes = trim((string)($input['notes'] ?? ''));
        $roles = galonlyStaffNormalizeRoles($input['preferred_roles'] ?? []);

        if (!$eventId) {
            galonlyStaffRespond(['success' => false, 'message' => '请选择活动']);
        }
        if ($realName === '') {
            galonlyStaffRespond(['success' => false, 'message' => '请填写姓名或称呼']);
        }
        if ($contact === '') {
            galonlyStaffRespond(['success' => false, 'message' => '请填写联系方式']);
        }
        if (empty($roles)) {
            galonlyStaffRespond(['success' => false, 'message' => '请至少选择一个可协助岗位']);
        }
        if ($availability === '') {
            galonlyStaffRespond(['success' => false, 'message' => '请填写可协助时间']);
        }

        $stmt = $db->prepare("SELECT id FROM galonly_events WHERE id = ?");
        $stmt->execute([$eventId]);
        if (!$stmt->fetch()) {
            galonlyStaffRespond(['success' => false, 'message' => '活动不存在']);
        }

        $now = date('Y-m-d H:i:s');
        $roleJson = json_encode($roles, JSON_UNESCAPED_UNICODE);

        $stmt = $db->prepare("SELECT id, status FROM galonly_staff_applications WHERE event_id = ? AND user_id = ? LIMIT 1");
        $stmt->execute([$eventId, $user['id']]);
        $existing = $stmt->fetch();

        if ($existing) {
            $nextStatus = ($existing['status'] === 'rejected') ? 'pending' : $existing['status'];
            if ($existing['status'] === 'rejected') {
                $db->prepare("DELETE FROM galonly_staff_votes WHERE application_id = ?")->execute([$existing['id']]);
            }
            $stmt = $db->prepare(
                "UPDATE galonly_staff_applications
                 SET real_name = ?, contact = ?, preferred_roles = ?, availability = ?, experience = ?, notes = ?, status = ?, updated_at = ?
                 WHERE id = ?"
            );
            $stmt->execute([$realName, $contact, $roleJson, $availability, $experience, $notes, $nextStatus, $now, $existing['id']]);
            logAction('galonly_staff.update', 'galonly_staff_application', (int)$existing['id']);
            galonlyStaffRespond([
                'success' => true,
                'application_id' => (int)$existing['id'],
                'message' => '工作人员申请已更新',
            ]);
        }

        $stmt = $db->prepare(
            "INSERT INTO galonly_staff_applications
             (event_id, user_id, real_name, contact, preferred_roles, availability, experience, notes, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)"
        );
        $stmt->execute([$eventId, $user['id'], $realName, $contact, $roleJson, $availability, $experience, $notes, $now, $now]);
        $applicationId = (int)$db->lastInsertId();
        logAction('galonly_staff.submit', 'galonly_staff_application', $applicationId);

        galonlyStaffRespond([
            'success' => true,
            'application_id' => $applicationId,
            'message' => '工作人员申请已提交',
        ]);

    case 'list_applications':
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            galonlyStaffRespond(['success' => false, 'message' => '仅支持 GET 请求'], 405);
        }

        $user = requireLogin();
        if (!hasAuditPermission($user)) {
            galonlyStaffRespond(['success' => false, 'message' => '权限不足'], 403);
        }

        $eventId = (int)($_GET['event_id'] ?? 0);
        $status = trim((string)($_GET['status'] ?? ''));

        $sql = "SELECT s.*, u.username, u.nickname, u.avatar_url, e.name AS event_name
                FROM galonly_staff_applications s
                JOIN users u ON s.user_id = u.id
                JOIN galonly_events e ON s.event_id = e.id
                WHERE 1=1";
        $params = [];
        if ($eventId) {
            $sql .= " AND s.event_id = ?";
            $params[] = $eventId;
        }
        if ($status !== '' && $status !== 'all') {
            $sql .= " AND s.status = ?";
            $params[] = $status;
        }
        $sql .= " ORDER BY s.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $applications = array_map('galonlyStaffHydrate', $stmt->fetchAll());
        foreach ($applications as &$application) {
            $applicationId = (int)$application['id'];
            $application['vote_counts'] = galonlyStaffVoteCounts($db, $applicationId);
            $stmt = $db->prepare("SELECT vote FROM galonly_staff_votes WHERE application_id = ? AND auditer_id = ?");
            $stmt->execute([$applicationId, $user['id']]);
            $application['my_vote'] = $stmt->fetchColumn() ?: null;
        }
        unset($application);
        galonlyStaffRespond(['success' => true, 'applications' => $applications]);

    case 'vote':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            galonlyStaffRespond(['success' => false, 'message' => '仅支持 POST 请求'], 405);
        }

        $user = requireLogin();
        if (!hasAuditPermission($user)) {
            galonlyStaffRespond(['success' => false, 'message' => '权限不足'], 403);
        }

        $input = galonlyStaffJsonInput();
        $applicationId = (int)($input['application_id'] ?? 0);
        $vote = trim((string)($input['vote'] ?? ''));

        if (!$applicationId) {
            galonlyStaffRespond(['success' => false, 'message' => '缺少 application_id']);
        }
        if (!in_array($vote, ['approve', 'reject'], true)) {
            galonlyStaffRespond(['success' => false, 'message' => '投票值必须为 approve 或 reject']);
        }

        $stmt = $db->prepare("SELECT id, status FROM galonly_staff_applications WHERE id = ?");
        $stmt->execute([$applicationId]);
        $application = $stmt->fetch();
        if (!$application) {
            galonlyStaffRespond(['success' => false, 'message' => '申请不存在']);
        }

        $stmt = $db->prepare("SELECT id FROM galonly_staff_votes WHERE application_id = ? AND auditer_id = ?");
        $stmt->execute([$applicationId, $user['id']]);
        if ($stmt->fetch()) {
            galonlyStaffRespond(['success' => false, 'message' => '您已对该申请投过票']);
        }

        $now = date('Y-m-d H:i:s');
        $db->beginTransaction();
        try {
            $stmt = $db->prepare("INSERT INTO galonly_staff_votes (application_id, auditer_id, vote) VALUES (?, ?, ?)");
            $stmt->execute([$applicationId, $user['id'], $vote]);

            $voteCounts = galonlyStaffVoteCounts($db, $applicationId);
            $result = galonlyStaffStatusFromVotes($voteCounts);
            if ($result !== ($application['status'] ?? 'pending')) {
                $db->prepare("UPDATE galonly_staff_applications SET status = ?, updated_at = ? WHERE id = ?")
                    ->execute([$result, $now, $applicationId]);
            }

            $db->commit();
            logAction('galonly_staff.vote', 'galonly_staff_application', $applicationId, ['vote' => $vote, 'result' => $result]);
            galonlyStaffRespond([
                'success' => true,
                'result' => $result,
                'votes' => $voteCounts,
            ]);
        } catch (Exception $e) {
            $db->rollBack();
            galonlyStaffRespond(['success' => false, 'message' => '投票失败：' . $e->getMessage()]);
        }

    case 'withdraw_vote':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            galonlyStaffRespond(['success' => false, 'message' => '仅支持 POST 请求'], 405);
        }

        $user = requireLogin();
        if (!hasAuditPermission($user)) {
            galonlyStaffRespond(['success' => false, 'message' => '权限不足'], 403);
        }

        $input = galonlyStaffJsonInput();
        $applicationId = (int)($input['application_id'] ?? 0);
        if (!$applicationId) {
            galonlyStaffRespond(['success' => false, 'message' => '缺少 application_id']);
        }

        $stmt = $db->prepare("SELECT id, status FROM galonly_staff_applications WHERE id = ?");
        $stmt->execute([$applicationId]);
        $application = $stmt->fetch();
        if (!$application) {
            galonlyStaffRespond(['success' => false, 'message' => '申请不存在']);
        }

        $stmt = $db->prepare("SELECT id FROM galonly_staff_votes WHERE application_id = ? AND auditer_id = ?");
        $stmt->execute([$applicationId, $user['id']]);
        $existingVote = $stmt->fetch();
        if (!$existingVote) {
            galonlyStaffRespond(['success' => false, 'message' => '你尚未对该申请投票']);
        }

        $now = date('Y-m-d H:i:s');
        $db->beginTransaction();
        try {
            $stmt = $db->prepare("DELETE FROM galonly_staff_votes WHERE id = ?");
            $stmt->execute([$existingVote['id']]);

            $voteCounts = galonlyStaffVoteCounts($db, $applicationId);
            $result = galonlyStaffStatusFromVotes($voteCounts);
            if ($result !== ($application['status'] ?? 'pending')) {
                $db->prepare("UPDATE galonly_staff_applications SET status = ?, updated_at = ? WHERE id = ?")
                    ->execute([$result, $now, $applicationId]);
            }

            $db->commit();
            logAction('galonly_staff.withdraw_vote', 'galonly_staff_application', $applicationId);
            galonlyStaffRespond([
                'success' => true,
                'result' => $result,
                'votes' => $voteCounts,
            ]);
        } catch (Exception $e) {
            $db->rollBack();
            galonlyStaffRespond(['success' => false, 'message' => '撤回投票失败：' . $e->getMessage()]);
        }

    case 'update_status':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            galonlyStaffRespond(['success' => false, 'message' => '仅支持 POST 请求'], 405);
        }

        $user = requireLogin();
        if (!hasAuditPermission($user)) {
            galonlyStaffRespond(['success' => false, 'message' => '权限不足'], 403);
        }

        $input = galonlyStaffJsonInput();
        $applicationId = (int)($input['application_id'] ?? 0);
        $status = trim((string)($input['status'] ?? ''));
        $reviewerNotes = trim((string)($input['reviewer_notes'] ?? ''));

        if (!$applicationId) {
            galonlyStaffRespond(['success' => false, 'message' => '缺少 application_id']);
        }
        if (!in_array($status, ['pending', 'approved', 'rejected'], true)) {
            galonlyStaffRespond(['success' => false, 'message' => '状态值无效']);
        }

        $stmt = $db->prepare("SELECT user_id, event_id FROM galonly_staff_applications WHERE id = ?");
        $stmt->execute([$applicationId]);
        $application = $stmt->fetch();
        if (!$application) {
            galonlyStaffRespond(['success' => false, 'message' => '申请不存在']);
        }

        $stmt = $db->prepare(
            "UPDATE galonly_staff_applications
             SET status = ?, reviewer_notes = ?, updated_at = ?
             WHERE id = ?"
        );
        $stmt->execute([$status, $reviewerNotes, date('Y-m-d H:i:s'), $applicationId]);
        logAction('galonly_staff.update_status', 'galonly_staff_application', $applicationId, ['status' => $status]);

        galonlyStaffRespond(['success' => true, 'message' => '状态已更新']);

    default:
        galonlyStaffRespond(['success' => false, 'message' => '未知动作', 'available_actions' => [
            'get_my', 'submit', 'list_applications', 'vote', 'withdraw_vote', 'update_status',
        ]]);
}
