import { useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";

export interface AiConfigInput {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export function AiConfigDialog({
  open,
  cloud,
  initial,
  onClose,
  onSave,
  onTest,
}: {
  open: boolean;
  /** 云端模式：密钥交给服务端保存；本机模式：只留在当前会话 */
  cloud: boolean;
  initial: { baseUrl: string; model: string };
  onClose: () => void;
  onSave: (input: AiConfigInput) => Promise<string | null>;
  onTest: (input: AiConfigInput) => Promise<string | null>;
}) {
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!open) return null;

  const read = (): AiConfigInput => ({ baseUrl: baseUrl.trim(), model: model.trim(), apiKey: apiKey.trim() });

  const run = async (kind: "save" | "test") => {
    setError(null);
    setOk(null);
    const input = read();
    if (!input.baseUrl || !input.model) {
      setError("接口地址和模型名都要填");
      return;
    }
    if (!input.apiKey) {
      setError("请填写 API Key");
      return;
    }
    setBusy(kind);
    const problem = kind === "save" ? await onSave(input) : await onTest(input);
    setBusy(null);
    if (problem) setError(problem);
    else if (kind === "save") setOk("已保存");
    else setOk("连接成功");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#1f2723]/35 p-4" role="dialog" aria-modal="true" aria-labelledby="ai-config-title">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-[0_24px_60px_-30px_rgba(31,39,35,0.6)]">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="ai-config-title" className="text-[16px] font-medium">配置 AI 识别</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              只有使用 AI 功能时需要。不吃 AI 也能正常记录饮食、体重和模板。
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg p-1 text-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="label">接口地址</span>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="field" placeholder="https://api.deepseek.com" aria-label="AI 接口地址" />
          </label>
          <label className="block">
            <span className="label">模型</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} className="field" placeholder="deepseek-flash" aria-label="AI 模型" />
          </label>
          <label className="block">
            <span className="label">API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="field"
              placeholder="sk-..."
              autoComplete="off"
              aria-label="AI API Key"
            />
          </label>
          <p className="rounded-xl bg-[#fafbf6] px-3 py-2 text-[11px] leading-relaxed text-muted">
            {cloud
              ? "密钥会由服务端函数保存，浏览器里只留模型名，不会写进 localStorage。"
              : "当前没有登录（或未配置 Supabase），密钥只保留在这次会话里，刷新页面需要重新填写。"}
          </p>
        </div>

        {error ? (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-danger" role="alert">
            <AlertCircle size={13} /> {error}
          </p>
        ) : null}
        {ok ? <p className="mt-3 text-[12px] text-primary" role="status">{ok}</p> : null}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => run("test")} disabled={busy !== null} className="btn btn-ghost flex-1 text-[13px]">
            {busy === "test" ? <Loader2 size={14} className="animate-spin" /> : null} 测试连接
          </button>
          <button type="button" onClick={() => run("save")} disabled={busy !== null} className="btn btn-primary flex-1 text-[13px]">
            {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : null} 保存
          </button>
        </div>
      </div>
    </div>
  );
}
