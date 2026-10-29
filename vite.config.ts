import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createAiMiddleware } from "./server/ai-middleware.mjs";

/** GitHub Pages 是项目站点，路径要带仓库名；本地 dev 仍是根路径，测试脚本不受影响。 */
const PAGES_BASE = process.env.GH_PAGES_BASE ?? "/leanmate/";

/** 把 AI 代理挂到 dev 与 preview 服务器上，密钥只留在进程环境变量里，不进前端包。 */
function aiProxyPlugin() {
  const middleware = createAiMiddleware();
  return {
    name: "leanmate-ai-proxy",
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(middleware);
    },
  };
}

/** GitHub Pages 没有 SPA 回退：把 index.html 复制成 404.html，直接访问 /diet 这类子路由也能打开应用。 */
function pagesSpaFallback(): Plugin {
  return {
    name: "leanmate-pages-spa",
    apply: "build",
    closeBundle() {
      const dist = fileURLToPath(new URL("./dist", import.meta.url));
      copyFileSync(join(dist, "index.html"), join(dist, "404.html"));
      writeFileSync(join(dist, ".nojekyll"), "");
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // .env.local 里的 AI_* 只注入到 Node 进程，供 server/ai-middleware.mjs 使用，不会进前端包
  const fileEnv = loadEnv(mode, process.cwd(), "");
  for (const key of ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL", "AI_TIMEOUT_MS"]) {
    if (fileEnv[key] && !process.env[key]) process.env[key] = fileEnv[key];
  }

  return {
    base: command === "build" ? PAGES_BASE : "/",
    plugins: [react(), tailwindcss(), aiProxyPlugin(), pagesSpaFallback()],
    test: { environment: "node", include: ["src/**/*.test.ts"] },
  };
});
