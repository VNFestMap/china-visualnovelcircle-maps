<?php
// api/get_config.php - 返回公开配置（不包含敏感信息）
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

echo json_encode([
    'site_url' => SITE_URL,
    'auth_providers' => ['local'],
    'version' => '2.0.0'
]);
