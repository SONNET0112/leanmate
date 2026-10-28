import { ChartPie, Leaf, Target, UserRound, UtensilsCrossed } from "lucide-react";
import { NavLink } from "react-router-dom";

export const navItems = [
  { to: "/", label: "首页", hint: "今日总览", Icon: ChartPie },
  { to: "/diet", label: "饮食", hint: "记录与 AI 识别", Icon: UtensilsCrossed },
  { to: "/plan", label: "计划", hint: "目标与模板", Icon: Target },
  { to: "/profile", label: "我的", hint: "资料与数据", Icon: UserRound },
];

export function BottomNavigation() {
  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line/80 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-2">
        {navItems.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `my-1.5 flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] transition-colors ${
                  isActive ? "bg-primary-soft font-medium text-primary-deep" : "text-muted active:bg-[#f3f6ee]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={21} strokeWidth={isActive ? 2.1 : 1.7} aria-hidden />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SideNavigation() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col py-7 pr-6 lg:flex">
      <div className="flex items-center gap-2.5 px-3">
        <span className="grid size-9 place-items-center rounded-2xl bg-primary-deep text-white shadow-sm">
          <Leaf size={18} strokeWidth={2} aria-hidden />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[17px] font-semibold tracking-tight text-primary-deep">LeanMate</span>
          <span className="text-[10.5px] tracking-[0.06em] text-muted">Better Food · Healthier You</span>
        </span>
      </div>

      <nav aria-label="主导航" className="mt-8">
        <ul className="space-y-1.5">
          {navItems.map(({ to, label, hint, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                    isActive
                      ? "bg-surface text-primary-deep shadow-[0_1px_2px_rgba(31,39,35,0.05),0_12px_26px_-20px_rgba(31,39,35,0.5)]"
                      : "text-muted hover:bg-primary-soft/60 hover:text-ink"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`grid size-8 place-items-center rounded-xl ${isActive ? "bg-primary-soft" : ""}`}>
                      <Icon size={17} strokeWidth={isActive ? 2 : 1.7} aria-hidden />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[14px]">{label}</span>
                      <span className={`text-[10.5px] ${isActive ? "text-[#6c7f70]" : "text-muted"}`}>{hint}</span>
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto space-y-3">
        <div className="relative overflow-hidden rounded-3xl border border-[#dfe9d6] bg-gradient-to-br from-[#eaf2e2] to-[#f5f8ee] px-4 py-4">
          <p className="text-[12.5px] font-medium leading-relaxed text-primary-deep">
            今天也要加油呀！
            <br />
            健康的生活，从一餐一饭开始 🍃
          </p>
          <Leaf size={56} className="pointer-events-none absolute -bottom-4 -right-3 text-[#cfe0c2]" aria-hidden />
        </div>
        <p className="px-1 text-[11px] leading-relaxed text-muted">
          数据保存在本机浏览器，不会自动同步。定期在「我的 → 数据」导出备份。
        </p>
      </div>
    </aside>
  );
}
