<?php
// api/bot.php - Bot 数据查询 API（供 QQ/Discord 等机器人调用）
//
// 使用方式:
//   GET api/bot.php?token=YOUR_TOKEN&action=clubs
//   GET api/bot.php?token=YOUR_TOKEN&action=club&id=123
//   GET api/bot.php?token=YOUR_TOKEN&action=events
//   GET api/bot.php?token=YOUR_TOKEN&action=search&q=关键词
//   GET api/bot.php?token=YOUR_TOKEN&action=stats
//
// 也可通过请求头传递 token: Authorization: Bearer YOUR_TOKEN

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config.php';

// ——— 鉴权 ———
function authBot(): void {
    $token = $_GET['token'] ?? '';
    if (empty($token)) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
            $token = $m[1];
        }
    }
    if ($token !== BOT_API_KEY) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => '无效的 API 密钥'], JSON_UNESCAPED_UNICODE);
        exit();
    }
}
authBot();

$action = $_GET['action'] ?? '';

// ——— 工具函数 ———

function loadJson(string $path): array {
    if (!file_exists($path)) return [];
    $data = json_decode(file_get_contents($path), true);
    return is_array($data) ? $data : [];
}

function loadClubData(): array {
    $china = loadJson(__DIR__ . '/../data/clubs.json');
    $japan = loadJson(__DIR__ . '/../data/clubs_japan.json');
    $clubs = array_merge($china['data'] ?? [], $japan['data'] ?? []);
    // 按 id 排序
    usort($clubs, fn($a, $b) => ($a['id'] ?? 0) - ($b['id'] ?? 0));
    return $clubs;
}

function getMemberCounts(): array {
    try {
        require_once __DIR__ . '/../includes/db.php';
        $db = getDB();
        $stmt = $db->query(
            "SELECT club_id, COUNT(*) as cnt FROM club_memberships WHERE status = 'active' GROUP BY club_id"
        );
        $result = [];
        foreach ($stmt->fetchAll() as $row) {
            $result[(int)$row['club_id']] = (int)$row['cnt'];
        }
        return $result;
    } catch (Exception $e) {
        return [];
    }
}

function scrubClub(array $club): array {
    // Bot API 返回公开信息，隐藏联系方式除非 marked visible
    $visible = !empty($club['visible_by_default']);
    $infoVisible = $visible || !empty($club['info_hidden']) === false;
    return [
        'id'             => $club['id'] ?? 0,
        'name'           => $club['name'] ?? $club['display_name'] ?? '',
        'school'         => $club['school'] ?? '',
        'province'       => $club['province'] ?? $club['prefecture'] ?? '',
        'type'           => $club['type'] ?? 'school',
        'country'        => $club['country'] ?? 'china',
        'info'           => $infoVisible ? ($club['info'] ?? '') : '联系方式仅成员可见',
        'logo_url'       => $club['logo_url'] ?? '',
        'visible'        => $visible,
        'member_count'   => 0,
    ];
}

// 获取数据库连接（供特定 action 按需使用）
$db = null;
function getDbOnce(): ?PDO {
    global $db;
    if ($db === null) {
        try {
            require_once __DIR__ . '/../includes/db.php';
            $db = getDB();
        } catch (Exception $e) {
            return null;
        }
    }
    return $db;
}

// ——— 路由 ———

