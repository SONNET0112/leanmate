import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5183",
    ...devices["iPhone 13"],
    browserName: "chromium",
  },
  webServer: {
    command: "npx vite --port 5183 --strictPort",
    url: "http://localhost:5183",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
