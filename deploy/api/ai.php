<?php
/**
 * LeanMate AI 代理（PHP 版，等价于本地 Vite 中间件 server/ai-middleware.mjs）
 *
 * 端点：
 *   GET  /api/ai/health    → {"configured":bool,"model":string,"baseUrl":string}
 *   POST /api/ai/parse     → {"items":[...],"model":"..."}  body: {"text":"中午吃了…"}
 *
 * 密钥来源（按优先级）：环境变量 AI_API_KEY → TOKENRIVER_API_KEY → api/config.php 里的 api_key
 * 绝不把密钥写进前端或提交到仓库。
 */
declare(strict_types=1);

const DEFAULT_BASE_URL = 'https://api.tokenriver.cn/v1';
const DEFAULT_MODEL = 'deepseek-flash';
const MAX_BODY_BYTES = 32768;
const MAX_ITEMS = 10;

const SYSTEM_PROMPT_HEAD = <<<TXT
你是饮食记录解析器。把用户的一句中文饮食描述拆成食物条目。
只能输出一个 JSON 对象，不要 Markdown、不要解释。格式：
{"items":[{"name":"食物名","foodId":"食物库id或null","amountG":200,"mealType":"breakfast|lunch|dinner|snack","confidence":0.8,"basis":"份量依据，20字内","per100g":{"caloriesKcal":116,"proteinG":2.6,"carbohydratesG":25.9,"fatG":0.3}}]}
规则：
1. 食物库命中时填 foodId（只用下面列表里的 id），并照抄该行每100g数值。
2. 食物库没有命中时 foodId 填 null，per100g 按同类食物公开数据估算。
3. amountG 是克数，1-2000。单位换算：一碗米饭/面约200g，一份炒菜约150g，一个鸡蛋约50g，一杯牛奶约250ml，一两=50g。
4. 用户没写餐次时按描述推断（早/中/晚/加餐），无法推断用 lunch。
5. confidence 0-1，份量越模糊越低；basis 写清估算依据。
6. 最多 10 条，不含重复食物。
食物库（id|名称|状态|每100g 热量/蛋白/碳水/脂肪）：
TXT;