switch ($action) {

    // ——— 同好会列表 ———
    case 'clubs':
        $clubs = loadClubData();
        $memberCounts = getMemberCounts();
        $country = $_GET['country'] ?? ''; // china / japan / 空=全部
        $type = $_GET['type'] ?? '';        // school / region / vnfest / 空=全部

        $result = [];
        foreach ($clubs as $club) {
            $cid = $club['id'] ?? 0;
            $clubCountry = $club['country'] ?? 'china';
            if ($country && $clubCountry !== $country) continue;
            if ($type && ($club['type'] ?? 'school') !== $type) continue;
            $item = scrubClub($club);
            $item['member_count'] = $memberCounts[$cid] ?? 0;
            $result[] = $item;
        }

        echo json_encode([
            'success' => true,
            'total' => count($result),
            'data' => $result,
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ——— 同好会详情 ———
    case 'club':
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) {
            echo json_encode(['success' => false, 'error' => '缺少 id 参数'], JSON_UNESCAPED_UNICODE);
            exit();
        }

        // 从两个数据文件查找
        $club = null;
        foreach (['clubs.json', 'clubs_japan.json'] as $f) {
            $data = loadJson(__DIR__ . '/../data/' . $f);
            foreach ($data['data'] ?? [] as $item) {
                if (($item['id'] ?? 0) === $id) {
                    $club = $item;
                    break 2;
                }
            }
        }

        if (!$club) {
            echo json_encode(['success' => false, 'error' => '未找到该同好会'], JSON_UNESCAPED_UNICODE);
            exit();
        }

        $result = scrubClub($club);
        $memberCounts = getMemberCounts();
        $result['member_count'] = $memberCounts[$id] ?? 0;

        // 附加成员列表（需数据库）
        $db = getDbOnce();
        $result['members'] = [];
        if ($db) {
            try {
                $stmt = $db->prepare(
                    "SELECT u.username, u.nickname, u.avatar_url, m.role, m.joined_at
                     FROM club_memberships m
                     JOIN users u ON u.id = m.user_id
                     WHERE m.club_id = ? AND m.status = 'active'
                     ORDER BY FIELD(m.role, 'representative', 'manager', 'member'), m.joined_at ASC"
                );
                $stmt->execute([$id]);
                $result['members'] = $stmt->fetchAll();
            } catch (Exception $e) {
                // 成员列表非必须，静默降级
            }
        }

        // 关联刊物
        $pubs = loadJson(__DIR__ . '/../data/publications.json');
        $clubName = $club['name'] ?? $club['display_name'] ?? '';
        $result['publications'] = [];
        foreach ($pubs['publications'] ?? [] as $pub) {
            if (($pub['clubName'] ?? '') === $clubName) {
                $result['publications'][] = [
                    'id' => $pub['id'] ?? 0,
                    'name' => $pub['publicationName'] ?? '',
                    'status' => $pub['status'] ?? '',
                ];
            }
        }

        echo json_encode(['success' => true, 'data' => $result], JSON_UNESCAPED_UNICODE);
        break;

    // ——— 活动列表 ———
    case 'events':
        $events = loadJson(__DIR__ . '/../data/events.json');
        $list = $events['events'] ?? [];
        // 倒序（最新的在前）
        $list = array_reverse($list);

        $result = [];
        foreach ($list as $ev) {
            $result[] = [
                'id'          => $ev['id'] ?? 0,
                'event'       => $ev['event'] ?? '',
                'date'        => $ev['date'] ?? '',
                'description' => $ev['description'] ?? '',
                'link'        => $ev['link'] ?? '',
                'image'       => $ev['image'] ?? '',
            ];
        }

        echo json_encode([
            'success' => true,
            'total' => count($result),
            'data' => $result,
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ——— 搜索同好会 ———
    case 'search':
        $q = trim($_GET['q'] ?? '');
        if (!$q) {
            echo json_encode(['success' => false, 'error' => '缺少 q 参数（搜索关键词）'], JSON_UNESCAPED_UNICODE);
            exit();
        }

        $clubs = loadClubData();
        $memberCounts = getMemberCounts();
        $keywords = preg_split('/\s+/', $q);
        $results = [];

        foreach ($clubs as $club) {
            $haystack = ($club['name'] ?? '') . ' ' . ($club['school'] ?? '') . ' ' . ($club['province'] ?? '') . ' ' . ($club['raw_text'] ?? '');
            $match = true;
            foreach ($keywords as $kw) {
                if (stripos($haystack, $kw) === false) {
                    $match = false;
                    break;
                }
            }
            if ($match) {
                $item = scrubClub($club);
                $item['member_count'] = $memberCounts[$club['id'] ?? 0] ?? 0;
                $results[] = $item;
            }
        }

        echo json_encode([
            'success' => true,
            'query' => $q,
            'total' => count($results),
            'data' => $results,
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ——— 数据统计 ———
    case 'stats':
        $clubs = loadClubData();
        $memberCounts = getMemberCounts();

        $totalMembers = array_sum($memberCounts);
        $countryStats = ['china' => 0, 'japan' => 0];
        $typeStats = [];
        foreach ($clubs as $c) {
            $cc = $c['country'] ?? 'china';
            $countryStats[$cc] = ($countryStats[$cc] ?? 0) + 1;
            $t = $c['type'] ?? 'school';
            $typeStats[$t] = ($typeStats[$t] ?? 0) + 1;
        }

        $events = loadJson(__DIR__ . '/../data/events.json');
        $pubs = loadJson(__DIR__ . '/../data/publications.json');

        // 活跃用户数
        $activeUsers = 0;
        $db = getDbOnce();
        if ($db) {
            try {
                $stmt = $db->query("SELECT COUNT(*) as cnt FROM users WHERE status = 'active'");
                $activeUsers = (int)$stmt->fetch()['cnt'];
            } catch (Exception $e) {}
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'total_clubs'     => count($clubs),
                'total_members'   => $totalMembers,
                'total_events'    => count($events['events'] ?? []),
                'total_publications' => count($pubs['publications'] ?? []),
                'active_users'    => $activeUsers,
                'by_country'      => $countryStats,
                'by_type'         => $typeStats,
            ],
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ——— 未知 action ———
    default:
        echo json_encode([
            'success' => false,
            'error' => '未知 action，可用值: clubs, club, events, search, stats',
        ], JSON_UNESCAPED_UNICODE);
        break;
}
