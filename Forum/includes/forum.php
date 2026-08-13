<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/display_club.php';

const FORUM_TITLE_MAX = 100;
const FORUM_BODY_MAX = 50000;
const FORUM_IMAGE_MAX_BYTES = 10485760;
const FORUM_IMAGE_MAX_COUNT = 20;
const FORUM_TAG_MAX_COUNT = 5;
const FORUM_TAG_MAX_LENGTH = 20;
const FORUM_DISPLAY_CLUB_SELECT = "dcm.club_id AS display_club_id, COALESCE(dcm.country, 'china') AS display_club_country, dcm.role AS display_club_role, dcm.status AS display_club_status";
const FORUM_DISPLAY_CLUB_JOIN = "LEFT JOIN club_memberships dcm ON dcm.id = u.display_membership_id AND dcm.user_id = u.id AND dcm.status = 'active' AND dcm.role IN ('member','manager','representative')";

function forumDisplayClubFromRow(array $row): ?array
{
    if (empty($row['display_club_id'])) return null;
    return displayClubPublicFromMembership([
        'club_id' => $row['display_club_id'],
        'country' => $row['display_club_country'] ?? 'china',
        'role' => $row['display_club_role'] ?? '',
        'status' => $row['display_club_status'] ?? '',
    ]);
}

function forumUserPublic(?array $user): ?array
{
    if (!$user) return null;
    return [
        'id' => (int)$user['id'],
        'username' => (string)$user['username'],
        'nickname' => (string)($user['nickname'] ?: $user['username']),
        'avatar_url' => (string)($user['avatar_url'] ?? ''),
        'role' => (string)$user['role'],
        'display_club' => displayClubForUser(getDB(), (int)$user['id']),
    ];
}

function forumInput(): array
{
    $type = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (str_contains($type, 'application/json')) {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw ?: '{}', true);
        return is_array($data) ? $data : [];
    }
    return $_POST;
}

function forumRespond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function forumFail(string $message, int $status = 400, array $extra = []): never
{
    forumRespond(array_merge(['success' => false, 'message' => $message], $extra), $status);
}

function forumRequireMethod(string $method): void
{
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== strtoupper($method)) {
        header('Allow: ' . strtoupper($method));
        forumFail('请求方法不允许', 405);
    }
}

function forumRequireSameOrigin(): void
{
    $fetchSite = strtolower(trim((string)($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')));
    if ($fetchSite === 'cross-site') forumFail('拒绝跨站写入请求', 403);

    $forwardedScheme = strtolower(trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0]));
    $requestScheme = in_array($forwardedScheme, ['http', 'https'], true)
        ? $forwardedScheme
        : strtolower((string)($_SERVER['REQUEST_SCHEME'] ?? ''));
    if (!in_array($requestScheme, ['http', 'https'], true)) {
        $requestScheme = !empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off' ? 'https' : 'http';
    }
    $requestAuthority = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
    $requestUrl = parse_url($requestScheme . '://' . $requestAuthority);
    if (!is_array($requestUrl)) forumFail('无法校验请求来源', 403);
    $requestHost = strtolower((string)($requestUrl['host'] ?? ''));
    $requestPort = (int)($requestUrl['port'] ?? ($requestScheme === 'https' ? 443 : 80));
    if ($requestHost === '') forumFail('无法校验请求来源', 403);

    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $key) {
        if (empty($_SERVER[$key])) continue;
        $source = trim((string)$_SERVER[$key]);
        $sourceUrl = parse_url($source);
        if (!is_array($sourceUrl)) forumFail('无效的请求来源', 403);
        $sourceHost = strtolower((string)($sourceUrl['host'] ?? ''));
        $sourceScheme = strtolower((string)($sourceUrl['scheme'] ?? ''));
        if ($source === '' || strtolower($source) === 'null' || $sourceHost === '' || !in_array($sourceScheme, ['http', 'https'], true)) {
            forumFail('无效的请求来源', 403);
        }
        $sourcePort = (int)($sourceUrl['port'] ?? ($sourceScheme === 'https' ? 443 : 80));
        if (!hash_equals($requestScheme, $sourceScheme)
            || !hash_equals($requestHost, $sourceHost)
            || $requestPort !== $sourcePort) {
            forumFail('拒绝跨站写入请求', 403);
        }
        return;
    }
    forumFail('缺少同源请求信息', 403);
}

function forumLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function forumString(mixed $value, int $max, bool $required = true): string
{
    $value = trim((string)$value);
    if ($required && $value === '') forumFail('必填内容不能为空', 422);
    if (forumLength($value) > $max) forumFail('内容超过允许长度', 422, ['max_length' => $max]);
    return $value;
}

function forumCountry(mixed $value): string
{
    $country = strtolower(trim((string)$value));
    if (!in_array($country, ['china', 'japan'], true)) forumFail('无效的国家范围', 422);
    return $country;
}

function forumPagination(): array
{
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(50, max(1, (int)($_GET['limit'] ?? 20)));
    return [$page, $limit, ($page - 1) * $limit];
}

function forumReplyPageForAnchor(int $postId, int $replyId, int $limit): ?int
{
    if ($postId <= 0 || $replyId <= 0) return null;
    $limit = min(50, max(1, $limit));
    $db = getDB();
    $stmt = $db->prepare(
        "SELECT id,created_at FROM forum_replies
         WHERE id=? AND post_id=? AND status='published' AND deleted_at IS NULL"
    );
    $stmt->execute([$replyId, $postId]);
    $anchor = $stmt->fetch();
    if (!$anchor) return null;
    $beforeStmt = $db->prepare(
        "SELECT COUNT(*) FROM forum_replies
         WHERE post_id=? AND status='published' AND deleted_at IS NULL
           AND (created_at < ? OR (created_at = ? AND id < ?))"
    );
    $beforeStmt->execute([$postId, $anchor['created_at'], $anchor['created_at'], $replyId]);
    return (int)floor((int)$beforeStmt->fetchColumn() / $limit) + 1;
}

function forumPostAccess(array $post, ?array $user): bool
{
    return ($post['scope'] ?? 'plaza') === 'plaza';
}

function forumValidateCategory(?int $categoryId): ?int
{
    if (!$categoryId) return null;
    $stmt = getDB()->prepare(
        "SELECT id FROM forum_categories
         WHERE id = ? AND is_active = 1
           AND scope = 'plaza' AND club_id IS NULL AND country IS NULL
         LIMIT 1"
    );
    $stmt->execute([$categoryId]);
    if (!$stmt->fetchColumn()) forumFail('分类不属于论坛广场', 422);
    return $categoryId;
}

