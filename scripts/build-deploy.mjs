// 生成可直接上传的部署包：build → 复制到 deploy/ → 同步食物库给 PHP
import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// 默认按「域名根目录」部署；放子目录时用 GH_PAGES_BASE=/leanmate/ npm run build:deploy
// 注意：不能用相对 base("./")——App 的 basename 依赖 import.meta.env.BASE_URL，相对值会让路由匹配不到
const base = process.env.GH_PAGES_BASE ?? "/";
execSync("npm run build", { cwd: root, stdio: "inherit", env: { ...process.env, GH_PAGES_BASE: base } });
console.log(`构建 base = ${base}`);

const dist = join(root, "dist");
const deploy = join(root, "deploy");
const assets = join(deploy, "assets");

rmSync(assets, { recursive: true, force: true });
rmSync(join(deploy, "index.html"), { force: true });
cpSync(dist, deploy, {
  recursive: true,
  filter: (src) => !/[\\/](404\.html|\.nojekyll)$/.test(src),
});

mkdirSync(join(deploy, "api"), { recursive: true });
copyFileSync(join(root, "src/data/foods.json"), join(deploy, "api/foods.json"));

for (const required of ["index.html", "api/ai.php", "api/foods.json", ".htaccess"]) {
  if (!existsSync(join(deploy, required))) throw new Error(`部署包缺少 ${required}`);
}
console.log("部署包已生成：deploy/（含 index.html、assets/、api/ai.php、.htaccess）");
