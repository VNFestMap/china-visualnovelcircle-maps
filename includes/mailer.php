<?php
// includes/mailer.php - 邮件发送（支持 SMTP 和 mail() 两种方式）
// SMTP 配置在 config.php 中设置

function sendMail(string $to, string $subject, string $body): bool {
    $driver = defined('MAIL_DRIVER') ? MAIL_DRIVER : 'mail';

    if ($driver === 'smtp') {
        return sendMailSMTP($to, $subject, $body);
    }
    return sendMailNative($to, $subject, $body);
}

// 使用 PHP mail() 发送
function sendMailNative(string $to, string $subject, string $body): bool {
    $fromName = defined('MAIL_FROM_NAME') ? MAIL_FROM_NAME : '地图';
    $fromAddr = defined('MAIL_FROM_ADDR') ? MAIL_FROM_ADDR : 'noreply@localhost';
    $headers = 'From: =?UTF-8?B?' . base64_encode($fromName) . '?= <' . $fromAddr . ">\r\n"
             . 'Content-Type: text/plain; charset=UTF-8';
    return @mail($to, $subject, $body, $headers);
}

// 使用 SMTP 发送（PHP 内置 socket，无需外部库）
function sendMailSMTP(string $to, string $subject, string $body): bool {
    $host = defined('SMTP_HOST') ? SMTP_HOST : '';
    $port = defined('SMTP_PORT') ? (int)SMTP_PORT : 465;
    $user = defined('SMTP_USER') ? SMTP_USER : '';
    $pass = defined('SMTP_PASS') ? SMTP_PASS : '';
    $secure = defined('SMTP_SECURE') ? SMTP_SECURE : 'ssl'; // ssl 或 tls
    $fromName = defined('MAIL_FROM_NAME') ? MAIL_FROM_NAME : '地图';
    $fromAddr = defined('MAIL_FROM_ADDR') ? MAIL_FROM_ADDR : $user;

    if (!$host || !$user || !$pass) {
        error_log('SMTP 配置不完整');
        return false;
    }

    // 连接到 SMTP 服务器
    $prefix = $secure === 'ssl' ? 'ssl://' : '';
    $errno = 0;
    $errstr = '';
    $socket = @fsockopen($prefix . $host, $port, $errno, $errstr, 10);
    if (!$socket) {
        // TLS 模式：先连明文再 STARTTLS
        if ($secure === 'tls') {
            $socket = @fsockopen($host, $port, $errno, $errstr, 10);
            if (!$socket) {
                error_log("SMTP 连接失败: $errstr ($errno)");
                return false;
            }
            fgets($socket, 512);
            fwrite($socket, "EHLO mailer\r\n");
            while ($line = fgets($socket, 512)) {
                if (substr($line, 3, 1) === ' ') break;
            }
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                fclose($socket);
                error_log('SMTP TLS 握手失败');
                return false;
            }
            fwrite($socket, "EHLO mailer\r\n");
            while ($line = fgets($socket, 512)) {
                if (substr($line, 3, 1) === ' ') break;
            }
        } else {
            error_log("SMTP 连接失败: $errstr ($errno)");
            return false;
        }
    } else {
        fgets($socket, 512);
        fwrite($socket, "EHLO mailer\r\n");
        while ($line = fgets($socket, 512)) {
            if (substr($line, 3, 1) === ' ') break;
        }
    }

    // 登录
    fwrite($socket, "AUTH LOGIN\r\n");
    fgets($socket, 512);
    fwrite($socket, base64_encode($user) . "\r\n");
    fgets($socket, 512);
    fwrite($socket, base64_encode($pass) . "\r\n");
    $authResp = fgets($socket, 512);
    if (substr($authResp, 0, 3) !== '235' && substr($authResp, 0, 3) !== '334') {
        error_log("SMTP 认证失败: $authResp");
        fclose($socket);
        return false;
    }

    // 发件人
    fwrite($socket, "MAIL FROM:<$fromAddr>\r\n");
    fgets($socket, 512);
    // 收件人
    fwrite($socket, "RCPT TO:<$to>\r\n");
    fgets($socket, 512);
    // 数据
    fwrite($socket, "DATA\r\n");
    fgets($socket, 512);

    $headers = "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$fromAddr>\r\n"
             . "To: <$to>\r\n"
             . "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n"
             . "Content-Type: text/plain; charset=UTF-8\r\n"
             . "MIME-Version: 1.0\r\n";

    fwrite($socket, $headers . "\r\n" . $body . "\r\n.\r\n");
    $resp = fgets($socket, 512);
    fwrite($socket, "QUIT\r\n");
    fclose($socket);

    $success = substr($resp, 0, 3) === '250';
    if (!$success) {
        error_log("SMTP 发送失败: $resp");
    }
    return $success;
}
