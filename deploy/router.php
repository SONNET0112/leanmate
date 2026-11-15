<?php
/**
 * 仅用于本地验证：php -S 127.0.0.1:8081 -t deploy deploy/router.php
 * 线上 Apache 用 .htaccess，Nginx 用 nginx.conf.example 里的规则。
 */
$path = rawurldecode((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH));

// 所有 /api/ai/* 都交给 ai.php，未知接口由它返回 JSON 404（不要落到 SPA 的 index.html）
if (str_starts_with($path, '/api/ai')) {
    if (preg_match('#/api/ai/(health|parse)/?$#', $path, $m)) {
        $_GET['action'] = $m[1];
    }
    require __DIR__ . '/api/ai.php';
    return true;
}

$file = __DIR__ . $path;
if ($path !== '/' && is_file($file)) {
    return false; // 交给内置服务器输出静态文件
}

header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/index.html');
return true;
