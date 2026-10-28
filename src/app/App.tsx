import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { DietPage } from "../pages/DietPage";
import { OnboardingPage } from "../pages/OnboardingPage";
import { PlanPage } from "../pages/PlanPage";
import { StoreProvider } from "./store";

// 只有「我的」用 Recharts，按需加载，省掉首屏 400 kB 图表库
const ProfilePage = lazy(() => import("../pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));

// 部署在 GitHub Pages 子路径时，路由前缀必须跟 base 一致
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export function App() {
  return (
    <StoreProvider>
      <BrowserRouter basename={BASENAME}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/diet" element={<DietPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route
              path="/profile"
              element={
                <Suspense fallback={null}>
                  <ProfilePage />
                </Suspense>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
