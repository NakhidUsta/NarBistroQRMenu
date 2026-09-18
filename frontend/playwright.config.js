import { defineConfig } from '@playwright/test'

// E2E real backend + DB üzərində işləyir: əvvəlcə backend (:4000) və frontend (:5174) qalxmalıdır.
// Test öz yaratdığı məhsulu silir, sifarişi isə ləğv edir (DB-də qalır).
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5174',
    headless: true,
    viewport: { width: 1100, height: 900 },
  },
})
