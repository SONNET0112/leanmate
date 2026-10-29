-- LeanMate 云端存储：整份 AppData 存一份 JSONB 快照，字段结构与前端 storage.interface.ts 一致
-- 在 Supabase Dashboard → SQL Editor 里执行，或 supabase db push

create table if not exists public.leanmate_state (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  migrated_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.leanmate_state is '每个账号一份 LeanMate 数据快照（饮食/体重/目标/模板/任务）';

alter table public.leanmate_state enable row level security;

-- 只允许本人读写自己的那一条；前端过滤不可信，权限在这里兜底
drop policy if exists "leanmate_state_select_own" on public.leanmate_state;
create policy "leanmate_state_select_own" on public.leanmate_state
  for select using (auth.uid() = id);

drop policy if exists "leanmate_state_insert_own" on public.leanmate_state;
create policy "leanmate_state_insert_own" on public.leanmate_state
  for insert with check (auth.uid() = id);

drop policy if exists "leanmate_state_update_own" on public.leanmate_state;
create policy "leanmate_state_update_own" on public.leanmate_state
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "leanmate_state_delete_own" on public.leanmate_state;
create policy "leanmate_state_delete_own" on public.leanmate_state
  for delete using (auth.uid() = id);

-- 用户自己的 AI 配置：只有服务端（service_role / Edge Function）能读写，前端拿不到 key
create table if not exists public.user_ai_config (
  user_id uuid primary key references auth.users (id) on delete cascade,
  base_url text not null,
  model text not null,
  api_key text not null,
  updated_at timestamptz not null default now()
);

comment on table public.user_ai_config is '用户自带的 AI 密钥，仅 Edge Function 以 service_role 访问，不开放给浏览器';

alter table public.user_ai_config enable row level security;
-- 故意不建任何策略：anon/authenticated 都被 RLS 拦住，只有 service_role 能读写
