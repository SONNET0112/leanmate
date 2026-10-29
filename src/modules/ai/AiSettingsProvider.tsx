import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase, supabaseConfigured } from "../cloud/supabase";
import { useAuth } from "../auth/AuthProvider";
import { AiConfigDialog, type AiConfigInput } from "../../components/settings/AiConfigDialog";
import { clearMeta, readMeta, setSessionKey, writeMeta, type AiMode } from "./ai.settings";
import { parseMealWithAi, toDraftItems } from "./ai.client";
import type { AiError, DraftFoodItem } from "./ai.types";

type AiStatus = "loading" | "ready" | "missing";

interface AiSettingsValue {
  status: AiStatus;
  model: string | null;
  mode: AiMode | "none";
  cloud: boolean;
  dialogOpen: boolean;
  openDialog(): void;
  closeDialog(): void;
  /** AI 功能入口统一用它：没配置就弹窗并返回 false，不阻塞其它功能 */
  ensure(): boolean;
  /** AI 识别统一入口：云端调 Edge Function，本机调 Vite 中间件 */
  parse(text: string): Promise<DraftFoodItem[]>;
  save(input: AiConfigInput): Promise<string | null>;
  test(input: AiConfigInput): Promise<string | null>;
  clear(): Promise<void>;
  refresh(): Promise<void>;
}

const DEFAULTS = { baseUrl: "https://api.deepseek.com", model: "deepseek-flash" };
const AiContext = createContext<AiSettingsValue | null>(null);

async function callFunction(action: string, payload: Record<string, unknown> = {}) {
  if (!supabase) throw new Error("未配置 Supabase");
  const { data, error } = await supabase.functions.invoke("ai-proxy", { body: { action, ...payload } });
  if (error) {
    const detail = (data as { error?: string } | null)?.error;
    throw new Error(detail || error.message || "服务端函数调用失败");
  }
  return data as Record<string, unknown>;
}

export function AiSettingsProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const cloud = supabaseConfigured && authStatus === "authed";

  const [status, setStatus] = useState<AiStatus>("loading");
  const [model, setModel] = useState<string | null>(null);
  const [mode, setMode] = useState<AiMode | "none">("none");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initial, setInitial] = useState(DEFAULTS);
  const statusRef = useRef<AiStatus>("loading");
  statusRef.current = status;

  const refresh = useCallback(async () => {
    setStatus("loading");
    const meta = readMeta();
    if (cloud) {
      try {
        const data = await callFunction("status");
        if (data.configured) {
          setStatus("ready");
          setModel(String(data.model ?? meta?.model ?? ""));
          setMode("cloud");
          return;
        }
      } catch {
        /* 云端不可用时按未配置处理，不阻塞页面 */
      }
      setStatus("missing");
      setMode("none");
      return;
    }
    // 本机模式：先看会话内填过的密钥，再看 .env 里的中间件配置
    if (meta?.mode === "session" && meta.model) {
      setStatus("ready");
      setModel(meta.model);
      setMode("session");
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ai/health`);
      const data = res.ok ? ((await res.json()) as { configured?: boolean; model?: string }) : null;
      if (data?.configured) {
        setStatus("ready");
        setModel(data.model ?? null);
        setMode("env");
        return;
      }
    } catch {
      /* 静态托管没有后端，按未配置处理 */
    }
    setStatus("missing");
    setMode("none");
  }, [cloud]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const parse = useCallback(
    async (text: string): Promise<DraftFoodItem[]> => {
      if (!cloud) return parseMealWithAi(text);
      const data = await callFunction("parse", { text });
      const items = toDraftItems(data);
      if (!items.length) throw { code: "EMPTY", message: "没有识别出食物，请换个说法或手动添加" } as AiError;
      return items;
    },
    [cloud],
  );

  const openDialog = useCallback(() => {
    const meta = readMeta();
    setInitial({ baseUrl: meta?.baseUrl || DEFAULTS.baseUrl, model: meta?.model || DEFAULTS.model });
    setDialogOpen(true);
  }, []);

  const ensure = useCallback(() => {
    if (statusRef.current === "ready") return true;
    openDialog();
    return false;
  }, [openDialog]);

  const save = useCallback(
    async (input: AiConfigInput): Promise<string | null> => {
      if (cloud) {
        try {
          await callFunction("save", { ...input });
          await refresh();
          setDialogOpen(false);
          return null;
        } catch (error) {
          return (error as Error).message;
        }
      }
      setSessionKey(input);
      writeMeta({ mode: "session", baseUrl: input.baseUrl, model: input.model });
      setSessionKey(input);
      await refresh();
      setDialogOpen(false);
      return null;
    },
    [cloud, refresh],
  );

  const test = useCallback(
    async (input: AiConfigInput): Promise<string | null> => {
      if (cloud) {
        try {
          await callFunction("test", { ...input });
          return null;
        } catch (error) {
          return (error as Error).message;
        }
      }
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/ai/parse`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ai-key": input.apiKey,
            "x-ai-base": input.baseUrl,
            "x-ai-model": input.model,
          },
          body: JSON.stringify({ text: "鸡蛋" }),
        });
        if (res.ok) return null;
        const body = await res.json().catch(() => null);
        return body?.error?.message ?? `请求失败（${res.status}）`;
      } catch {
        return "无法连接本地 AI 代理：请确认用 npm run dev / preview 启动";
      }
    },
    [cloud],
  );

  const clear = useCallback(async () => {
    if (cloud) {
      try {
        await callFunction("clear");
      } catch {
        /* 删除失败也要清掉本地元信息，避免 UI 假装已配置 */
      }
    }
    setSessionKey(null);
    clearMeta();
    setStatus("missing");
    setModel(null);
    setMode("none");
  }, [cloud]);

  const value = useMemo<AiSettingsValue>(
    () => ({
      status,
      model,
      mode,
      cloud,
      dialogOpen,
      openDialog,
      closeDialog: () => setDialogOpen(false),
      ensure,
      parse,
      save,
      test,
      clear,
      refresh,
    }),
    [status, model, mode, cloud, dialogOpen, openDialog, ensure, parse, save, test, clear, refresh],
  );

  return (
    <AiContext.Provider value={value}>
      {children}
      <AiConfigDialog
        open={dialogOpen}
        cloud={cloud}
        initial={initial}
        onClose={() => setDialogOpen(false)}
        onSave={save}
        onTest={test}
      />
    </AiContext.Provider>
  );
}

export function useAiSettings(): AiSettingsValue {
  const value = useContext(AiContext);
  if (!value) throw new Error("useAiSettings 必须在 AiSettingsProvider 内使用");
  return value;
}
