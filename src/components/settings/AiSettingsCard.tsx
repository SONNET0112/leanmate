import { useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { useAiSettings } from "../../modules/ai/AiSettingsProvider";

export function AiSettingsCard() {
  const { status, model, mode, openDialog, clear, cloud } = useAiSettings();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium">AI 识别</h2>
        <span className={`text-[11px] ${status === "ready" ? "text-primary" : "text-muted"}`}>
          {status === "loading" ? "检测中…" : status === "ready" ? `已配置 · ${model}` : "未配置"}
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        {cloud
          ? "密钥由服务端函数保存，前端只记录模型名，刷新和换设备都不用重填。"
          : "当前为未登录/未接入 Supabase 的本机模式：密钥只保留在本次会话内，刷新后需重新填写。"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={openDialog} className="btn btn-ghost text-[13px]">
          <KeyRound size={14} /> {status === "ready" ? "修改配置" : "配置 AI"}
        </button>
        {status === "ready" ? (
          <button
            type="button"
            onClick={async () => {
              await clear();
              setMessage("已删除 AI 配置");
            }}
            className="btn btn-ghost text-[13px] text-danger"
          >
            <Trash2 size={14} /> 删除配置
          </button>
        ) : null}
        {mode === "env" ? <span className="self-center text-[11px] text-muted">当前使用 .env 里的密钥</span> : null}
      </div>
      {message ? <p className="mt-2 text-[11px] text-muted">{message}</p> : null}
    </section>
  );
}