function forumGetPost(int $id, bool $includeHidden = false): ?array
{
    $where = $includeHidden ? '' : " AND p.status = 'published' AND p.deleted_at IS NULL";
    $stmt = getDB()->prepare(
        "SELECT p.*, c.name AS category_name, c.slug AS category_slug,
                u.username, u.nickname, u.avatar_url, u.role AS author_role, " . FORUM_DISPLAY_CLUB_SELECT . "
         FROM forum_posts p
         JOIN users u ON u.id = p.author_id
         " . FORUM_DISPLAY_CLUB_JOIN . "
         LEFT JOIN forum_categories c ON c.id = p.category_id
         WHERE p.id = ?{$where} LIMIT 1"
    );
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function forumGetReply(int $id, bool $includeHidden = false): ?array
{
    $where = $includeHidden ? '' : " AND r.status = 'published' AND r.deleted_at IS NULL";
    $stmt = getDB()->prepare(
        "SELECT r.*, p.scope, p.club_id, p.country, p.author_id AS post_author_id
         FROM forum_replies r JOIN forum_posts p ON p.id = r.post_id
         WHERE r.id = ?{$where} LIMIT 1"
    );
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function forumCapabilities(array $post, ?array $user): array
{
    $accessible = forumPostAccess($post, $user);
    $own = $user && $accessible && (int)$post['author_id'] === (int)$user['id'];
    $manage = $user && $accessible && ($user['role'] ?? '') === 'super_admin';
    return [
        'reply' => (bool)$user && $accessible,
        'edit' => (bool)$own,
        'delete' => (bool)($own || $manage),
        'moderate' => (bool)$manage,
        'like' => (bool)$user && $accessible,
        'favorite' => (bool)$user && $accessible,
        'report' => (bool)$user && $accessible && !$own,
    ];
}

function forumNormalizeTags(mixed $value): array
{
    if ($value === null || $value === '') return [];
    if (!is_array($value)) forumFail('标签格式无效', 422);
    if (count($value) > FORUM_TAG_MAX_COUNT) forumFail('每篇帖子最多添加 5 个标签', 422);

    $result = [];
    $seen = [];
    foreach ($value as $raw) {
        if (!is_scalar($raw)) forumFail('标签格式无效', 422);
        $name = trim((string)preg_replace('/\s+/u', ' ', (string)$raw));
        if ($name === '') continue;
        if (forumLength($name) > FORUM_TAG_MAX_LENGTH) forumFail('单个标签不能超过 20 字', 422);
        $normalized = function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
        if (isset($seen[$normalized])) continue;
        $seen[$normalized] = true;
        $result[] = ['name' => $name, 'normalized' => $normalized];
    }
    if (count($result) > FORUM_TAG_MAX_COUNT) forumFail('每篇帖子最多添加 5 个标签', 422);
    return $result;
}

function forumSyncPostTags(int $postId, array $tags): void
{
    $db = getDB();
    $db->prepare('DELETE FROM forum_post_tags WHERE post_id = ?')->execute([$postId]);
    if (!$tags) return;

    $find = $db->prepare('SELECT id FROM forum_tags WHERE normalized_name = ? LIMIT 1');
    $insertTag = $db->prepare('INSERT INTO forum_tags(name, normalized_name) VALUES(?, ?)');
    $link = $db->prepare('INSERT INTO forum_post_tags(post_id, tag_id, sort_order) VALUES(?, ?, ?)');
    foreach ($tags as $index => $tag) {
        $find->execute([$tag['normalized']]);
        $tagId = (int)($find->fetchColumn() ?: 0);
        if (!$tagId) {
            try {
                $insertTag->execute([$tag['name'], $tag['normalized']]);
                $tagId = (int)$db->lastInsertId();
            } catch (PDOException $error) {
                $find->execute([$tag['normalized']]);
                $tagId = (int)($find->fetchColumn() ?: 0);
                if (!$tagId) throw $error;
            }
        }
        $link->execute([$postId, $tagId, $index]);
    }
}

function forumTagsForPosts(array $postIds): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $postIds), static fn(int $id): bool => $id > 0)));
    if (!$ids) return [];
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = getDB()->prepare(
        "SELECT pt.post_id, t.name FROM forum_post_tags pt
         JOIN forum_tags t ON t.id = pt.tag_id
         WHERE pt.post_id IN ({$placeholders}) ORDER BY pt.post_id, pt.sort_order, t.id"
    );
    $stmt->execute($ids);
    $result = [];
    foreach ($stmt->fetchAll() as $row) {
        $result[(int)$row['post_id']][] = (string)$row['name'];
    }
    return $result;
}

