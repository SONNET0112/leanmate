# LeanMate 交接说明（给接手的 AI / 开发者）

## 一句话
个人减脂与饮食管理的 Web App：饮食记录（含 AI 一句话识别）、营养计算、目标版本管理、餐食模板、体重追踪、每日任务、本地数据导入导出。React SPA + 可选 Supabase（登录/云同步）+ 可选 AI 代理。

## 技术栈与规模
- React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + React Router 7 + Recharts + Lucide
- 测试：Vitest（87 条单测）+ Playwright（e2e，含 5 视口响应式矩阵）
- 无后端框架；数据默认在 `localStorage`（key: `leanmate.data`，`schemaVersion: 2`）

## 命令
```bash
npm install
npm run dev            # 5173（dev 自带 /api/ai/* 代理，见 server/ai-middleware.mjs）
npm test               # vitest
npm run test:e2e       # playwright（首次 npx playwright install chromium）
npm run build          # tsc -b && vite build（base 由 GH_PAGES_BASE 控制，默认 /leanmate/）
npm run build:deploy   # 生成 deploy/ 静态+PHP 部署包（base 默认 /）
```

## 环境变量（只在本机 .env.local，勿提交）
- `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` / `AI_TIMEOUT_MS`：AI 代理用，只在 Node 进程读
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`：前端构建期注入，仅 anon key（公开，靠 RLS）
- 本机也支持复用 `TOKENRIVER_API_KEY`

## 目录地图
```
src/app/            路由(App.tsx)、全局 Store(store.tsx，唯一写入口)
src/pages/          Onboarding / Dashboard / Diet / Plan / Profile
src/components/     layout(侧栏/底栏) dashboard diet(AI 面板/搜索/餐次) plan(模板编辑) auth settings common
src/modules/
  nutrition/        换算唯一入口 calculateFoodNutrition、食物库检索 foods.json(43 条)
  records/          饮食记录增删改 + 日/餐汇总（营养快照不可被库变更改写）
  plan/             目标计算 plan.service.ts、规则 diet-rules.json、模板 templates.ts
  tracking/         体重：同日覆盖、编辑、7 日均值、趋势序列
  tasks/            每日任务按日期隔离
  motivation/       本地语料 + 按日期取种
  ai/               ai.client(校验/补齐营养)、local-parser(离线匹配)、ai.settings(模式与密钥)
  cloud/            Supabase 客户端与同步（未配置时自动退化为纯本地）
src/storage/        StorageAdapter、LocalStorage 适配器、schema 校验与迁移
src/data/           foods.json / diet-rules.json / meal-templates.json / motivational-quotes.json
server/ai-middleware.mjs   dev/preview 用 AI 代理（服务端持密钥）
deploy/                   静态站点 + api/ai.php（PHP 版 AI 代理）+ .htaccess/nginx 配置
supabase/                 数据库迁移与 Edge Function（云同步/云端 AI）
tests/e2e/                真实浏览器流程测试
docs/ARCHITECTURE.md, docs/DATA-SOURCES.md
```

## 不可破坏的约束（改之前先读）
1. **营养快照**：`FoodRecord.nutritionSnapshot` 添加时冻结；改克数只按原快照比例缩放，不重读食物库。
2. **目标版本**：每次重算追加 `NutritionGoal`，用 `effectiveFrom` + `createdAt` 选生效版；历史永不覆盖。记体重**不得**自动重算目标。
3. **导入安全**：`validateAppData` 逐字段校验 → 覆盖前弹窗列明条数 → 失败不动现有数据。
4. **AI 输出不可信**：服务端裁剪 + 客户端再校验；命中食物库才用库数值，否则标「模型估算」+置信度；必须用户确认才落库。
5. **密钥**：绝不进前端包、查询参数或 Git。
6. **base 不能是相对路径**：`App.tsx` 用 `import.meta.env.BASE_URL` 推 `basename`，`"./"` 会让路由全不匹配（白屏）。

## 当前状态与未完成项
- 已实现并测试：见功能清单与 `docs/*.md`；`npm test` 87 通过。
- **减脂规则里的视频系数仍是 `pending`**（`src/data/diet-rules.json` 的 `videoDerivedCoefficients`），目标用 Mifflin-St Jeor + 活动系数 + 450 kcal 缺口，属估算，不要当成已验证的医学结论。
- 食物营养值全部标 `estimated`（公开成分表量级，未逐条核对），升级为 `verified` 需逐条查 USDA FDC / 中国食物成分表。
- AI 是一次性解析，不做多轮追问；复合菜份量误差可达 ±30%。
- 云同步依赖 Supabase（见 `supabase/`），在自有服务器上只保证「本地模式」+ PHP AI 代理可用。
- 打包体积约 765 kB（Recharts 占大头，ProfilePage 已按需加载）。

## 部署（自有服务器）
`npm run build:deploy` → 上传 `deploy/`：Apache 用 `.htaccess`，Nginx 用 `nginx.conf.example`；AI 需 PHP 7.4+（curl/mbstring）并配 `AI_API_KEY`。详见 `deploy/README.md`。
