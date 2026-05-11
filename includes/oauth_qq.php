<?php
// includes/oauth_qq.php - QQ OAuth2 登录
// 参考 QQ 互联 OAuth2.0 文档: https://wiki.connect.qq.com/

require_once __DIR__ . '/../config.php';

function qq_get_authorization_url(): string {
    $state = bin2hex(random_bytes(16));
    $_SESSION['qq_state'] = $state;

    $params = http_build_query([
        'response_type' => 'code',
        'client_id' => QQ_APPID,
        'redirect_uri' => QQ_REDIRECT_URI,
        'state' => $state,
        'scope' => 'get_user_info',
    ]);

    return 'https://graph.qq.com/oauth2.0/authorize?' . $params;
}

function qq_handle_callback(string $code, string $state): ?array {
    // 验证 state 防止 CSRF
    if (!isset($_SESSION['qq_state']) || $state !== $_SESSION['qq_state']) {
        return null;
    }
    unset($_SESSION['qq_state']);

    // 用 code 换 access_token
    $tokenUrl = 'https://graph.qq.com/oauth2.0/token?' . http_build_query([
        'grant_type' => 'authorization_code',
        'client_id' => QQ_APPID,
        'client_secret' => QQ_APPSECRET,
        'code' => $code,
        'redirect_uri' => QQ_REDIRECT_URI,
        'fmt' => 'json',
    ]);

    $tokenResp = @file_get_contents($tokenUrl);
    if (!$tokenResp) return null;
    $tokenData = json_decode($tokenResp, true);
    if (!isset($tokenData['access_token'])) return null;

    $accessToken = $tokenData['access_token'];

    // 获取 openid
    $openidUrl = 'https://graph.qq.com/oauth2.0/me?access_token=' . urlencode($accessToken) . '&fmt=json';
    $openidResp = @file_get_contents($openidUrl);
    if (!$openidResp) return null;
    $openidData = json_decode($openidResp, true);
    if (!isset($openidData['openid'])) return null;

    $openid = $openidData['openid'];
    $unionid = $openidData['unionid'] ?? null;

    // 获取用户信息
    $userInfoUrl = 'https://graph.qq.com/user/get_user_info?' . http_build_query([
        'access_token' => $accessToken,
        'oauth_consumer_key' => QQ_APPID,
        'openid' => $openid,
    ]);

    $userInfoResp = @file_get_contents($userInfoUrl);
    if (!$userInfoResp) return null;
    $userInfo = json_decode($userInfoResp, true);
    if (!isset($userInfo['nickname'])) return null;

    return [
        'openid' => $openid,
        'unionid' => $unionid,
        'username' => $userInfo['nickname'],
        'avatar_url' => $userInfo['figureurl_qq_2'] ?? $userInfo['figureurl_qq_1'] ?? '',
    ];
}
