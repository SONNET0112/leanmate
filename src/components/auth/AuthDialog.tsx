import { useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { useAuth } from "../../modules/auth/AuthProvider";

export function AuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn, signUp, busy, error, clearError } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!open) return null;

  const submit = async () => {
    if (!email.trim() || !password) return;
    const ok = mode === "in" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    if (ok) {
      setPassword("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#1f2723]/35 p-4" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-5 shadow-[0_24px_60px_-30px_rgba(31,39,35,0.6)]">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="auth-title" className="text-[16px] font-medium">
              {mode === "in" ? "登录后云端同步" : "注册账号"}
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">登录只用于同步数据，不登录也能照常记录。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg p-1 text-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="label">邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError();
              }}
              className="field"
              placeholder="you@example.com"
              autoComplete="email"
              aria-label="邮箱"
            />
          </label>
          <label className="block">
            <span className="label">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              className="field"
              placeholder="至少 6 位"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              aria-label="密码"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-danger" role="alert">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
          </p>
        ) : null}

        <button type="button" onClick={submit} disabled={busy} className="btn btn-primary mt-4 w-full text-[13px]">
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {mode === "in" ? "登录" : "注册"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            clearError();
          }}
          className="mt-2 w-full text-[12px] text-primary hover:underline"
        >
          {mode === "in" ? "还没有账号？注册" : "已有账号？去登录"}
        </button>
      </div>
    </div>
  );
}
