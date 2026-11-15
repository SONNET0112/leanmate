# LeanMate 部署包（自有服务器版）

**不需要把项目重写成 PHP**：LeanMate 前端本来就是 HTML + JS 构建产物，直接静态托管即可；
`api/ai.php` 只承担一件事——把 AI 密钥留在服务器上并代理一次模型调用。

- 纯静态：`index.html` + `assets/`（无 Node、无数据库）
- AI（可选）：`api/ai.php` + `api/foods.json`（PHP 7.4+，需 curl / mbstring / json 扩展）
- 数据：浏览器 localStorage；登录 Supabase 后才会云同步（不登录也能用）

```
deploy/
├── index.html          # 构建产物
├── assets/*.js|css     # 构建产物
├── api/ai.php          # 可选：AI 一句话识别代理（PHP）
├── api/foods.json      # 食物库，供 ai.php 拼提示词
├── .htaccess           # Apache 用
├── nginx.conf.example  # Nginx 用
└── router.php          # 仅本地 php -S 验证用，线上不需要
```

## 一、只要静态页面（不要 AI）

把 `index.html`、`assets/` 上传到站点目录即可。所有数据存浏览器 localStorage，没有后端。

- Apache：需要 `.htaccess` 里的重写规则（否则刷新 `/diet` 会 404）
- Nginx：用 `try_files $uri $uri/ /index.html;`
- 不支持重写的托管：把路由改成 hash 模式（`HashRouter`）即可，`#/diet` 刷新不 404

> 路径必须是**构建时确定的**：默认按域名根目录构建（`base = "/"`）。
> 放到 `https://site.com/leanmate/` 这种子目录时，要用 `GH_PAGES_BASE=/leanmate/ npm run build:deploy` 重新构建，
> 否则路由 basename 和静态资源路径都会对不上（试过相对 base "./"，会让 `basename` 变成 "/." 导致白屏）。

**没有 PHP 时 AI 面板会显示「未配置」**，仍可用「离线匹配」和搜索框手动记录。

## 二、要 AI 识别（推荐）

1. 上传整个目录，包括 `api/`。
2. 配密钥，二选一：
   - 环境变量（推荐）：在 PHP-FPM 池里加 `env[AI_API_KEY] = sk-...`，然后重启 php-fpm；
   - 或者新建 `api/config.php`（已在 `.htaccess` / nginx 里禁止外部访问）：
     ```php
     <?php return ['api_key' => 'sk-...', 'base_url' => 'https://api.tokenriver.cn/v1', 'model' => 'deepseek-flash'];
     ```
     同时给这个文件 `chmod 600`。
3. 需要 PHP 7.4+ 且启用 `curl`、`mbstring`、`json` 扩展。
4. 验证：`curl https://your-domain.com/api/ai/health` 应返回
   `{"configured":true,"model":"deepseek-flash","baseUrl":"..."}`

可选环境变量：`AI_BASE_URL`、`AI_MODEL`、`AI_TIMEOUT_MS`（默认 45000）。

## 三、数据说明

- 数据在**每个浏览器**的 localStorage，不跨设备、不跨用户。换设备要「我的 → 导出」JSON 再导入。
- 部署到子目录（如 `https://site.com/leanmate/`）也能用：前端请求的是相对路径 `api/ai/*`。
- 升级版本会保留 schema v1 数据（自动迁移到 v2 并补默认模板）。

## 四、本地先验

```bash
php -S 127.0.0.1:8081 -t deploy deploy/router.php
# 打开 http://127.0.0.1:8081
```
