# LeanMate

个人减脂与饮食管理 Web App：饮食记录（含 AI 一句话识别）、营养计算、目标管理、餐食模板、体重追踪、每日任务与数据导入导出。

V1.01：在 V1.0 基础上补齐历史日期记录、AI 识别链路、模板管理、体重编辑、桌面侧边导航与 320px 起的响应式适配。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173，同时挂载 /api/ai/* 本地 AI 代理
npm run build      # 生产构建（tsc -b + vite build）
npm run preview    # 预览构建产物（同样带 AI 代理）
npm test           # 业务逻辑单元测试（vitest，77 条）
npm run test:e2e   # 浏览器流程测试（playwright，13 条，含 5 种视口；首次需 npx playwright install chromium）
```

## AI 识别怎么配

前端只请求同源的 `/api/ai/parse`，密钥由 Vite 中间件（`server/ai-middleware.mjs`）在进程环境里读取，不会进打包产物：

```bash
export AI_API_KEY=sk-...          # 或者复用已有的 TOKENRIVER_API_KEY
export AI_BASE_URL=https://api.tokenriver.cn/v1   # 任意 OpenAI 兼容接口
export AI_MODEL=deepseek-flash
```

Windows 下可写进系统环境变量，或用 `.env.local` 后自行 `set`。**没配也能用**：AI 面板会显示「未配置」提示，仍可用「离线匹配」和搜索框手动记录。

`GET /api/ai/health` 返回 `{configured, model}`；`POST /api/ai/parse` 接收 `{text}`。

## 目录

```
server/ai-middleware.mjs   AI 代理：拼提示词、调上游、校验与裁剪模型输出
src/
  app/         路由与全局状态（StoreProvider）
  hooks/       useSelectedDate（?date= 日期状态）
  pages/       初始化 / 首页 / 饮食 / 计划 / 我的
  components/  layout、dashboard、diet（AI 面板、搜索、餐次列表）、plan（模板编辑）、common（日期切换）
  modules/     nutrition / records / plan / tracking / tasks / motivation / ai，每个都有测试
  data/        食物库、计算规则、默认模板、鼓励语料
  storage/     存储接口、LocalStorage 适配器、校验与迁移（schema v2）
docs/           ARCHITECTURE.md、DATA-SOURCES.md
tests/e2e/      真实浏览器流程测试（含响应式矩阵）
```

## 使用

1. 首次打开进入初始化，生成营养目标。
2. 首页可用日期切换回看历史；摄入/剩余/宏量营养素与饮食页同源。
3. 饮食页支持三种录入：AI 一句话识别（可逐条改名/改克数/改餐次/改生熟状态后确认）、离线匹配、搜索框手动添加；餐次内可改克数、删除。
4. 计划页可新建/编辑/删除模板，并按日期+餐次写入正式记录。
5. 我的页可改资料、按日期补录或编辑体重、导出/导入/清空本地数据。

## 已知限制

- 数据只在本浏览器本地，不会跨设备同步；「导入」是覆盖式，弹窗会写明将被覆盖的条数。
- 食物营养值为公开成分表量级参考值，全部标记 `estimated`，未逐条联网复核（见 `docs/DATA-SOURCES.md`）。
- 参考视频里的运动时长-宏量营养素系数仍未核实，配置里标 `pending`、未采用；目标计算用 Mifflin-St Jeor + 活动系数 + 450 kcal 缺口，属估算。
- AI 识别依赖外部模型：份量估算有不确定性（界面标 confidence 与依据），库外食物按模型估算并标「模型估算」，不能当作营养数据库。
- AI 代理只在 `vite dev` / `vite preview` 里生效；纯静态托管时 `/api/ai/*` 需要自行部署等价服务。
- 未实现后端、登录、跨设备同步、微信 / OpenClaw 接入。
