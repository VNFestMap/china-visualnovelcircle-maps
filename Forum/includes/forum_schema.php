<?php
declare(strict_types=1);

/**
 * VNFest Forum schema shared by the main migration runner and isolated tests.
 * The implementation is intentionally dependency-free and supports MySQL and SQLite.
 */

function forumEnsureSchema(PDO $db): void
{
    $driver = (string)$db->getAttribute(PDO::ATTR_DRIVER_NAME);
    if ($driver === 'mysql') {
        forumEnsureMysqlSchema($db);
    } elseif ($driver === 'sqlite') {
        forumEnsureSqliteSchema($db);
    } else {
        throw new RuntimeException('Unsupported forum database driver: ' . $driver);
    }
    forumReconcilePlazaCategories($db);
}

function forumEnsureMysqlSchema(PDO $db): void
{
    $tables = [
        "CREATE TABLE IF NOT EXISTS forum_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            scope VARCHAR(16) NOT NULL DEFAULT 'plaza',
            club_id INT NULL,
            country VARCHAR(20) NULL,
            name VARCHAR(60) NOT NULL,
            slug VARCHAR(60) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_forum_category (scope, club_id, country, slug),
            KEY idx_forum_category_scope (scope, club_id, country, is_active, sort_order),
            CONSTRAINT fk_forum_category_user FOREIGN KEY (created_by) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS forum_posts (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            author_id INT NOT NULL,
            scope VARCHAR(16) NOT NULL DEFAULT 'plaza',
            club_id INT NULL,
            country VARCHAR(20) NULL,
            category_id INT NULL,
            title VARCHAR(100) NOT NULL,
            body_md MEDIUMTEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'published',
            is_pinned TINYINT(1) NOT NULL DEFAULT 0,
            is_essence TINYINT(1) NOT NULL DEFAULT 0,
            view_count INT NOT NULL DEFAULT 0,
            reply_count INT NOT NULL DEFAULT 0,
            like_count INT NOT NULL DEFAULT 0,
            favorite_count INT NOT NULL DEFAULT 0,
            last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            edited_at TIMESTAMP NULL,
            deleted_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_forum_posts_feed (scope, club_id, country, status, is_pinned, last_activity_at),
            KEY idx_forum_posts_author (author_id, created_at),
            FULLTEXT KEY ft_forum_posts (title, body_md),
            CONSTRAINT fk_forum_post_author FOREIGN KEY (author_id) REFERENCES users(id),
            CONSTRAINT fk_forum_post_category FOREIGN KEY (category_id) REFERENCES forum_categories(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS forum_replies (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            post_id BIGINT NOT NULL,
            author_id INT NOT NULL,
            parent_reply_id BIGINT NULL,
            body_md MEDIUMTEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'published',
            like_count INT NOT NULL DEFAULT 0,
            edited_at TIMESTAMP NULL,
            deleted_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_forum_replies_post (post_id, status, created_at),
            FULLTEXT KEY ft_forum_replies (body_md),
            CONSTRAINT fk_forum_reply_post FOREIGN KEY (post_id) REFERENCES forum_posts(id),
            CONSTRAINT fk_forum_reply_author FOREIGN KEY (author_id) REFERENCES users(id),
            CONSTRAINT fk_forum_reply_parent FOREIGN KEY (parent_reply_id) REFERENCES forum_replies(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS forum_attachments (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            uploader_id INT NOT NULL,
            target_type VARCHAR(16) NULL,
            target_id BIGINT NULL,
            upload_token VARCHAR(64) NOT NULL,
            relative_path VARCHAR(500) NOT NULL,
            mime_type VARCHAR(80) NOT NULL,
            width INT NOT NULL DEFAULT 0,
            height INT NOT NULL DEFAULT 0,
            file_size BIGINT NOT NULL,
            original_name VARCHAR(255) NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_forum_attachment_target (target_type, target_id),
            KEY idx_forum_attachment_upload (uploader_id, upload_token),
            CONSTRAINT fk_forum_attachment_user FOREIGN KEY (uploader_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS forum_reactions (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            target_type VARCHAR(16) NOT NULL,
            target_id BIGINT NOT NULL,
            reaction_type VARCHAR(16) NOT NULL DEFAULT 'like',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_forum_reaction (user_id, target_type, target_id, reaction_type),
            KEY idx_forum_reaction_target (target_type, target_id),
            CONSTRAINT fk_forum_reaction_user FOREIGN KEY (user_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS forum_favorites (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            post_id BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_forum_favorite (user_id, post_id),
            CONSTRAINT fk_forum_favorite_user FOREIGN KEY (user_id) REFERENCES users(id),
            CONSTRAINT fk_forum_favorite_post FOREIGN KEY (post_id) REFERENCES forum_posts(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS forum_reports (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            reporter_id INT NOT NULL,
            target_type VARCHAR(16) NOT NULL,
            target_id BIGINT NOT NULL,
            reason VARCHAR(32) NOT NULL,
            details VARCHAR(1000) NOT NULL DEFAULT '',
            content_snapshot MEDIUMTEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            handled_by INT NULL,
            resolution VARCHAR(1000) NOT NULL DEFAULT '',
            handled_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_forum_reports_queue (status, created_at),
            KEY idx_forum_reports_target (target_type, target_id),
            CONSTRAINT fk_forum_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
            CONSTRAINT fk_forum_report_handler FOREIGN KEY (handled_by) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS forum_revisions (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            target_type VARCHAR(16) NOT NULL,
            target_id BIGINT NOT NULL,
            editor_id INT NOT NULL,
            title_snapshot VARCHAR(100) NULL,
            body_snapshot MEDIUMTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_forum_revision_target (target_type, target_id, created_at),
            CONSTRAINT fk_forum_revision_editor FOREIGN KEY (editor_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS forum_tags (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(20) NOT NULL,
            normalized_name VARCHAR(80) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_forum_tag_normalized (normalized_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS forum_post_tags (
            post_id BIGINT NOT NULL,
            tag_id BIGINT NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            PRIMARY KEY (post_id, tag_id),
            KEY idx_forum_post_tags_order (post_id, sort_order),
            CONSTRAINT fk_forum_post_tag_post FOREIGN KEY (post_id) REFERENCES forum_posts(id),
            CONSTRAINT fk_forum_post_tag_tag FOREIGN KEY (tag_id) REFERENCES forum_tags(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ];

    foreach ($tables as $sql) {
        $db->exec($sql);
    }
}

function forumEnsureSqliteSchema(PDO $db): void
{
    $tables = [
        "CREATE TABLE IF NOT EXISTS forum_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL DEFAULT 'plaza', club_id INTEGER,
            country TEXT, name TEXT NOT NULL, slug TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1, created_by INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(scope, club_id, country, slug))",
        "CREATE TABLE IF NOT EXISTS forum_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL REFERENCES users(id),
            scope TEXT NOT NULL DEFAULT 'plaza', club_id INTEGER, country TEXT,
            category_id INTEGER REFERENCES forum_categories(id), title TEXT NOT NULL, body_md TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'published', is_pinned INTEGER NOT NULL DEFAULT 0,
            is_essence INTEGER NOT NULL DEFAULT 0, view_count INTEGER NOT NULL DEFAULT 0,
            reply_count INTEGER NOT NULL DEFAULT 0, like_count INTEGER NOT NULL DEFAULT 0,
            favorite_count INTEGER NOT NULL DEFAULT 0, last_activity_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            edited_at TEXT, deleted_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS forum_replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES forum_posts(id),
            author_id INTEGER NOT NULL REFERENCES users(id), parent_reply_id INTEGER REFERENCES forum_replies(id),
            body_md TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published', like_count INTEGER NOT NULL DEFAULT 0,
            edited_at TEXT, deleted_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS forum_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT, uploader_id INTEGER NOT NULL REFERENCES users(id),
            target_type TEXT, target_id INTEGER, upload_token TEXT NOT NULL, relative_path TEXT NOT NULL,
            mime_type TEXT NOT NULL, width INTEGER NOT NULL DEFAULT 0, height INTEGER NOT NULL DEFAULT 0,
            file_size INTEGER NOT NULL, original_name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS forum_reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
            target_type TEXT NOT NULL, target_id INTEGER NOT NULL, reaction_type TEXT NOT NULL DEFAULT 'like',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, target_type, target_id, reaction_type))",
        "CREATE TABLE IF NOT EXISTS forum_favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
            post_id INTEGER NOT NULL REFERENCES forum_posts(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, post_id))",
        "CREATE TABLE IF NOT EXISTS forum_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER NOT NULL REFERENCES users(id),
            target_type TEXT NOT NULL, target_id INTEGER NOT NULL, reason TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
            content_snapshot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', handled_by INTEGER REFERENCES users(id),
            resolution TEXT NOT NULL DEFAULT '', handled_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS forum_revisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, target_type TEXT NOT NULL, target_id INTEGER NOT NULL,
            editor_id INTEGER NOT NULL REFERENCES users(id), title_snapshot TEXT, body_snapshot TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS forum_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS forum_post_tags (
            post_id INTEGER NOT NULL REFERENCES forum_posts(id), tag_id INTEGER NOT NULL REFERENCES forum_tags(id),
            sort_order INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(post_id, tag_id))",
    ];

    foreach ($tables as $sql) {
        $db->exec($sql);
    }

    $indexes = [
        'CREATE INDEX IF NOT EXISTS idx_forum_category_scope ON forum_categories(scope, club_id, country, is_active, sort_order)',
        'CREATE INDEX IF NOT EXISTS idx_forum_posts_feed ON forum_posts(scope, club_id, country, status, is_pinned, last_activity_at)',
        'CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON forum_replies(post_id, status, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_forum_attachment_target ON forum_attachments(target_type, target_id)',
        'CREATE INDEX IF NOT EXISTS idx_forum_attachment_upload ON forum_attachments(uploader_id, upload_token)',
        'CREATE INDEX IF NOT EXISTS idx_forum_reaction_target ON forum_reactions(target_type, target_id)',
        'CREATE INDEX IF NOT EXISTS idx_forum_reports_queue ON forum_reports(status, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_forum_revision_target ON forum_revisions(target_type, target_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_forum_post_tags_order ON forum_post_tags(post_id, sort_order)',
    ];
    foreach ($indexes as $sql) {
        $db->exec($sql);
    }

    try {
        $db->exec("CREATE VIRTUAL TABLE IF NOT EXISTS forum_posts_fts USING fts5(title, body_md, content='forum_posts', content_rowid='id')");
        $db->exec("CREATE VIRTUAL TABLE IF NOT EXISTS forum_replies_fts USING fts5(body_md, content='forum_replies', content_rowid='id')");
        $db->exec("CREATE TRIGGER IF NOT EXISTS forum_posts_ai AFTER INSERT ON forum_posts BEGIN INSERT INTO forum_posts_fts(rowid,title,body_md) VALUES(new.id,new.title,new.body_md); END");
        $db->exec("CREATE TRIGGER IF NOT EXISTS forum_posts_ad AFTER DELETE ON forum_posts BEGIN INSERT INTO forum_posts_fts(forum_posts_fts,rowid,title,body_md) VALUES('delete',old.id,old.title,old.body_md); END");
        $db->exec("CREATE TRIGGER IF NOT EXISTS forum_posts_au AFTER UPDATE ON forum_posts BEGIN INSERT INTO forum_posts_fts(forum_posts_fts,rowid,title,body_md) VALUES('delete',old.id,old.title,old.body_md); INSERT INTO forum_posts_fts(rowid,title,body_md) VALUES(new.id,new.title,new.body_md); END");
        $db->exec("CREATE TRIGGER IF NOT EXISTS forum_replies_ai AFTER INSERT ON forum_replies BEGIN INSERT INTO forum_replies_fts(rowid,body_md) VALUES(new.id,new.body_md); END");
        $db->exec("CREATE TRIGGER IF NOT EXISTS forum_replies_ad AFTER DELETE ON forum_replies BEGIN INSERT INTO forum_replies_fts(forum_replies_fts,rowid,body_md) VALUES('delete',old.id,old.body_md); END");
        $db->exec("CREATE TRIGGER IF NOT EXISTS forum_replies_au AFTER UPDATE ON forum_replies BEGIN INSERT INTO forum_replies_fts(forum_replies_fts,rowid,body_md) VALUES('delete',old.id,old.body_md); INSERT INTO forum_replies_fts(rowid,body_md) VALUES(new.id,new.body_md); END");
        $db->exec("INSERT INTO forum_posts_fts(forum_posts_fts) VALUES('rebuild')");
        $db->exec("INSERT INTO forum_replies_fts(forum_replies_fts) VALUES('rebuild')");
    } catch (PDOException $error) {
        // SQLite distributions without FTS5 use the parameterized LIKE path in the API.
    }
}

function forumReconcilePlazaCategories(PDO $db): void
{
    $definitions = [
        ['slug' => 'general', 'name' => '综合讨论', 'sort' => 10, 'aliases' => []],
        ['slug' => 'resources', 'name' => '资源分享', 'sort' => 20, 'aliases' => ['recommend']],
        ['slug' => 'events', 'name' => '活动发布', 'sort' => 30, 'aliases' => ['event']],
        ['slug' => 'works', 'name' => '作品交流', 'sort' => 40, 'aliases' => ['creation']],
        ['slug' => 'help', 'name' => '求助答疑', 'sort' => 50, 'aliases' => []],
    ];

    $find = $db->prepare("SELECT id, slug FROM forum_categories WHERE scope='plaza' AND club_id IS NULL AND country IS NULL AND slug=? LIMIT 1");
    $insert = $db->prepare("INSERT INTO forum_categories(scope, club_id, country, name, slug, sort_order, is_active) VALUES('plaza', NULL, NULL, ?, ?, ?, 1)");
    $activate = $db->prepare("UPDATE forum_categories SET name=?, sort_order=?, is_active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?");
    $rename = $db->prepare("UPDATE forum_categories SET name=?, slug=?, sort_order=?, is_active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?");
    $movePosts = $db->prepare('UPDATE forum_posts SET category_id=? WHERE category_id=?');
    $deactivate = $db->prepare('UPDATE forum_categories SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?');

    foreach ($definitions as $definition) {
        $find->execute([$definition['slug']]);
        $target = $find->fetch();
        $aliases = [];
        foreach ($definition['aliases'] as $alias) {
            $find->execute([$alias]);
            $row = $find->fetch();
            if ($row) $aliases[] = $row;
        }

        if (!$target && $aliases) {
            $target = array_shift($aliases);
            $rename->execute([$definition['name'], $definition['slug'], $definition['sort'], (int)$target['id']]);
        } elseif (!$target) {
            $insert->execute([$definition['name'], $definition['slug'], $definition['sort']]);
            $target = ['id' => (int)$db->lastInsertId(), 'slug' => $definition['slug']];
        } else {
            $activate->execute([$definition['name'], $definition['sort'], (int)$target['id']]);
        }

        foreach ($aliases as $alias) {
            if ((int)$alias['id'] === (int)$target['id']) continue;
            $movePosts->execute([(int)$target['id'], (int)$alias['id']]);
            $deactivate->execute([(int)$alias['id']]);
        }
    }
}
