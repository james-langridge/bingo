import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000, // 60 seconds per test
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.CI ? "on-first-retry" : "off",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "npm run dev",
      port: 5173,
      reuseExistingServer: !process.env.CI,
      stdout: "ignore",
      stderr: "ignore",
    },
    {
      command: "cd server && npm run dev",
      port: 3001,
      reuseExistingServer: !process.env.CI,
      stdout: "ignore",
      stderr: "ignore",
    },
  ],
});
