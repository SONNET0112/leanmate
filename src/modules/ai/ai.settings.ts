/**
 * AI 配置：密钥永远不写进 localStorage。
 * - 云端模式：登录后把密钥交给 Supabase Edge Function，存在只有服务端能读的表里
 * - 本机模式：没有 Supabase 时，密钥只留在内存（刷新即失效），随请求发给本地 Vite 中间件
 */
export type AiMode = "cloud" | "session" | "env";

export interface AiMeta {
  mode: AiMode;
  baseUrl: string;
  model: string;
}

const META_KEY = "leanmate.ai.meta";

let sessionKey: { apiKey: string; baseUrl: string; model: string } | null = null;

export function readMeta(): AiMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiMeta;
    return parsed?.model ? parsed : null;
  } catch {
    return null;
  }
}

export function writeMeta(meta: AiMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* 忽略：只是展示用元信息 */
  }
}

export function clearMeta(): void {
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    /* 忽略 */
  }
}

export function setSessionKey(cfg: { apiKey: string; baseUrl: string; model: string } | null): void {
  sessionKey = cfg;
}

export function getSessionKey(): { apiKey: string; baseUrl: string; model: string } | null {
  return sessionKey;
}

/** 本机模式下把密钥放在请求头里，仅发给 localhost 的 Vite 中间件，不落盘。 */
export function aiRequestHeaders(): Record<string, string> {
  if (!sessionKey) return {};
  return {
    "x-ai-key": sessionKey.apiKey,
    "x-ai-base": sessionKey.baseUrl,
    "x-ai-model": sessionKey.model,
  };
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