function forumMarkdownExcerpt(string $markdown, int $maxLength = 180): string
{
    $maxLength = max(1, $maxLength);
    $hasImage = preg_match('/!\[[^\]\r\n]*\]\(\s*<?[^)\s>]+>?(?:\s+["\'][^"\']*["\'])?\s*\)/u', $markdown) === 1;

    $text = str_replace(["\r\n", "\r"], "\n", $markdown);
    $text = preg_replace('/<!--[\s\S]*?-->/u', ' ', $text) ?? $text;
    $text = preg_replace('#<(script|style)\b[^>]*>[\s\S]*?</\1>#iu', ' ', $text) ?? $text;
    $text = preg_replace('/!\[[^\]\r\n]*\]\(\s*<?[^)\s>]+>?(?:\s+["\'][^"\']*["\'])?\s*\)/u', ' ', $text) ?? $text;
    $text = preg_replace('/\[([^\]\r\n]+)\]\(\s*<?[^)\s>]+>?(?:\s+["\'][^"\']*["\'])?\s*\)/u', '$1', $text) ?? $text;
    $text = preg_replace('/<\/?[A-Za-z][^>]*>/u', ' ', $text) ?? $text;
    $text = preg_replace('/<(?:https?:\/\/|www\.)[^>]+>/iu', ' ', $text) ?? $text;
    $text = preg_replace('/\b(?:https?:\/\/|www\.)[^\s<>()]+/iu', ' ', $text) ?? $text;
    $text = preg_replace('#(?<![\p{L}\p{N}_])(?:\./)?uploads/[a-zA-Z0-9/_\-.]+#u', ' ', $text) ?? $text;
    $text = preg_replace('/^[ \t]*```[^\r\n]*$/mu', ' ', $text) ?? $text;
    $text = preg_replace('/^[ \t]{0,3}(?:#{1,6}[ \t]+|>[ \t]?|[-+*][ \t]+|\d+[.)][ \t]+)/mu', '', $text) ?? $text;
    $text = preg_replace('/^[ \t]*(?:[-*_][ \t]*){3,}$/mu', ' ', $text) ?? $text;
    $text = str_replace(
        ['\\`', '\\*', '\\_', '\\{', '\\}', '\\[', '\\]', '\\(', '\\)', '\\#', '\\+', '\\-', '\\.', '\\!', '\\>'],
        ['`', '*', '_', '{', '}', '[', ']', '(', ')', '#', '+', '-', '.', '!', '>'],
        $text
    );
    $text = str_replace(['```', '`', '**', '__', '~~', '*', '_'], '', $text);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', ' ', $text) ?? $text;
    $text = preg_replace('/[\x{00AD}\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{206F}\x{FEFF}]/u', '', $text) ?? $text;
    $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);

    if ($text === '') return $hasImage ? '图片帖' : '';

    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($text, 'UTF-8') <= $maxLength) return $text;
        if ($maxLength === 1) return '…';
        return rtrim(mb_substr($text, 0, $maxLength - 1, 'UTF-8')) . '…';
    }

    $characters = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
    if (!is_array($characters) || count($characters) <= $maxLength) return $text;
    if ($maxLength === 1) return '…';
    return rtrim(implode('', array_slice($characters, 0, $maxLength - 1))) . '…';
}

function forumPreviewImagesForPosts(array $postIds): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $postIds), static fn(int $id): bool => $id > 0)));
    if (!$ids) return [];

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = getDB()->prepare(
        "SELECT a.target_id AS post_id, a.relative_path, a.width, a.height, a.original_name
         FROM forum_attachments a
         JOIN (
             SELECT target_id, MIN(id) AS attachment_id
             FROM forum_attachments
             WHERE target_type = 'post' AND target_id IN ({$placeholders})
             GROUP BY target_id
         ) first_attachment ON first_attachment.attachment_id = a.id
         WHERE a.target_type = 'post'
         ORDER BY a.target_id"
    );
    $stmt->execute($ids);

    $result = [];
    foreach ($stmt->fetchAll() as $row) {
        $path = ltrim((string)$row['relative_path'], '/');
        if (!preg_match('#^uploads/[a-zA-Z0-9/_\-.]+$#', $path) || str_contains($path, '..')) continue;
        $postId = (int)$row['post_id'];
        $alt = trim((string)($row['original_name'] ?? ''));
        $result[$postId] = [
            'url' => './' . $path,
            'width' => max(0, (int)$row['width']),
            'height' => max(0, (int)$row['height']),
            'alt' => $alt !== '' ? $alt : '帖子图片',
        ];
    }
    return $result;
}

function forumMarkdownImagePaths(string $markdown): array
{
    preg_match_all('/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/u', $markdown, $matches);
    $paths = [];
    foreach ($matches[1] ?? [] as $url) {
        $path = rawurldecode((string)$url);
        if (!preg_match('#^(?:\./)?uploads/[a-zA-Z0-9/_\-.]+$#', $path) || str_contains($path, '..')) continue;
        $paths[] = preg_replace('#^\./#', '', $path);
    }
    return array_values(array_unique($paths));
}

