# LeanMate 架构

## 分层

| 层 | 位置 | 职责 | 约束 |
|---|---|---|---|
| Presentation | `src/pages`, `src/components` | 展示、交互、表单状态 | 不写营养公式；汇总一律调用模块函数 |
| Application | `src/modules/*/*.service.ts`, `*.ts` | 业务动作（增删改、汇总、目标、模板、解析） | 纯函数为主：输入数据、输出新数据 |
| Domain | `src/modules/*/*.types.ts`, `calculator.ts` | 类型与计算规则 | 与 React 无关，可单测 |
| AI | `server/ai-middleware.mjs` + `src/modules/ai` | 自然语言 → 结构化食物草稿 | 密钥只在服务端；输出必过结构校验 |
| Configuration | `src/data/*.json` | 食物库、规则、默认模板、语料 | 改数据不改代码 |
| Data | `src/storage` | StorageAdapter、LocalStorage、校验与迁移 | 页面不直接碰 localStorage |
| State | `src/app/store.tsx` | 一次加载、变更统一保存、保存失败可见 | 所有写入走 action |

## 数据流

```
页面事件 → store action → 模块函数（校验/计算）→ 新 AppData → storage.save → 重渲染
AI：输入 → /api/ai/parse（服务端调模型 + 结构校验）→ 客户端二次校验 → 可编辑草稿 → 用户确认 → store 写记录
```

日期统一用本地 `YYYY-MM-DD`；选中日期放在 URL `?date=`，刷新/分享都保留，默认今天。

## 关键设计

- **营养快照**：`FoodRecord.nutritionSnapshot` 添加时固定；改克数按原快照比例缩放，不重读食物库。
- **统一计算**：`nutrition.calculator` 是唯一换算入口；首页、饮食页、模板汇总都调用它。
- **AI 数据来源优先级**：命中食物库 → `source: "database"`（数值用库里）；未命中 → `model-estimate`（用模型 per100g，标「模型估算」+ confidence + 依据）；离线 → `local-match`（只匹配库内食物，不猜）。草稿只有点「确认并保存」才写记录。
- **目标版本**：每次重算追加 `NutritionGoal`，`effectiveFrom` + `createdAt` 决定生效版本，历史永久保留；记录体重只更新 `profile.currentWeightKg`，不触发重算。
- **模板**：`AppData.mealTemplates`（schema v2 新增）。写入时逐条转成正式记录，缺失食物单独计数并提示。
- **每日任务**：按日期生成，昨天完成状态不影响今天；回看历史会为该日补生成。
- **导入**：`validateAppData` 逐字段校验 → 覆盖前弹窗说明要覆盖多少条 → 失败不改动现有数据。
- **存储异常**：LocalStorage 不可用退化为内存并顶部常驻提示；写入超限/失败提示用户导出备份。

## 存储迁移

`schemaVersion` 当前 2。`migrate()` 是唯一升级入口：v1 无 `mealTemplates` 时补默认模板；显式空数组保留（用户删空不复活）；版本高于应用直接拒绝导入。

## 未来后端 / OpenClaw

业务是纯函数、存储在接口后：新增 `ApiStorageAdapter` 即可换存储；AI 代理已经是服务端逻辑，迁到真实后端只需平移 `server/ai-middleware.mjs`。前端不放密钥，LocalStorage 不能作为微信侧共享数据源。
