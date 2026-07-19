import { playwright } from '@vitest/browser-playwright'
import { defineViteConfig } from 'smartbundle'
import { defineConfig, mergeConfig } from 'vitest/config'

export default defineConfig(async () => {
  const smartbundleConfig = await defineViteConfig()

  if ('error' in smartbundleConfig) {
    throw new Error(smartbundleConfig.errors.join('\n'))
  }

  return mergeConfig(
    smartbundleConfig,
    defineConfig({
      test: {
        browser: {
          enabled: true,
          headless: true,
          instances: [{ browser: 'chromium' }],
          provider: playwright(),
          screenshotFailures: false,
        },
      },
    }),
  )
})
