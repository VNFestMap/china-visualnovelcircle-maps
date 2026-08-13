<?php
declare(strict_types=1);

$dbFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'vnfest-forum-' . bin2hex(random_bytes(6)) . '.sqlite';
define('DB_DRIVER', 'sqlite');
define('DB_PATH', $dbFile);

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../includes/forum_schema.php';

function assertForum(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

try {
    $db = getDB();
    $db->exec("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, nickname TEXT, avatar_url TEXT, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', display_membership_id INTEGER, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)");
    $db->exec("CREATE TABLE club_memberships (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, club_id INTEGER NOT NULL,
        country TEXT NOT NULL DEFAULT 'china', role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active'
    )");
    $db->exec("CREATE TABLE notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT, title TEXT, message TEXT, link TEXT, related_type TEXT, related_id INTEGER, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
    $db->exec("CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT, target_type TEXT, target_id INTEGER, details TEXT, ip_address TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
    $db->exec("CREATE TABLE rate_limits (ip_address TEXT, endpoint TEXT, hit_count INTEGER DEFAULT 1, window_start TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(ip_address, endpoint))");

    forumEnsureSchema($db);
    forumEnsureSchema($db);

    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'forum_%'")->fetchAll(PDO::FETCH_COLUMN);
    foreach (['forum_categories', 'forum_posts', 'forum_replies', 'forum_attachments', 'forum_reactions', 'forum_favorites', 'forum_reports', 'forum_revisions', 'forum_tags', 'forum_post_tags'] as $table) {
        assertForum(in_array($table, $tables, true), "missing table {$table}");
    }
    $categoryRows = $db->query("SELECT name,slug FROM forum_categories WHERE scope='plaza' AND is_active=1 ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
    assertForum(array_column($categoryRows, 'name') === ['综合讨论', '资源分享', '活动发布', '作品交流', '求助答疑'], 'category names do not match imported HTML');
    assertForum(array_column($categoryRows, 'slug') === ['general', 'resources', 'events', 'works', 'help'], 'category reconciliation is not idempotent');

    $db->exec("INSERT INTO users(id,username,nickname,role) VALUES
        (1,'member','成员','visitor'),(2,'external','外部','visitor'),(3,'manager','管理','visitor'),
        (4,'pending','待审核','visitor'),(5,'rejected','已拒绝','visitor'),(6,'left_member','已退出','visitor'),
        (7,'representative','代表','visitor'),(8,'superadmin','超管','super_admin')");
    $db->exec("INSERT INTO club_memberships(id,user_id,club_id,country,role,status) VALUES
        (101,1,2,'china','member','active'),
        (102,3,2,'japan','manager','active'),
        (103,2,2,'china','external','active'),
        (104,1,2,'china','manager','active'),
        (105,1,2,'china','representative','active'),
        (106,1,2,'china','member','pending'),
        (107,1,2,'china','member','rejected'),
        (108,1,2,'china','member','left'),
        (109,1,2,'china','member','kicked'),
        (110,1,2,'china','external','active')");
    $db->exec("UPDATE users SET display_membership_id=101 WHERE id=1");
    $db->exec("UPDATE users SET display_membership_id=102 WHERE id=3");
    $db->exec("UPDATE users SET display_membership_id=103 WHERE id=2");
    require_once __DIR__ . '/../includes/forum.php';

    $chinaDisplay = displayClubForUser($db, 1);
    $japanDisplay = displayClubForUser($db, 3);
    assertForum(($chinaDisplay['country'] ?? '') === 'china' && ($chinaDisplay['role'] ?? '') === 'member', 'China display club did not resolve from the selected membership');
    assertForum(($japanDisplay['country'] ?? '') === 'japan' && ($japanDisplay['role'] ?? '') === 'manager', 'Japan display club did not resolve from the selected membership');
    assertForum(($chinaDisplay['name'] ?? '') !== '' && ($japanDisplay['name'] ?? '') !== '' && $chinaDisplay['name'] !== $japanDisplay['name'], 'same-number China/Japan clubs were not isolated');
    assertForum(displayClubForUser($db, 2) === null, 'external membership was exposed as a display club');
    foreach ([101, 104, 105] as $selectableMembershipId) {
        assertForum(displayClubSelectableMembership($db, 1, $selectableMembershipId) !== null, 'formal active membership was not selectable');
    }
    foreach ([103, 106, 107, 108, 109, 110] as $invalidMembershipId) {
        assertForum(displayClubSelectableMembership($db, 1, $invalidMembershipId) === null, 'ineligible or foreign membership was selectable');
    }
    assertForum(displayClubSelectableMembership($db, 1, 102) === null, 'another user membership was selectable');

    $db->exec("INSERT INTO forum_categories(scope,club_id,country,name,slug,sort_order,is_active)
        VALUES('club',7,'china','休眠分类','dormant',1,1)");
    $dormantCategoryId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO forum_posts(author_id,scope,club_id,country,category_id,title,body_md)
        VALUES(1,'club',7,'china',?,'休眠帖子','不可公开的历史正文')")->execute([$dormantCategoryId]);
    $dormantPostId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO forum_replies(post_id,author_id,body_md) VALUES(?,?,?)")
        ->execute([$dormantPostId, 3, '不可公开的历史回复']);
    $dormantReplyId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO forum_attachments(uploader_id,target_type,target_id,upload_token,relative_path,mime_type,width,height,file_size,original_name)
        VALUES(1,'post',?,'dormant-token','uploads/2026/08/dormant.webp','image/webp',800,450,2048,'dormant.webp')")
        ->execute([$dormantPostId]);
    $db->prepare('INSERT INTO forum_favorites(user_id,post_id) VALUES(?,?)')->execute([1, $dormantPostId]);

    forumEnsureSchema($db);
    forumEnsureSchema($db);
    assertForum((int)$db->query("SELECT COUNT(*) FROM forum_categories WHERE id={$dormantCategoryId}")->fetchColumn() === 1, 'repeat migration removed dormant category');
    assertForum((int)$db->query("SELECT COUNT(*) FROM forum_posts WHERE id={$dormantPostId}")->fetchColumn() === 1, 'repeat migration removed dormant post');
    assertForum((int)$db->query("SELECT COUNT(*) FROM forum_replies WHERE id={$dormantReplyId}")->fetchColumn() === 1, 'repeat migration removed dormant reply');
    assertForum((int)$db->query("SELECT COUNT(*) FROM forum_attachments WHERE target_id={$dormantPostId} AND target_type='post'")->fetchColumn() === 1, 'repeat migration removed dormant attachment');
    assertForum((int)$db->query("SELECT COUNT(*) FROM forum_favorites WHERE post_id={$dormantPostId}")->fetchColumn() === 1, 'repeat migration removed dormant favorite');
    $dormantPost = forumGetPost($dormantPostId);
    assertForum(is_array($dormantPost), 'dormant post fixture was not preserved');
    foreach ([
        ['id' => 1, 'role' => 'visitor'],
        ['id' => 3, 'role' => 'manager'],
        ['id' => 7, 'role' => 'representative'],
        ['id' => 8, 'role' => 'super_admin'],
    ] as $actor) {
        assertForum(!forumPostAccess($dormantPost, $actor), 'dormant content remained accessible to a Forum actor');
        $capabilities = forumCapabilities($dormantPost, $actor);
        assertForum(!array_filter($capabilities), 'dormant content exposed Forum capabilities');
    }
    $validDormantCategory = $db->prepare(
        "SELECT id FROM forum_categories WHERE id=? AND is_active=1 AND scope='plaza' AND club_id IS NULL AND country IS NULL"
    );
    $validDormantCategory->execute([$dormantCategoryId]);
    assertForum(!$validDormantCategory->fetchColumn(), 'dormant category remained valid for new plaza content');

    $generalId = (int)$db->query("SELECT id FROM forum_categories WHERE slug='general' AND is_active=1")->fetchColumn();
    $db->prepare("INSERT INTO forum_posts(author_id,scope,category_id,title,body_md) VALUES(1,'plaza',?,'安全渲染','<script>alert(1)</script> **bold**')")->execute([$generalId]);
    $postId = (int)$db->lastInsertId();
    $tags = forumNormalizeTags([' Galgame ', 'galgame', '活动  发布']);
    assertForum(count($tags) === 2, 'tag normalization did not remove case-insensitive duplicates');
    forumSyncPostTags($postId, $tags);
    forumSyncPostTags($postId, forumNormalizeTags(['活动发布', '新标签']));
    $tagMap = forumTagsForPosts([$postId]);
    assertForum(($tagMap[$postId] ?? []) === ['活动发布', '新标签'], 'post tag replacement or ordering failed');

    $db->exec("INSERT INTO forum_categories(scope,club_id,country,name,slug,sort_order,is_active) VALUES('plaza',NULL,NULL,'旧作品安利','recommend',99,1)");
    $legacyCategoryId = (int)$db->lastInsertId();
    $db->prepare('UPDATE forum_posts SET category_id=? WHERE id=?')->execute([$legacyCategoryId, $postId]);
    forumEnsureSchema($db);
    $resourcesId = (int)$db->query("SELECT id FROM forum_categories WHERE slug='resources' AND is_active=1")->fetchColumn();
    assertForum((int)$db->query("SELECT category_id FROM forum_posts WHERE id={$postId}")->fetchColumn() === $resourcesId, 'legacy category references were not reconciled');
    assertForum((int)$db->query("SELECT is_active FROM forum_categories WHERE id={$legacyCategoryId}")->fetchColumn() === 0, 'legacy duplicate category was not deactivated');

    $longMarkdown = "## Heading\n![cover](uploads/2026/08/cover.webp)\n"
        . "Read [official site](https://example.com/path?q=1) and <strong>safe text</strong>. <script>noise()</script>\x01 "
        . str_repeat('content ', 80);
    $excerpt = forumMarkdownExcerpt($longMarkdown);
    preg_match_all('/./us', $excerpt, $excerptCharacters);
    assertForum(count($excerptCharacters[0]) <= 180, 'Markdown excerpt exceeded 180 Unicode characters');
    assertForum(str_contains($excerpt, 'official site'), 'Markdown link label was not retained in excerpt');
    assertForum(str_contains($excerpt, 'safe text'), 'raw HTML inner text should remain readable in excerpt');
    assertForum(!str_contains($excerpt, 'https://'), 'URL leaked into Markdown excerpt');
    assertForum(!str_contains($excerpt, 'uploads/'), 'image path leaked into Markdown excerpt');
    assertForum(!str_contains($excerpt, '<strong>'), 'raw HTML markup leaked into Markdown excerpt');
    assertForum(!str_contains($excerpt, 'noise()'), 'script content leaked into Markdown excerpt');
    assertForum(forumMarkdownExcerpt('![cover](uploads/2026/08/only-image.webp)') === '图片帖', 'pure image post excerpt should use the image-post label');

    $insertPost = $db->prepare("INSERT INTO forum_posts(author_id,scope,category_id,title,body_md) VALUES(1,'plaza',?,?,?)");
    $insertPost->execute([$resourcesId, 'Image post', '![cover](uploads/2026/08/first.webp)']);
    $imagePostId = (int)$db->lastInsertId();
    $insertPost->execute([$resourcesId, 'Text post', 'Plain text without an attachment.']);
    $textPostId = (int)$db->lastInsertId();

    $insertAttachment = $db->prepare(
        'INSERT INTO forum_attachments(uploader_id,target_type,target_id,upload_token,relative_path,mime_type,width,height,file_size,original_name)
         VALUES(?,?,?,?,?,?,?,?,?,?)'
    );
    $insertAttachment->execute([1, null, null, 'temporary-token', 'uploads/2026/08/temporary.webp', 'image/webp', 320, 180, 1024, 'temporary.webp']);
    $insertAttachment->execute([1, 'post', $imagePostId, 'bound-token', 'uploads/2026/08/first.webp', 'image/webp', 1280, 720, 2048, 'cover.webp']);
    $firstBoundAttachmentId = (int)$db->lastInsertId();
    $insertAttachment->execute([1, 'post', $imagePostId, 'bound-token', 'uploads/2026/08/second.webp', 'image/webp', 640, 480, 2048, 'second.webp']);
    $insertAttachment->execute([1, 'post', $postId, 'other-post-token', 'uploads/2026/08/other-post.webp', 'image/webp', 800, 600, 2048, 'other.webp']);

    $previewMap = forumPreviewImagesForPosts([$imagePostId, $textPostId]);
    assertForum(isset($previewMap[$imagePostId]), 'bound post attachment was not returned as a preview image');
    assertForum(!isset($previewMap[$textPostId]), 'post without a bound attachment should not have a preview image');
    assertForum(($previewMap[$imagePostId]['url'] ?? '') === './uploads/2026/08/first.webp', 'preview did not select the first bound attachment');
    assertForum(($previewMap[$imagePostId]['width'] ?? 0) === 1280 && ($previewMap[$imagePostId]['height'] ?? 0) === 720, 'preview dimensions were not serialized');
    assertForum(($previewMap[$imagePostId]['alt'] ?? '') === 'cover.webp', 'preview alt text did not use the original file name');
    assertForum(!in_array('./uploads/2026/08/temporary.webp', array_column($previewMap, 'url'), true), 'unbound temporary attachment leaked into preview images');
    assertForum(!in_array('./uploads/2026/08/other-post.webp', array_column($previewMap, 'url'), true), 'attachment from another post leaked into preview images');
    assertForum($firstBoundAttachmentId > 0, 'bound attachment fixture was not created');

    $postRow = $db->query(
        "SELECT p.*,c.name AS category_name,c.slug AS category_slug,
                u.username,u.nickname,u.avatar_url,u.role AS author_role," . FORUM_DISPLAY_CLUB_SELECT . "
         FROM forum_posts p JOIN users u ON u.id=p.author_id " . FORUM_DISPLAY_CLUB_JOIN . "
         LEFT JOIN forum_categories c ON c.id=p.category_id
         WHERE p.id={$imagePostId}"
    )->fetch(PDO::FETCH_ASSOC);
    assertForum(is_array($postRow), 'post list fixture could not be loaded');
    $listItem = forumSerializePostListItem(
        $postRow,
        ['id' => 1, 'role' => 'visitor'],
        [],
        $previewMap[$imagePostId] ?? null
    );
    assertForum(($listItem['excerpt'] ?? '') === '图片帖', 'shared list serializer did not expose the post excerpt');
    assertForum(($listItem['preview_image']['url'] ?? '') === './uploads/2026/08/first.webp', 'shared list serializer did not expose the preview image');
    assertForum(($listItem['author']['display_club']['country'] ?? '') === 'china', 'post list author did not expose the selected display club');
    assertForum(($listItem['author']['display_club']['role'] ?? '') === 'member', 'post list author used the platform role instead of the membership role');
    assertForum(!array_key_exists('display_membership_id', $listItem['author']), 'public Forum author leaked display_membership_id');
    assertForum(!array_key_exists('body_md', $listItem), 'list serializer leaked the full Markdown body');
    assertForum(($listItem['capabilities']['edit'] ?? false) === true, 'list_mine-compatible serialization lost author capabilities');
    $searchListItem = forumSerializePostListItem($postRow, null, [], $previewMap[$imagePostId] ?? null, true);
    assertForum(($searchListItem['match_excerpt'] ?? null) === ($searchListItem['excerpt'] ?? null), 'search list item did not expose the sanitized match excerpt');

    $db->exec("UPDATE club_memberships SET role='manager' WHERE id=101");
    $dynamicPost = forumSerializePost(forumGetPost($imagePostId), null, []);
    assertForum(($dynamicPost['author']['display_club']['role'] ?? '') === 'manager', 'existing post did not dynamically reflect a display membership role change');
    $db->beginTransaction();
    $db->exec("UPDATE club_memberships SET status='left' WHERE id=101");
    displayClubClearSelection($db, 101);
    assertForum($db->query("SELECT display_membership_id FROM users WHERE id=1")->fetchColumn() === null, 'display membership was not cleared in the lifecycle transaction');
    $db->rollBack();
    assertForum((int)$db->query("SELECT display_membership_id FROM users WHERE id=1")->fetchColumn() === 101, 'display membership cleanup did not roll back with the lifecycle transaction');
    $db->beginTransaction();
    $db->exec("UPDATE club_memberships SET status='left' WHERE id=101");
    displayClubClearSelection($db, 101);
    $db->commit();
    $hiddenIdentityPost = forumSerializePost(forumGetPost($imagePostId), null, []);
    assertForum(($hiddenIdentityPost['author']['display_club'] ?? null) === null, 'cleared display membership remained visible on an existing post');
    $db->exec("UPDATE club_memberships SET role='member',status='active' WHERE id=101");
    $db->exec("UPDATE users SET display_membership_id=101 WHERE id=1");

    $textPostRow = $db->query(
        "SELECT p.*,c.name AS category_name,c.slug AS category_slug,
                u.username,u.nickname,u.avatar_url,u.role AS author_role," . FORUM_DISPLAY_CLUB_SELECT . "
         FROM forum_posts p JOIN users u ON u.id=p.author_id " . FORUM_DISPLAY_CLUB_JOIN . "
         LEFT JOIN forum_categories c ON c.id=p.category_id
         WHERE p.id={$textPostId}"
    )->fetch(PDO::FETCH_ASSOC);
    $textListItem = forumSerializePostListItem($textPostRow, null, [], $previewMap[$textPostId] ?? null);
    assertForum(array_key_exists('preview_image', $textListItem) && $textListItem['preview_image'] === null, 'no-image post must serialize preview_image as null');

    $insertPost->execute([$resourcesId, 'Attachment sync post', '![old](uploads/2026/08/sync-old.webp)']);
    $syncPostId = (int)$db->lastInsertId();
    $insertAttachment->execute([1, 'post', $syncPostId, 'sync-old-token', 'uploads/2026/08/sync-old.webp', 'image/webp', 800, 450, 2048, 'old.webp']);
    $syncOldId = (int)$db->lastInsertId();
    $insertAttachment->execute([1, 'post', $syncPostId, 'sync-keep-token', 'uploads/2026/08/sync-keep.webp', 'image/webp', 800, 450, 2048, 'keep.webp']);
    $syncKeepId = (int)$db->lastInsertId();
    $insertAttachment->execute([1, null, null, 'sync-new-token', 'uploads/2026/08/sync-new.webp', 'image/webp', 1280, 720, 4096, 'new.webp']);
    $syncNewId = (int)$db->lastInsertId();
    $syncMarkdown = "![kept](uploads/2026/08/sync-keep.webp)\n![new](./uploads/2026/08/sync-new.webp)";
    forumValidateMarkdownImages($syncMarkdown, 1, 'sync-new-token', 'post', $syncPostId);
    forumBindAttachments(1, 'sync-new-token', 'post', $syncPostId, $syncMarkdown);
    $syncRows = $db->query(
        "SELECT id,target_type,target_id FROM forum_attachments WHERE id IN ({$syncOldId},{$syncKeepId},{$syncNewId}) ORDER BY id"
    )->fetchAll(PDO::FETCH_ASSOC);
    $syncById = [];
    foreach ($syncRows as $row) $syncById[(int)$row['id']] = $row;
    assertForum(($syncById[$syncOldId]['target_type'] ?? '') === 'post_archive', 'removed Markdown image was not archived away from live previews');
    assertForum((int)($syncById[$syncOldId]['target_id'] ?? 0) === $syncPostId, 'archived attachment lost its audit target');
    assertForum((int)($syncById[$syncKeepId]['target_id'] ?? 0) === $syncPostId, 'referenced existing attachment was detached');
    assertForum((int)($syncById[$syncNewId]['target_id'] ?? 0) === $syncPostId, 'new referenced attachment was not bound');
    $syncPreview = forumPreviewImagesForPosts([$syncPostId]);
    assertForum(($syncPreview[$syncPostId]['url'] ?? '') === './uploads/2026/08/sync-keep.webp', 'preview still exposed an attachment removed from Markdown');
    assertForum(forumMarkdownImagePaths($syncMarkdown) === ['uploads/2026/08/sync-keep.webp', 'uploads/2026/08/sync-new.webp'], 'Markdown image path normalization failed');

    $insertReply = $db->prepare('INSERT INTO forum_replies(post_id,author_id,body_md,created_at) VALUES(?,?,?,?)');
    $replyIds = [];
    for ($index = 1; $index <= 31; $index++) {
        $insertReply->execute([$textPostId, 1, "Reply {$index}", sprintf('2026-08-09 12:%02d:00', min(59, $index))]);
        $replyIds[] = (int)$db->lastInsertId();
    }
    $reply31 = $replyIds[30];
    $floorStmt = $db->prepare(
        'SELECT COUNT(*) FROM forum_replies earlier
         JOIN forum_replies target ON target.id=? AND target.post_id=earlier.post_id
         WHERE earlier.created_at < target.created_at OR (earlier.created_at=target.created_at AND earlier.id<=target.id)'
    );
    $floorStmt->execute([$reply31]);
    assertForum((int)$floorStmt->fetchColumn() === 31, 'initial reply floor fixture is incorrect');
    assertForum(forumReplyPageForAnchor($textPostId, $reply31, 30) === 2, '31st reply anchor did not resolve to page two');
    $db->prepare("UPDATE forum_replies SET status='deleted',deleted_at=CURRENT_TIMESTAMP WHERE id=?")->execute([$replyIds[0]]);
    assertForum(forumReplyPageForAnchor($textPostId, $reply31, 30) === 1, 'reply anchor page did not adapt after an earlier reply was deleted');
    $floorStmt->execute([$reply31]);
    assertForum((int)$floorStmt->fetchColumn() === 31, 'historical reply floor changed after an earlier soft deletion');
    assertForum(
        forumReplyLink($textPostId, $reply31) === "./Forum/forum-post.html?id={$textPostId}&reply_anchor={$reply31}#reply-{$reply31}",
        'reply notification link does not preserve the stable anchor query'
    );

    echo "forum v1 SQLite schema, display clubs, dormant-data preservation, plaza-only access, tags, excerpts, preview images, attachment sync, reply anchors, and category reconciliation passed\n";
} finally {
    @unlink($dbFile);
    @unlink($dbFile . '-wal');
    @unlink($dbFile . '-shm');
}
