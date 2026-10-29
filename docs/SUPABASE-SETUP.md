# Supabase 接入说明（需要你在后台操作）

代码已经写好并会在缺少配置时自动降级为「仅本机」模式；下面是把它真正跑起来需要的步骤。

## 1. 建项目

1. 打开 https://supabase.com/dashboard → New project（区域选 Singapore 或 Tokyo 更快）
2. Project Settings → API，复制：
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / publishable key** → `VITE_SUPABASE_ANON_KEY`
3. ⚠️ `service_role` key 只给 Edge Function 用，**不要**放进 `.env.local`、不要放进 GitHub Secrets 给前端构建用。

## 2. 建表 + RLS

Dashboard → SQL Editor，整段执行 `supabase/migrations/0001_leanmate_cloud.sql`。

执行后应该有：

| 表 | 用途 | RLS |
|---|---|---|
| `leanmate_state` | 每账号一份数据快照（jsonb） | 已开，4 条策略限制 `auth.uid() = id` |
| `user_ai_config` | 用户自带 AI 密钥 | 已开，**故意没有策略**，只有 service_role 能读写 |

## 3. 邮箱登录设置

Dashboard → Authentication → Providers → Email：

- 想跳过邮件验证：关闭 **Confirm email**（个人使用更快）
- 开着的话，注册后要去邮箱点确认链接才能登录

Authentication → URL Configuration：

- Site URL：`https://sonnet0112.github.io/leanmate/`
- Redirect URLs 追加：`https://sonnet0112.github.io/leanmate/**`、`http://localhost:5173/**`

## 4. 部署 AI 代理函数（可选，想用云端 AI 才需要）

```bash
npm i -g supabase
supabase login
supabase link --project-ref <你的 project ref>
supabase functions deploy ai-proxy
```

函数自动使用注入的 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`，不需要额外 secret。

## 5. 前端配置

本地：把上面两个值写进 `.env.local`（已在 .gitignore）

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

GitHub Pages：仓库 Settings → Secrets and variables → **Actions** → New repository secret，添加
`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`；然后在 `.github/workflows/deploy.yml` 的 build 步骤里加

```yaml
        env:
          GH_PAGES_BASE: /${{ github.event.repository.name }}/
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

（本次没有改 workflow，因为现在没有真实凭据，写进去也只会构建出空值。）

## 6. 数据是怎么同步的

- 登录后：云端有数据 → 以云端为准，本地先备份到 `leanmate.backup.<uid>`；云端没有 → 把本地数据推上去（首次迁移）
- 之后每次修改：先写 localStorage，800ms 合并后写云端；失败会在界面顶部和「我的 → 账号」提示，可点重试
- 退出登录：只结束会话，云端数据不动；本机缓存保留（个人设备不会丢数据），换账号登录会被云端数据覆盖
- 迁移标记：`leanmate.migrated.<uid>`，成功后才写

## 7. 已知限制

- 同步粒度是整份快照（最后写入者胜），多设备同时改同一条记录会互相覆盖，不做冲突合并
- 未登录时只能本机使用