function forumBindAttachments(int $userId, string $uploadToken, string $targetType, int $targetId, string $markdown): void
{
    $db = getDB();
    $referencedPaths = forumMarkdownImagePaths($markdown);
    if (count($referencedPaths) > FORUM_IMAGE_MAX_COUNT) forumFail('图片数量超过 20 张', 422);
    $referenced = array_fill_keys($referencedPaths, true);

    $currentStmt = $db->prepare(
        'SELECT id,relative_path FROM forum_attachments WHERE target_type=? AND target_id=?'
    );
    $currentStmt->execute([$targetType, $targetId]);
    $current = $currentStmt->fetchAll();

    $temporary = [];
    if ($uploadToken !== '') {
        $tempStmt = $db->prepare(
            'SELECT id,relative_path FROM forum_attachments WHERE uploader_id=? AND upload_token=? AND target_id IS NULL'
        );
        $tempStmt->execute([$userId, $uploadToken]);
        $temporary = $tempStmt->fetchAll();
        if (count($temporary) > FORUM_IMAGE_MAX_COUNT) forumFail('图片数量超过 20 张', 422);
    }

    $archiveType = $targetType === 'reply' ? 'reply_archive' : 'post_archive';
    $detach = $db->prepare('UPDATE forum_attachments SET target_type=? WHERE id=?');
    foreach ($current as $attachment) {
        if (isset($referenced[(string)$attachment['relative_path']])) continue;
        $detach->execute([$archiveType, (int)$attachment['id']]);
    }

    $bind = $db->prepare('UPDATE forum_attachments SET target_type=?,target_id=? WHERE id=?');
    foreach ($temporary as $attachment) {
        if (!isset($referenced[(string)$attachment['relative_path']])) continue;
        $bind->execute([$targetType, $targetId, (int)$attachment['id']]);
    }
}

function forumValidateMarkdownImages(string $markdown, int $userId, string $uploadToken = '', ?string $targetType = null, ?int $targetId = null): void
{
    preg_match_all('/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/u', $markdown, $matches);
    if (count($matches[1] ?? []) > FORUM_IMAGE_MAX_COUNT) forumFail('图片数量超过 20 张', 422);
    $paths = [];
    foreach ($matches[1] ?? [] as $url) {
        $path = rawurldecode((string)$url);
        if (!preg_match('#^(?:\./)?uploads/[a-zA-Z0-9/_\-.]+$#', $path) || str_contains($path, '..')) {
            forumFail('Markdown 图片只能引用本次上传的论坛附件', 422);
        }
        $normalized = preg_replace('#^\./#', '', $path);
        $paths[$normalized] = true;
    }
    if (!$paths) return;

    $uniquePaths = array_keys($paths);
    $placeholders = implode(',', array_fill(0, count($uniquePaths), '?'));
    $sql = "SELECT DISTINCT relative_path FROM forum_attachments
            WHERE uploader_id=? AND relative_path IN ({$placeholders})
              AND ((upload_token=? AND target_id IS NULL)";
    $params = array_merge([$userId], $uniquePaths, [$uploadToken]);
    if ($targetType && $targetId) {
        $sql .= ' OR (target_type=? AND target_id=?)';
        $params[] = $targetType;
        $params[] = $targetId;
    }
    $sql .= ')';
    $stmt = getDB()->prepare($sql);
    $stmt->execute($params);
    $allowed = array_fill_keys(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN)), true);
    foreach ($uniquePaths as $path) {
        if (!isset($allowed[$path])) forumFail('Markdown 引用了未绑定的论坛附件', 422);
    }
}

function forumCreateRevision(string $type, array $target, int $editorId): void
{
    $stmt = getDB()->prepare(
        'INSERT INTO forum_revisions(target_type, target_id, editor_id, title_snapshot, body_snapshot) VALUES(?, ?, ?, ?, ?)'
    );
    $stmt->execute([$type, (int)$target['id'], $editorId, $target['title'] ?? null, (string)$target['body_md']]);
}

function forumPostLink(int $postId, string $fragment = ''): string
{
    return './Forum/forum-post.html?id=' . $postId . $fragment;
}

function forumReplyLink(int $postId, int $replyId): string
{
    return forumPostLink($postId, '&reply_anchor=' . $replyId . '#reply-' . $replyId);
}

