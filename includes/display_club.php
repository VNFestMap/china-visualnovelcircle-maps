<?php

const DISPLAY_CLUB_ROLES = ['member', 'manager', 'representative'];
const DISPLAY_CLUB_COUNTRIES = ['china', 'japan'];

/**
 * Load the public club directory once per request and keep China/Japan IDs isolated.
 * A missing or malformed source returns no public identity; it never clears a saved choice.
 *
 * @return array<string,array<int,array<string,mixed>>>
 */
function displayClubDirectory(): array
{
    static $directory = null;
    if (is_array($directory)) return $directory;

    $directory = ['china' => [], 'japan' => []];
    $sources = [
        'china' => __DIR__ . '/../data/clubs.json',
        'japan' => __DIR__ . '/../data/clubs_japan.json',
    ];
    foreach ($sources as $country => $file) {
        if (!is_file($file) || !is_readable($file)) {
            error_log('Display club directory is unavailable: ' . $file);
            continue;
        }
        $payload = json_decode((string)file_get_contents($file), true);
        if (!is_array($payload) || !is_array($payload['data'] ?? null)) {
            error_log('Display club directory is malformed: ' . $file);
            continue;
        }
        foreach ($payload['data'] as $club) {
            if (!is_array($club)) continue;
            $id = (int)($club['id'] ?? 0);
            if ($id <= 0) continue;
            $name = trim((string)($club['display_name'] ?? $club['name'] ?? $club['school'] ?? ''));
            if ($name === '') continue;
            $directory[$country][$id] = $club + ['name' => $name, 'country' => $country];
        }
    }
    return $directory;
}

function displayClubCountry(string $country): ?string
{
    $country = strtolower(trim($country));
    return in_array($country, DISPLAY_CLUB_COUNTRIES, true) ? $country : null;
}

function displayClubRoleLabel(string $role): string
{
    return [
        'member' => '成员',
        'manager' => '管理员',
        'representative' => '负责人',
    ][$role] ?? $role;
}

function displayClubCountryLabel(string $country): string
{
    return $country === 'japan' ? '日本' : '中国';
}

function displayClubRecord(int $clubId, string $country): ?array
{
    $country = displayClubCountry($country);
    if ($clubId <= 0 || $country === null) return null;
    $directory = displayClubDirectory();
    return $directory[$country][$clubId] ?? null;
}

/**
 * @return array{club_id:int,country:string,name:string,role:string}|null
 */
function displayClubPublicFromMembership(?array $membership): ?array
{
    if (!$membership) return null;
    $status = (string)($membership['status'] ?? '');
    $role = (string)($membership['role'] ?? '');
    $clubId = (int)($membership['club_id'] ?? 0);
    $country = displayClubCountry((string)($membership['country'] ?? 'china'));
    if ($status !== 'active' || !in_array($role, DISPLAY_CLUB_ROLES, true) || $country === null) return null;
    $club = displayClubRecord($clubId, $country);
    if (!$club) return null;
    return [
        'club_id' => $clubId,
        'country' => $country,
        'name' => trim((string)($club['display_name'] ?? $club['name'] ?? $club['school'] ?? '')),
        'role' => $role,
    ];
}

/**
 * Resolve the current valid display club for one user. Invalid/stale references are hidden.
 */
function displayClubForUser(PDO $db, int $userId): ?array
{
    if ($userId <= 0) return null;
    try {
        $stmt = $db->prepare(
            "SELECT cm.id, cm.user_id, cm.club_id, COALESCE(cm.country, 'china') AS country, cm.role, cm.status
             FROM users u
             JOIN club_memberships cm ON cm.id = u.display_membership_id AND cm.user_id = u.id
             WHERE u.id = ?
               AND cm.status = 'active'
               AND cm.role IN ('member','manager','representative')
             LIMIT 1"
        );
        $stmt->execute([$userId]);
        return displayClubPublicFromMembership($stmt->fetch(PDO::FETCH_ASSOC) ?: null);
    } catch (Throwable $e) {
        // Read compatibility for a deployment where code is present before the guarded migration.
        error_log('Unable to resolve display club: ' . $e->getMessage());
        return null;
    }
}

/**
 * Return a selectable membership only when it belongs to the user and is formally active.
 */
function displayClubSelectableMembership(PDO $db, int $userId, int $membershipId, bool $lock = false): ?array
{
    if ($userId <= 0 || $membershipId <= 0) return null;
    $forUpdate = $lock && $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
    $stmt = $db->prepare(
        "SELECT id, user_id, club_id, COALESCE(country, 'china') AS country, role, status
         FROM club_memberships WHERE id = ? AND user_id = ? LIMIT 1" . $forUpdate
    );
    $stmt->execute([$membershipId, $userId]);
    $membership = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    if (!$membership) return null;
    $country = displayClubCountry((string)($membership['country'] ?? 'china'));
    if ((string)$membership['status'] !== 'active'
        || !in_array((string)$membership['role'], DISPLAY_CLUB_ROLES, true)
        || $country === null) {
        return null;
    }
    $membership['country'] = $country;
    return $membership;
}

/** Return the non-personal composite identity used by audit records. */
function displayClubMembershipKey(?array $membership): ?array
{
    if (!$membership) return null;
    $clubId = (int)($membership['club_id'] ?? 0);
    $country = displayClubCountry((string)($membership['country'] ?? 'china'));
    if ($clubId <= 0 || $country === null) return null;
    return ['club_id' => $clubId, 'country' => $country];
}

/** Clear a user's saved choice when this membership ceases to be eligible. */
function displayClubClearSelection(PDO $db, int $membershipId): int
{
    if ($membershipId <= 0) return 0;
    $stmt = $db->prepare(
        'UPDATE users SET display_membership_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE display_membership_id = ?'
    );
    $stmt->execute([$membershipId]);
    return $stmt->rowCount();
}
