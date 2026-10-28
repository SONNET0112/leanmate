import { Navigate, Outlet } from "react-router-dom";
import { useStore } from "../../app/store";
import { BottomNavigation, SideNavigation } from "./Navigation";

export function AppLayout() {
  const { data, storageError } = useStore();

  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted" role="status">
        正在读取本地数据…
      </div>
    );
  }
  if (!data.profile) return <Navigate to="/onboarding" replace />;

  return (
    <div className="relative min-h-screen bg-canvas">
      {/* 参考图同款：奶油底 + 两侧食物静物，只在大屏出现，卡片本身不透出背景 */}
      <div aria-hidden className="pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-[320px] xl:block">
        <div
          className="size-full bg-[length:100%_auto] bg-left-bottom bg-no-repeat opacity-95 [-webkit-mask-image:linear-gradient(to_right,black_38%,transparent_94%)] [mask-image:linear-gradient(to_right,black_38%,transparent_94%)]"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}bg-left.jpg)` }}
        />
      </div>
      <div aria-hidden className="pointer-events-none fixed inset-y-0 right-0 z-0 hidden w-[320px] xl:block">
        <div
          className="size-full bg-[length:100%_auto] bg-right-bottom bg-no-repeat opacity-95 [-webkit-mask-image:linear-gradient(to_left,black_38%,transparent_94%)] [mask-image:linear-gradient(to_left,black_38%,transparent_94%)]"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}bg-right.jpg)` }}
        />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-[1180px] px-4 md:px-6 lg:gap-2">
        <SideNavigation />
        <div className="min-w-0 flex-1 pb-28 pt-5 lg:pb-12 lg:pt-7">
          {storageError ? (
            <p
              role="alert"
              className="mb-3 rounded-2xl border border-[#eed6d3] bg-[#fdf4f3] px-4 py-2.5 text-[13px] text-danger"
            >
              {storageError}
            </p>
          ) : null}
          <main>
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
}
