import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../cloud/supabase";

export type AuthStatus = "unconfigured" | "loading" | "anon" | "authed";

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  error: string | null;
  busy: boolean;
  signIn(email: string, password: string): Promise<boolean>;
  signUp(email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;
  clearError(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

function friendly(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) return "邮箱或密码不正确";
  if (text.includes("email not confirmed")) return "邮箱还没验证：请先点邮件里的确认链接";
  if (text.includes("user already registered")) return "这个邮箱已注册，直接登录即可";
  if (text.includes("password should be at least")) return "密码太短，至少 6 位";
  if (text.includes("rate limit")) return "请求太频繁，稍后再试";
  if (text.includes("failed to fetch") || text.includes("network")) return "网络异常，检查网络后重试";
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(supabaseConfigured ? "loading" : "unconfigured");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
      setStatus(data.session?.user ? "authed" : "anon");
    });
    // 会话恢复、token 刷新、退出都从这里统一更新，避免页面各自判断导致反复跳转
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session?.user ? "authed" : "anon");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return false;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError(friendly(err.message));
      return false;
    }
    return true;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return false;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) {
      setError(friendly(err.message));
      return false;
    }
    // 开启了邮箱验证时不会有 session，需要用户点邮件确认
    if (!data.session) {
      setError("注册成功，请到邮箱点确认链接后再登录");
      return false;
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    // 只结束会话，不碰云端数据
    await supabase.auth.signOut();
    setBusy(false);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, user, error, busy, signIn, signUp, signOut, clearError: () => setError(null) }),
    [status, user, error, busy, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return value;
}
