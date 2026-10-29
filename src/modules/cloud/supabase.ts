import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 只有 VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY 都在时才创建客户端。
 * anon key 是公开信息，真正的权限由数据库 RLS 控制；service_role 绝不能进前端。
 */
const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
