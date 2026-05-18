<?php
// includes/moe.php - self-service moe contest helpers and schema

require_once __DIR__ . '/auth.php';

const MOE_CONTEST_STATUSES = ['draft', 'published', 'running', 'settling', 'ended', 'archived', 'suspended'];
const MOE_STAGE_STATUSES = ['pending', 'open', 'locked', 'settled', 'skipped'];
const MOE_STAGE_TYPES = ['nomination', 'qualifier', 'group_vote', 'bracket', 'revival', 'final'];
const MOE_ELIGIBILITY_MODES = ['public', 'club_member', 'invite_code', 'whitelist'];
const MOE_RESULT_VISIBILITIES = ['live_votes', 'live_rank_only', 'after_stage', 'after_event', 'hidden'];

function moeIsMysql(): bool {
    return defined('DB_DRIVER') && DB_DRIVER === 'mysql';
}

function moeTryExec(PDO $db, string $sql): void {
    try {
        $db->exec($sql);
    } catch (Throwable $e) {
        // Schema helpers are idempotent and ignore duplicate indexes/columns.
    }
}

function moeNowExpr(): string {
    return moeIsMysql() ? 'NOW()' : "datetime('now')";
}

function moeEnsureSchema(?PDO $db = null): void {
    $db = $db ?: getDB();

    if (moeIsMysql()) {
        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_contests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                club_id INT NOT NULL,
                country VARCHAR(20) NOT NULL DEFAULT 'china',
                title VARCHAR(255) NOT NULL,
                description TEXT,
                cover_url VARCHAR(500) DEFAULT '',
                candidate_mode VARCHAR(50) NOT NULL DEFAULT 'character_custom',
                status VARCHAR(30) NOT NULL DEFAULT 'draft',
                visibility VARCHAR(30) NOT NULL DEFAULT 'public',
                eligibility_mode VARCHAR(30) NOT NULL DEFAULT 'public',
                result_visibility VARCHAR(30) NOT NULL DEFAULT 'live_rank_only',
                created_by INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                published_at DATETIME,
                ended_at DATETIME,
                FOREIGN KEY (created_by) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        moeTryExec($db, "CREATE INDEX idx_moe_contests_club ON moe_contests(club_id, country, status)");
        moeTryExec($db, "CREATE INDEX idx_moe_contests_status ON moe_contests(status, updated_at)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_contest_stages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                contest_id INT NOT NULL,
                stage_type VARCHAR(30) NOT NULL,
                title VARCHAR(255) NOT NULL,
                sort_order INT NOT NULL DEFAULT 0,
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                starts_at DATETIME,
                ends_at DATETIME,
                vote_mode VARCHAR(30) NOT NULL DEFAULT 'fixed_per_stage',
                votes_per_user INT NOT NULL DEFAULT 1,
                allow_vote_change TINYINT(1) NOT NULL DEFAULT 0,
                allow_duplicate_candidate_vote TINYINT(1) NOT NULL DEFAULT 0,
                advance_rule TEXT,
                visibility_rule TEXT,
                config_json TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (contest_id) REFERENCES moe_contests(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        moeTryExec($db, "CREATE INDEX idx_moe_stages_contest ON moe_contest_stages(contest_id, sort_order)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_candidates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                contest_id INT NOT NULL,
                source VARCHAR(30) NOT NULL DEFAULT 'manual',
                subject_id INT,
                character_id INT,
                name VARCHAR(255) NOT NULL,
                name_cn VARCHAR(255) DEFAULT '',
                subject_name VARCHAR(255) DEFAULT '',
                subject_name_cn VARCHAR(255) DEFAULT '',
                avatar_url VARCHAR(500) DEFAULT '',
                summary TEXT,
                custom_fields_json TEXT,
                identity_key VARCHAR(255) DEFAULT '',
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                created_by INT NOT NULL,
                reviewed_by INT,
                reviewed_at DATETIME,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (contest_id) REFERENCES moe_contests(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        moeTryExec($db, "CREATE INDEX idx_moe_candidates_contest ON moe_candidates(contest_id, status)");
        moeTryExec($db, "ALTER TABLE moe_candidates ADD COLUMN identity_key VARCHAR(255) DEFAULT ''");
        moeTryExec($db, "CREATE INDEX idx_moe_candidates_identity ON moe_candidates(contest_id, identity_key)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_candidate_nominations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                contest_id INT NOT NULL,
                stage_id INT NOT NULL,
                candidate_id INT NOT NULL,
                user_id INT NOT NULL,
                source VARCHAR(30) NOT NULL DEFAULT 'manual',
                subject_id INT,
                character_id INT,
                name VARCHAR(255) NOT NULL,
                name_cn VARCHAR(255) DEFAULT '',
                subject_name VARCHAR(255) DEFAULT '',
                subject_name_cn VARCHAR(255) DEFAULT '',
                avatar_url VARCHAR(500) DEFAULT '',
                summary TEXT,
                identity_key VARCHAR(255) NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'active',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (contest_id) REFERENCES moe_contests(id),
                FOREIGN KEY (stage_id) REFERENCES moe_contest_stages(id),
                FOREIGN KEY (candidate_id) REFERENCES moe_candidates(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        moeTryExec($db, "CREATE INDEX idx_moe_nominations_stage_user ON moe_candidate_nominations(stage_id, user_id, status)");
        moeTryExec($db, "CREATE INDEX idx_moe_nominations_candidate ON moe_candidate_nominations(stage_id, candidate_id, status)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_stage_entries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                stage_id INT NOT NULL,
                candidate_id INT NOT NULL,
                group_key VARCHAR(50) DEFAULT '',
                seed_no INT,
                source_stage_id INT,
                source_rank INT,
                status VARCHAR(30) NOT NULL DEFAULT 'active',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stage_id) REFERENCES moe_contest_stages(id),
                FOREIGN KEY (candidate_id) REFERENCES moe_candidates(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        moeTryExec($db, "CREATE INDEX idx_moe_entries_stage ON moe_stage_entries(stage_id, group_key, seed_no)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_matches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                stage_id INT NOT NULL,
                round_no INT NOT NULL DEFAULT 1,
                match_no INT NOT NULL DEFAULT 1,
                slot_a_candidate_id INT,
                slot_b_candidate_id INT,
                winner_candidate_id INT,
                source_match_a_id INT,
                source_match_b_id INT,
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                starts_at DATETIME,
                ends_at DATETIME,
                tie_break_rule VARCHAR(50) DEFAULT 'extra_match',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stage_id) REFERENCES moe_contest_stages(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        moeTryExec($db, "CREATE INDEX idx_moe_matches_stage ON moe_matches(stage_id, round_no, match_no)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_votes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                contest_id INT NOT NULL,
                stage_id INT NOT NULL,
                match_id INT,
                candidate_id INT NOT NULL,
                user_id INT NOT NULL,
                vote_date DATE,
                ip_hash VARCHAR(128) DEFAULT '',
                user_agent_hash VARCHAR(128) DEFAULT '',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (contest_id) REFERENCES moe_contests(id),
                FOREIGN KEY (stage_id) REFERENCES moe_contest_stages(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        moeTryExec($db, "CREATE INDEX idx_moe_votes_stage_user ON moe_votes(stage_id, user_id, created_at)");
        moeTryExec($db, "CREATE INDEX idx_moe_votes_match_user ON moe_votes(match_id, user_id)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_invites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                contest_id INT NOT NULL,
                code VARCHAR(64) NOT NULL,
                max_uses INT NOT NULL DEFAULT 1,
                use_count INT NOT NULL DEFAULT 0,
                expires_at DATETIME,
                created_by INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                UNIQUE(contest_id, code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_whitelist (
                id INT AUTO_INCREMENT PRIMARY KEY,
                contest_id INT NOT NULL,
                user_id INT NOT NULL,
                created_by INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(contest_id, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    } else {
        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_contests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                club_id INTEGER NOT NULL,
                country TEXT NOT NULL DEFAULT 'china',
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                cover_url TEXT DEFAULT '',
                candidate_mode TEXT NOT NULL DEFAULT 'character_custom',
                status TEXT NOT NULL DEFAULT 'draft',
                visibility TEXT NOT NULL DEFAULT 'public',
                eligibility_mode TEXT NOT NULL DEFAULT 'public',
                result_visibility TEXT NOT NULL DEFAULT 'live_rank_only',
                created_by INTEGER NOT NULL REFERENCES users(id),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                published_at TEXT,
                ended_at TEXT
            )
        ");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_moe_contests_club ON moe_contests(club_id, country, status)");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_moe_contests_status ON moe_contests(status, updated_at)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_contest_stages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contest_id INTEGER NOT NULL REFERENCES moe_contests(id),
                stage_type TEXT NOT NULL,
                title TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                starts_at TEXT,
                ends_at TEXT,
                vote_mode TEXT NOT NULL DEFAULT 'fixed_per_stage',
                votes_per_user INTEGER NOT NULL DEFAULT 1,
                allow_vote_change INTEGER NOT NULL DEFAULT 0,
                allow_duplicate_candidate_vote INTEGER NOT NULL DEFAULT 0,
                advance_rule TEXT,
                visibility_rule TEXT,
                config_json TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        ");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_moe_stages_contest ON moe_contest_stages(contest_id, sort_order)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_candidates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contest_id INTEGER NOT NULL REFERENCES moe_contests(id),
                source TEXT NOT NULL DEFAULT 'manual',
                subject_id INTEGER,
                character_id INTEGER,
                name TEXT NOT NULL,
                name_cn TEXT DEFAULT '',
                subject_name TEXT DEFAULT '',
                subject_name_cn TEXT DEFAULT '',
                avatar_url TEXT DEFAULT '',
                summary TEXT DEFAULT '',
                custom_fields_json TEXT,
                identity_key TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                created_by INTEGER NOT NULL REFERENCES users(id),
                reviewed_by INTEGER,
                reviewed_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        ");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_moe_candidates_contest ON moe_candidates(contest_id, status)");
        moeTryExec($db, "ALTER TABLE moe_candidates ADD COLUMN identity_key TEXT DEFAULT ''");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_moe_candidates_identity ON moe_candidates(contest_id, identity_key)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_candidate_nominations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contest_id INTEGER NOT NULL REFERENCES moe_contests(id),
                stage_id INTEGER NOT NULL REFERENCES moe_contest_stages(id),
                candidate_id INTEGER NOT NULL REFERENCES moe_candidates(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                source TEXT NOT NULL DEFAULT 'manual',
                subject_id INTEGER,
                character_id INTEGER,
                name TEXT NOT NULL,
                name_cn TEXT DEFAULT '',
                subject_name TEXT DEFAULT '',
                subject_name_cn TEXT DEFAULT '',
                avatar_url TEXT DEFAULT '',
                summary TEXT DEFAULT '',
                identity_key TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        ");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_moe_nominations_stage_user ON moe_candidate_nominations(stage_id, user_id, status)");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_moe_nominations_candidate ON moe_candidate_nominations(stage_id, candidate_id, status)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_stage_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stage_id INTEGER NOT NULL REFERENCES moe_contest_stages(id),
                candidate_id INTEGER NOT NULL REFERENCES moe_candidates(id),
                group_key TEXT DEFAULT '',
                seed_no INTEGER,
                source_stage_id INTEGER,
                source_rank INTEGER,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        ");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_moe_entries_stage ON moe_stage_entries(stage_id, group_key, seed_no)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stage_id INTEGER NOT NULL REFERENCES moe_contest_stages(id),
                round_no INTEGER NOT NULL DEFAULT 1,
                match_no INTEGER NOT NULL DEFAULT 1,
                slot_a_candidate_id INTEGER,
                slot_b_candidate_id INTEGER,
                winner_candidate_id INTEGER,
                source_match_a_id INTEGER,
                source_match_b_id INTEGER,
                status TEXT NOT NULL DEFAULT 'pending',
                starts_at TEXT,
                ends_at TEXT,
                tie_break_rule TEXT DEFAULT 'extra_match',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        ");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_moe_matches_stage ON moe_matches(stage_id, round_no, match_no)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contest_id INTEGER NOT NULL REFERENCES moe_contests(id),
                stage_id INTEGER NOT NULL REFERENCES moe_contest_stages(id),
                match_id INTEGER,
                candidate_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL REFERENCES users(id),
                vote_date TEXT,
                ip_hash TEXT DEFAULT '',
                user_agent_hash TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        ");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_moe_votes_stage_user ON moe_votes(stage_id, user_id, created_at)");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_moe_votes_match_user ON moe_votes(match_id, user_id)");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_invites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contest_id INTEGER NOT NULL REFERENCES moe_contests(id),
                code TEXT NOT NULL,
                max_uses INTEGER NOT NULL DEFAULT 1,
                use_count INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT,
                created_by INTEGER NOT NULL REFERENCES users(id),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                is_active INTEGER NOT NULL DEFAULT 1,
                UNIQUE(contest_id, code)
            )
        ");

        $db->exec("
            CREATE TABLE IF NOT EXISTS moe_whitelist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contest_id INTEGER NOT NULL REFERENCES moe_contests(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                created_by INTEGER NOT NULL REFERENCES users(id),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(contest_id, user_id)
            )
        ");
    }
}

function moeReadJson(): array {
    $input = json_decode(file_get_contents('php://input'), true);
    return is_array($input) ? $input : [];
}

function moeRespond(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit();
}

function moeNormalizeCountry(?string $country): string {
    $value = trim((string)$country);
    return $value === '' ? 'china' : $value;
}

function moeNormalizeStatus(string $status, array $allowed, string $fallback): string {
    return in_array($status, $allowed, true) ? $status : $fallback;
}

function moeNormalizeTextKey(?string $value): string {
    $value = trim((string)$value);
    $value = function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
    $value = preg_replace('/\s+/u', '', $value);
    return $value ?: '';
}

function moeDecodeJsonObject($value): array {
    if (is_array($value)) return $value;
    if (!is_string($value) || trim($value) === '') return [];
    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}

function moeNormalizeCandidateIdentity(array $candidate): string {
    $characterId = (int)($candidate['character_id'] ?? 0);
    if ($characterId > 0) {
        return 'bangumi-character:' . $characterId;
    }
    $name = moeNormalizeTextKey($candidate['name_cn'] ?? '') ?: moeNormalizeTextKey($candidate['name'] ?? '');
    if ($name === '') return '';
    $subject = moeNormalizeTextKey($candidate['subject_name_cn'] ?? '') ?: moeNormalizeTextKey($candidate['subject_name'] ?? '');
    return $subject !== '' ? 'name-subject:' . $name . '@' . $subject : 'name:' . $name;
}

function moeGetNominationLimit(array $stage): int {
    $config = moeDecodeJsonObject($stage['config_json'] ?? null);
    return max(1, (int)($config['nomination_limit'] ?? 3));
}

function moeNominationAutoApprove(array $stage): bool {
    $config = moeDecodeJsonObject($stage['config_json'] ?? null);
    return !array_key_exists('auto_approve', $config) || !empty($config['auto_approve']);
}

function moeCanManageClub(array $user, int $clubId, string $country, array $roles = ['representative', 'manager']): bool {
    if (($user['role'] ?? '') === 'super_admin') return true;
    if ($clubId <= 0) return false;
    $db = getDB();
    try {
        $placeholders = implode(',', array_fill(0, count($roles), '?'));
        $stmt = $db->prepare(
            "SELECT id FROM club_memberships
             WHERE user_id = ? AND club_id = ? AND country = ? AND status = 'active' AND role IN ($placeholders)"
        );
        $stmt->execute(array_merge([$user['id'], $clubId, $country], $roles));
        return (bool)$stmt->fetch();
    } catch (Throwable $e) {
        $placeholders = implode(',', array_fill(0, count($roles), '?'));
        $stmt = $db->prepare(
            "SELECT id FROM club_memberships
             WHERE user_id = ? AND club_id = ? AND status = 'active' AND role IN ($placeholders)"
        );
        $stmt->execute(array_merge([$user['id'], $clubId], $roles));
        return (bool)$stmt->fetch();
    }
}

function moeCanCreateClubContest(array $user, int $clubId, string $country): bool {
    return moeCanManageClub($user, $clubId, $country, ['representative']);
}

function moeCanOperateClubContest(array $user, int $clubId, string $country): bool {
    return moeCanManageClub($user, $clubId, $country, ['representative', 'manager']);
}

function moeUserIsActiveClubMember(array $user, int $clubId, string $country): bool {
    if (($user['role'] ?? '') === 'super_admin') return true;
    $db = getDB();
    try {
        $stmt = $db->prepare(
            "SELECT id FROM club_memberships
             WHERE user_id = ? AND club_id = ? AND country = ? AND status = 'active'"
        );
        $stmt->execute([$user['id'], $clubId, $country]);
        return (bool)$stmt->fetch();
    } catch (Throwable $e) {
        $stmt = $db->prepare(
            "SELECT id FROM club_memberships
             WHERE user_id = ? AND club_id = ? AND status = 'active'"
        );
        $stmt->execute([$user['id'], $clubId]);
        return (bool)$stmt->fetch();
    }
}

function moeGetContest(int $contestId): ?array {
    if ($contestId <= 0) return null;
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM moe_contests WHERE id = ?");
    $stmt->execute([$contestId]);
    $contest = $stmt->fetch(PDO::FETCH_ASSOC);
    return $contest ?: null;
}

function moeCanManageContest(array $user, array $contest): bool {
    if (empty($contest['id']) || empty($contest['club_id'])) return false;
    return moeCanOperateClubContest($user, (int)$contest['club_id'], moeNormalizeCountry($contest['country'] ?? 'china'));
}

function moeCanCreateContest(array $user, int $clubId, string $country): bool {
    return moeCanCreateClubContest($user, $clubId, $country);
}

function moeCanParticipateContest(array $user, array $contest): bool {
    $mode = $contest['eligibility_mode'] ?? 'public';
    if (($user['role'] ?? '') === 'super_admin') return true;
    if ($mode === 'public') return true;
    if ($mode === 'club_member') {
        return moeUserIsActiveClubMember($user, (int)$contest['club_id'], moeNormalizeCountry($contest['country'] ?? 'china'));
    }
    if ($mode === 'whitelist') {
        $db = getDB();
        $stmt = $db->prepare("SELECT id FROM moe_whitelist WHERE contest_id = ? AND user_id = ?");
        $stmt->execute([(int)$contest['id'], (int)$user['id']]);
        return (bool)$stmt->fetch();
    }
    if ($mode === 'invite_code') {
        return true;
    }
    return false;
}

function moeFindExistingCandidateByIdentity(PDO $db, int $contestId, array $candidate, string $identityKey): ?array {
    if ($identityKey !== '') {
        $stmt = $db->prepare("SELECT * FROM moe_candidates WHERE contest_id = ? AND identity_key = ? ORDER BY id ASC LIMIT 1");
        $stmt->execute([$contestId, $identityKey]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) return $existing;
    }

    $characterId = (int)($candidate['character_id'] ?? 0);
    if ($characterId > 0) {
        $stmt = $db->prepare("SELECT * FROM moe_candidates WHERE contest_id = ? AND character_id = ? ORDER BY id ASC LIMIT 1");
        $stmt->execute([$contestId, $characterId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) return $existing;
    }

    return null;
}

function moeFindOrCreateCandidateFromNomination(PDO $db, array $contest, array $stage, array $candidate, array $user): array {
    $identityKey = moeNormalizeCandidateIdentity($candidate);
    if ($identityKey === '') {
        moeRespond(['success' => false, 'message' => '请填写可识别的角色名称'], 400);
    }

    $existing = moeFindExistingCandidateByIdentity($db, (int)$contest['id'], $candidate, $identityKey);
    if ($existing) {
        if (($existing['identity_key'] ?? '') === '') {
            $now = moeNowExpr();
            $stmt = $db->prepare("UPDATE moe_candidates SET identity_key = ?, updated_at = $now WHERE id = ?");
            $stmt->execute([$identityKey, (int)$existing['id']]);
            $existing['identity_key'] = $identityKey;
        }
        return $existing;
    }

    $custom = moeDecodeJsonObject($candidate['custom_fields_json'] ?? null);
    $custom['identity_key'] = $identityKey;
    $custom['nomination_stage_id'] = (int)$stage['id'];
    $name = trim((string)($candidate['name'] ?? '')) ?: trim((string)($candidate['name_cn'] ?? ''));
    $status = moeNominationAutoApprove($stage) ? 'approved' : 'pending';
    $stmt = $db->prepare(
        "INSERT INTO moe_candidates
         (contest_id, source, subject_id, character_id, name, name_cn, subject_name, subject_name_cn,
          avatar_url, summary, custom_fields_json, identity_key, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        (int)$contest['id'],
        $candidate['source'] ?? 'manual',
        $candidate['subject_id'] ?? null,
        $candidate['character_id'] ?? null,
        $name,
        $candidate['name_cn'] ?? '',
        $candidate['subject_name'] ?? '',
        $candidate['subject_name_cn'] ?? '',
        $candidate['avatar_url'] ?? '',
        $candidate['summary'] ?? '',
        json_encode($custom, JSON_UNESCAPED_UNICODE),
        $identityKey,
        $status,
        (int)$user['id'],
    ]);
    $id = (int)$db->lastInsertId();
    $stmt = $db->prepare("SELECT * FROM moe_candidates WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function moeSettleNominationStage(PDO $db, array $stage): int {
    if (($stage['stage_type'] ?? '') !== 'nomination') {
        return 0;
    }
    $nextStmt = $db->prepare(
        "SELECT * FROM moe_contest_stages
         WHERE contest_id = ? AND sort_order > ?
         ORDER BY sort_order ASC, id ASC LIMIT 1"
    );
    $nextStmt->execute([(int)$stage['contest_id'], (int)$stage['sort_order']]);
    $next = $nextStmt->fetch(PDO::FETCH_ASSOC);
    if (!$next || !in_array($next['stage_type'], ['qualifier', 'group_vote'], true)) {
        return 0;
    }

    $candidateStmt = $db->prepare(
        "SELECT DISTINCT c.id
         FROM moe_candidate_nominations n
         JOIN moe_candidates c ON c.id = n.candidate_id
         WHERE n.stage_id = ? AND n.status = 'active' AND c.status = 'approved'
         ORDER BY c.id ASC"
    );
    $candidateStmt->execute([(int)$stage['id']]);
    $insert = $db->prepare(
        "INSERT INTO moe_stage_entries (stage_id, candidate_id, source_stage_id, status)
         SELECT ?, ?, ?, 'active'
         WHERE NOT EXISTS (
             SELECT 1 FROM moe_stage_entries WHERE stage_id = ? AND candidate_id = ?
         )"
    );
    $count = 0;
    foreach ($candidateStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $insert->execute([(int)$next['id'], (int)$row['id'], (int)$stage['id'], (int)$next['id'], (int)$row['id']]);
        $count += $insert->rowCount() > 0 ? 1 : 0;
    }
    return $count;
}

function moeCreateStandardContestStages(PDO $db, int $contestId): void {
    if ($contestId <= 0) return;

    $countStmt = $db->prepare("SELECT COUNT(*) FROM moe_contest_stages WHERE contest_id = ?");
    $countStmt->execute([$contestId]);
    if ((int)$countStmt->fetchColumn() > 0) {
        return;
    }

    $insert = $db->prepare(
        "INSERT INTO moe_contest_stages
         (contest_id, stage_type, title, sort_order, status, vote_mode, votes_per_user,
          allow_vote_change, allow_duplicate_candidate_vote, advance_rule, visibility_rule, config_json)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)"
    );
    $visibility = json_encode(['result_visibility' => 'live_rank_only'], JSON_UNESCAPED_UNICODE);
    $stages = [
        [
            'stage_type' => 'nomination',
            'title' => '提名阶段',
            'sort_order' => 1,
            'vote_mode' => 'fixed_per_stage',
            'votes_per_user' => 1,
            'allow_vote_change' => 0,
            'allow_duplicate_candidate_vote' => 0,
            'advance_rule' => null,
            'visibility_rule' => $visibility,
            'config_json' => json_encode(['nomination_limit' => 3, 'auto_approve' => true], JSON_UNESCAPED_UNICODE),
        ],
        [
            'stage_type' => 'qualifier',
            'title' => '海选阶段',
            'sort_order' => 2,
            'vote_mode' => 'fixed_per_stage',
            'votes_per_user' => 5,
            'allow_vote_change' => 0,
            'allow_duplicate_candidate_vote' => 0,
            'advance_rule' => json_encode(['advance_count' => 32], JSON_UNESCAPED_UNICODE),
            'visibility_rule' => $visibility,
            'config_json' => json_encode(['target_count' => 32], JSON_UNESCAPED_UNICODE),
        ],
        [
            'stage_type' => 'bracket',
            'title' => '32强正赛',
            'sort_order' => 3,
            'vote_mode' => 'match_single',
            'votes_per_user' => 1,
            'allow_vote_change' => 0,
            'allow_duplicate_candidate_vote' => 0,
            'advance_rule' => null,
            'visibility_rule' => $visibility,
            'config_json' => json_encode(['bracket_size' => 32], JSON_UNESCAPED_UNICODE),
        ],
        [
            'stage_type' => 'final',
            'title' => '决赛',
            'sort_order' => 4,
            'vote_mode' => 'match_single',
            'votes_per_user' => 1,
            'allow_vote_change' => 0,
            'allow_duplicate_candidate_vote' => 0,
            'advance_rule' => null,
            'visibility_rule' => $visibility,
            'config_json' => json_encode(['bracket_size' => 2], JSON_UNESCAPED_UNICODE),
        ],
    ];

    foreach ($stages as $stage) {
        $insert->execute([
            $contestId,
            $stage['stage_type'],
            $stage['title'],
            $stage['sort_order'],
            $stage['vote_mode'],
            $stage['votes_per_user'],
            $stage['allow_vote_change'],
            $stage['allow_duplicate_candidate_vote'],
            $stage['advance_rule'],
            $stage['visibility_rule'],
            $stage['config_json'],
        ]);
    }
}

function moeSettleQualifierStage(PDO $db, array $stage): int {
    if (!in_array(($stage['stage_type'] ?? ''), ['qualifier', 'group_vote'], true)) {
        return 0;
    }

    $nextStmt = $db->prepare(
        "SELECT * FROM moe_contest_stages
         WHERE contest_id = ? AND sort_order > ? AND stage_type IN ('bracket', 'final')
         ORDER BY sort_order ASC, id ASC LIMIT 1"
    );
    $nextStmt->execute([(int)$stage['contest_id'], (int)$stage['sort_order']]);
    $next = $nextStmt->fetch(PDO::FETCH_ASSOC);
    if (!$next) {
        return 0;
    }

    $advance = moeDecodeJsonObject($stage['advance_rule'] ?? null);
    $config = moeDecodeJsonObject($stage['config_json'] ?? null);
    $targetCount = max(1, (int)($advance['advance_count'] ?? $config['target_count'] ?? 32));

    $entryCountStmt = $db->prepare("SELECT COUNT(*) FROM moe_stage_entries WHERE stage_id = ? AND status = 'active'");
    $entryCountStmt->execute([(int)$stage['id']]);
    $hasEntries = (int)$entryCountStmt->fetchColumn() > 0;

    if ($hasEntries) {
        $rankStmt = $db->prepare(
            "SELECT e.candidate_id, MIN(e.seed_no) AS source_seed, MIN(e.id) AS entry_id, COUNT(v.id) AS votes
             FROM moe_stage_entries e
             JOIN moe_candidates c ON c.id = e.candidate_id
             LEFT JOIN moe_votes v ON v.candidate_id = e.candidate_id AND v.stage_id = e.stage_id
             WHERE e.stage_id = ? AND e.status = 'active' AND c.status = 'approved'
             GROUP BY e.candidate_id
             ORDER BY votes DESC, COALESCE(source_seed, 999999), entry_id ASC"
        );
        $rankStmt->execute([(int)$stage['id']]);
    } else {
        $rankStmt = $db->prepare(
            "SELECT c.id AS candidate_id, NULL AS source_seed, c.id AS entry_id, COUNT(v.id) AS votes
             FROM moe_candidates c
             LEFT JOIN moe_votes v ON v.candidate_id = c.id AND v.stage_id = ?
             WHERE c.contest_id = ? AND c.status = 'approved'
             GROUP BY c.id
             ORDER BY votes DESC, c.id ASC"
        );
        $rankStmt->execute([(int)$stage['id'], (int)$stage['contest_id']]);
    }

    $db->prepare("DELETE FROM moe_stage_entries WHERE stage_id = ? AND source_stage_id = ?")
        ->execute([(int)$next['id'], (int)$stage['id']]);
    $insert = $db->prepare(
        "INSERT INTO moe_stage_entries (stage_id, candidate_id, seed_no, source_stage_id, source_rank, status)
         VALUES (?, ?, ?, ?, ?, 'active')"
    );

    $count = 0;
    foreach ($rankStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        if ($count >= $targetCount) break;
        $rank = $count + 1;
        $insert->execute([(int)$next['id'], (int)$row['candidate_id'], $rank, (int)$stage['id'], $rank]);
        $count++;
    }

    return $count;
}

function moeBracketSeedOrder(int $size): array {
    $size = max(2, $size);
    $power = 1;
    while ($power < $size) {
        $power *= 2;
    }
    $order = [1, 2];
    while (count($order) < $power) {
        $max = count($order) * 2 + 1;
        $next = [];
        foreach ($order as $seed) {
            $next[] = $seed;
            $next[] = $max - $seed;
        }
        $order = $next;
    }
    return array_values(array_filter($order, function ($seed) use ($size) {
        return $seed <= $size;
    }));
}

function moeHashClientValue(string $value): string {
    if ($value === '') return '';
    return hash('sha256', $value);
}

function moeClientIpHash(): string {
    return moeHashClientValue($_SERVER['REMOTE_ADDR'] ?? '');
}

function moeUserAgentHash(): string {
    return moeHashClientValue($_SERVER['HTTP_USER_AGENT'] ?? '');
}

function moeRequireContestManager(int $contestId): array {
    $user = requireLogin();
    $contest = moeGetContest($contestId);
    if (!$contest) {
        moeRespond(['success' => false, 'message' => '萌战活动不存在'], 404);
    }
    if (!moeCanManageContest($user, $contest)) {
        moeRespond(['success' => false, 'message' => '无权管理该萌战活动'], 403);
    }
    return [$user, $contest];
}

function moeStageWithContest(int $stageId): ?array {
    if ($stageId <= 0) return null;
    $db = getDB();
    $stmt = $db->prepare(
        "SELECT s.*, c.club_id, c.country, c.status AS contest_status, c.eligibility_mode, c.result_visibility
         FROM moe_contest_stages s
         JOIN moe_contests c ON c.id = s.contest_id
         WHERE s.id = ?"
    );
    $stmt->execute([$stageId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}