function forumNotifyMentions(string $markdown, int $actorId, string $link, string $relatedType, int $relatedId): void
{
    preg_match_all('/(^|\s)@([\p{L}\p{N}_\-]{2,32})/u', $markdown, $matches);
    $names = array_values(array_unique($matches[2] ?? []));
    if (!$names) return;
    require_once __DIR__ . '/../../includes/notifications.php';
    $stmt = getDB()->prepare("SELECT id FROM users WHERE username = ? AND status = 'active' LIMIT 1");
    foreach (array_slice($names, 0, 20) as $name) {
        $stmt->execute([$name]);
        $uid = (int)($stmt->fetchColumn() ?: 0);
        if ($uid > 0 && $uid !== $actorId) {
            createNotification($uid, 'forum_mention', '你在论坛中被提及', '点击查看相关内容', $link, $relatedType, $relatedId);
        }
    }
}

function forumSerializePost(array $row, ?array $user = null, array $tags = []): array
{
    $lastReplyAuthor = null;
    if (!empty($row['last_reply_author_id'])) {
        $lastReplyAuthor = [
            'id' => (int)$row['last_reply_author_id'],
            'username' => (string)($row['last_reply_username'] ?? ''),
            'nickname' => (string)(($row['last_reply_nickname'] ?? '') ?: ($row['last_reply_username'] ?? '')),
        ];
    }
    return [
        'id' => (int)$row['id'],
        'title' => (string)$row['title'],
        'body_md' => (string)$row['body_md'],
        'scope' => (string)$row['scope'],
        'club_id' => $row['club_id'] === null ? null : (int)$row['club_id'],
        'country' => $row['country'] ?: null,
        'category' => $row['category_id'] ? [
            'id' => (int)$row['category_id'],
            'name' => (string)($row['category_name'] ?? ''),
            'slug' => (string)($row['category_slug'] ?? ''),
        ] : null,
        'tags' => array_values($tags),
        'author' => [
            'id' => (int)$row['author_id'],
            'username' => (string)$row['username'],
            'nickname' => (string)($row['nickname'] ?: $row['username']),
            'avatar_url' => (string)($row['avatar_url'] ?? ''),
            'role' => (string)($row['author_role'] ?? ''),
            'display_club' => forumDisplayClubFromRow($row),
        ],
        'last_reply_author' => $lastReplyAuthor,
        'status' => (string)$row['status'],
        'is_pinned' => (bool)$row['is_pinned'],
        'is_essence' => (bool)$row['is_essence'],
        'view_count' => (int)$row['view_count'],
        'reply_count' => (int)$row['reply_count'],
        'like_count' => (int)$row['like_count'],
        'favorite_count' => (int)$row['favorite_count'],
        'edited_at' => $row['edited_at'] ?: null,
        'created_at' => (string)$row['created_at'],
        'last_activity_at' => (string)$row['last_activity_at'],
        'capabilities' => forumCapabilities($row, $user),
    ];
}

function forumSerializePostListItem(
    array $row,
    ?array $user = null,
    array $tags = [],
    ?array $previewImage = null,
    bool $includeMatchExcerpt = false
): array {
    $item = forumSerializePost($row, $user, $tags);
    $item['excerpt'] = forumMarkdownExcerpt((string)$row['body_md']);
    $item['preview_image'] = $previewImage;
    if ($includeMatchExcerpt) {
        $item['match_excerpt'] = $item['excerpt'];
    }
    unset($item['body_md']);
    return $item;
}

function forumRecount(string $targetType, int $targetId): void
{
    $db = getDB();
    $stmt = $db->prepare("SELECT COUNT(*) FROM forum_reactions WHERE target_type = ? AND target_id = ? AND reaction_type = 'like'");
    $stmt->execute([$targetType, $targetId]);
    $count = (int)$stmt->fetchColumn();
    $table = $targetType === 'post' ? 'forum_posts' : 'forum_replies';
    $db->prepare("UPDATE {$table} SET like_count = ? WHERE id = ?")->execute([$count, $targetId]);
}

function forumRollback(PDO $db): void
{
    if ($db->inTransaction()) $db->rollBack();
}
