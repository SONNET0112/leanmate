import { useState } from "react";
import { CloudOff, Loader2, LogOut, UserRound } from "lucide-react";
import { useAuth } from "../../modules/auth/AuthProvider";
import { useStore } from "../../app/store";
import { AuthDialog } from "./AuthDialog";

/** 账号入口：未登录时只显示一个按钮，已登录时显示邮箱 + 同步状态 + 退出。 */
export function AccountCard({ compact = false }: { compact?: boolean }) {
  const { status, user, signOut, busy } = useAuth();
  const { syncState, syncError, retrySync } = useStore();
  const [open, setOpen] = useState(false);

  if (status === "unconfigured") {
    return compact ? null : (
      <section className="card p-5">
        <h2 className="text-[15px] font-medium">账号</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          云端同步还没启用（缺少 Supabase 配置）。当前数据只保存在这台设备的浏览器里，功能不受影响。
        </p>
      </section>
    );
  }

  const syncLabel =
    syncState === "syncing" ? "同步中…" : syncState === "error" ? "同步失败" : syncState === "synced" ? "已同步到云端" : "本机模式";

  const body = (
    <>
      {!compact ? <h2 className="text-[15px] font-medium">账号</h2> : null}
      {user ? (
        <div className={compact ? "" : "mt-3"}>
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-deep">
              <UserRound size={15} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{user.email}</span>
              <span className={`block text-[11px] ${syncState === "error" ? "text-danger" : "text-muted"}`}>{syncLabel}</span>
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={busy}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] text-muted hover:text-ink"
            >
              <LogOut size={12} /> 退出
            </button>
          </div>
          {syncError ? (
            <p className="mt-2 rounded-xl border border-[#eed6d3] bg-[#fdf4f3] px-3 py-2 text-[11px] leading-relaxed text-danger">
              {syncError}
              <button type="button" onClick={retrySync} className="ml-2 underline">
                重试同步
              </button>
            </p>
          ) : null}
        </div>
      ) : (
        <div className={compact ? "" : "mt-3"}>
          <p className="text-[12px] leading-relaxed text-muted">登录后数据存到云端，换设备、清缓存都不会丢。</p>
          <button type="button" onClick={() => setOpen(true)} className="btn btn-primary mt-2 w-full text-[13px]">
            {status === "loading" ? <Loader2 size={14} className="animate-spin" /> : <CloudOff size={14} />} 登录 / 注册
          </button>
        </div>
      )}
      <AuthDialog open={open} onClose={() => setOpen(false)} />
    </>
  );

  return compact ? (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3">{body}</div>
  ) : (
    <section className="card p-5">{body}</section>
  );
}