function send_json(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ai_config(): array
{
    $file = __DIR__ . '/config.php';
    $local = is_file($file) ? (array) include $file : [];
    $timeoutMs = (int) (getenv('AI_TIMEOUT_MS') ?: 45000);
    return [
        'api_key' => (string) (getenv('AI_API_KEY') ?: (getenv('TOKENRIVER_API_KEY') ?: ($local['api_key'] ?? ''))),
        'base_url' => rtrim((string) (getenv('AI_BASE_URL') ?: ($local['base_url'] ?? DEFAULT_BASE_URL)), '/'),
        'model' => (string) (getenv('AI_MODEL') ?: ($local['model'] ?? DEFAULT_MODEL)),
        'timeout' => max(5.0, $timeoutMs / 1000),
    ];
}

/** @return array<int,array<string,mixed>> */
function load_foods(): array
{
    $file = __DIR__ . '/foods.json';
    if (!is_file($file)) {
        return [];
    }
    $decoded = json_decode((string) file_get_contents($file), true);
    return is_array($decoded) ? $decoded : [];
}

function build_system_prompt(array $foods): string
{
    $lines = [];
    foreach ($foods as $food) {
        $n = $food['nutritionPer100g'] ?? [];
        $lines[] = sprintf(
            '%s|%s|%s|%s/%s/%s/%s',
            $food['id'] ?? '',
            $food['name'] ?? '',
            $food['state'] ?? '',
            $n['caloriesKcal'] ?? 0,
            $n['proteinG'] ?? 0,
            $n['carbohydratesG'] ?? 0,
            $n['fatG'] ?? 0
        );
    }
    return SYSTEM_PROMPT_HEAD . "\n" . implode("\n", $lines);
}

function num(mixed $value, float $min, float $max, float $fallback = 0): float
{
    if (!is_numeric($value)) {
        return $fallback;
    }
    return min($max, max($min, (float) $value));
}

/** 服务端只做结构校验与裁剪，不替模型编造数值。 */
function sanitize_items(array $raw, array $foods): array
{
    $validIds = [];
    foreach ($foods as $food) {
        $validIds[(string) ($food['id'] ?? '')] = true;
    }
    $meals = ['breakfast' => true, 'lunch' => true, 'dinner' => true, 'snack' => true];
    $seen = [];
    $out = [];

    foreach (array_slice($raw, 0, MAX_ITEMS) as $item) {
        if (!is_array($item)) {
            continue;
        }
        $name = trim((string) ($item['name'] ?? ''));
        $name = mb_substr($name, 0, 40, 'UTF-8');
        if ($name === '' || isset($seen[$name])) {
            continue;
        }
        $seen[$name] = true;
        $per = is_array($item['per100g'] ?? null) ? $item['per100g'] : [];
        $foodId = (string) ($item['foodId'] ?? '');
        $meal = (string) ($item['mealType'] ?? '');

        $out[] = [
            'name' => $name,
            'foodId' => isset($validIds[$foodId]) ? $foodId : null,
            'amountG' => round(num($item['amountG'] ?? null, 1, 2000, 100), 1),
            'mealType' => isset($meals[$meal]) ? $meal : 'lunch',
            'confidence' => round(num($item['confidence'] ?? null, 0, 1, 0.5), 2),
            'basis' => mb_substr((string) ($item['basis'] ?? ''), 0, 60, 'UTF-8'),
            'per100g' => [
                'caloriesKcal' => (int) round(num($per['caloriesKcal'] ?? null, 0, 900)),
                'proteinG' => round(num($per['proteinG'] ?? null, 0, 100), 1),
                'carbohydratesG' => round(num($per['carbohydratesG'] ?? null, 0, 100), 1),
                'fatG' => round(num($per['fatG'] ?? null, 0, 100), 1),
            ],
        ];
    }
    return $out;
}

function extract_json(string $text): array
{
    $clean = trim(str_replace(['```json', '```'], '', $text));
    $start = strpos($clean, '{');
    $end = strrpos($clean, '}');
    if ($start === false || $end === false || $end <= $start) {
        throw new RuntimeException('模型没有返回 JSON');
    }
    $decoded = json_decode(substr($clean, $start, $end - $start + 1), true);
    if (!is_array($decoded)) {
        throw new RuntimeException('模型返回的 JSON 无法解析');
    }
    return $decoded;
}

/** @return array{0:int,1:array} */
function call_upstream(array $config, string $prompt, string $text): array
{
    if (!function_exists('curl_init')) {
        return [500, ['error' => ['code' => 'NO_CURL', 'message' => '服务器缺少 curl 扩展，无法调用 AI']]];
    }
    $body = json_encode([
        'model' => $config['model'],
        'temperature' => 0.2,
        'messages' => [
            ['role' => 'system', 'content' => $prompt],
            ['role' => 'user', 'content' => $text],
        ],
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($config['base_url'] . '/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => (int) ceil($config['timeout']),
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $config['api_key'],
        ],
    ]);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        $timeout = $errno === 28;
        return [$timeout ? 504 : 502, [
            'error' => [
                'code' => $timeout ? 'TIMEOUT' : 'UPSTREAM',
                'message' => $timeout ? 'AI 响应超时，可以重试或手动录入' : 'AI 调用失败，可以重试或手动录入',
                'detail' => mb_substr($error, 0, 200, 'UTF-8'),
            ],
        ]];
    }
    if ($status < 200 || $status >= 300) {
        return [502, ['error' => ['code' => 'UPSTREAM', 'message' => 'AI 服务返回 ' . $status, 'detail' => substr((string) $response, 0, 300)]]];
    }
    $decoded = json_decode((string) $response, true);
    $content = (string) ($decoded['choices'][0]['message']['content'] ?? '');
    try {
        $items = sanitize_items((array) (extract_json($content)['items'] ?? []), load_foods());
    } catch (Throwable $e) {
        return [502, ['error' => ['code' => 'PARSE', 'message' => 'AI 返回格式不符合要求，请重试或手动录入', 'detail' => $e->getMessage()]]];
    }
    if (!$items) {
        return [502, ['error' => ['code' => 'EMPTY', 'message' => '没有识别出食物，请换个说法或手动录入']]];
    }
    return [200, ['items' => $items, 'model' => (string) ($decoded['model'] ?? $config['model'])]];
}

function handle_parse(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        send_json(405, ['error' => ['code' => 'METHOD', 'message' => '只支持 POST']]);
    }
    $config = ai_config();
    if ($config['api_key'] === '') {
        send_json(503, ['error' => [
            'code' => 'NOT_CONFIGURED',
            'message' => '未配置 AI 密钥：设置环境变量 AI_API_KEY，或在 api/config.php 里填 api_key。',
        ]]);
    }
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > MAX_BODY_BYTES) {
        send_json(413, ['error' => ['code' => 'TOO_LARGE', 'message' => '请求内容过大']]);
    }
    $payload = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        send_json(400, ['error' => ['code' => 'BAD_BODY', 'message' => '请求体必须是 JSON']]);
    }
    $text = trim((string) ($payload['text'] ?? ''));
    if (mb_strlen($text, 'UTF-8') < 2 || mb_strlen($text, 'UTF-8') > 500) {
        send_json(400, ['error' => ['code' => 'BAD_TEXT', 'message' => '请描述 2–500 字的饮食内容']]);
    }

    [$status, $result] = call_upstream($config, build_system_prompt(load_foods()), $text);
    send_json($status, $result);
}

// ---- 路由：直接访问 api/ai.php 或经 rewrite 到 /api/ai/parse|health 都能用 ----
$action = (string) ($_GET['action'] ?? '');
if ($action === '') {
    $path = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
    if (preg_match('#/api/ai/(health|parse)/?$#', $path, $m)) {
        $action = $m[1];
    }
}

if ($action === 'health') {
    $config = ai_config();
    send_json(200, [
        'configured' => $config['api_key'] !== '',
        'model' => $config['model'],
        'baseUrl' => $config['base_url'],
    ]);
}
if ($action === 'parse') {
    handle_parse();
}
send_json(404, ['error' => ['code' => 'NOT_FOUND', 'message' => '未知接口']]);
