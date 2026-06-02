/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import removeConsole from 'vite-plugin-remove-console'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendProxyTarget = env.VITE_BACKEND_BASE_URL || 'https://inscriptions.cdacb.in'

  return {
    base: '/admin',
    preview: {
      port: 3000,
      strictPort: true,
    },
    server: {
      host: 'localhost',
      port: 3000,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendProxyTarget,
          changeOrigin: true,
          secure: true,
        },
        '/detect': {
          target: backendProxyTarget,
          changeOrigin: true,
          secure: true,
        },
        '/n8n': {
          target: backendProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    plugins: [
      react({
        plugins: [
          [
            '@swc/plugin-styled-components',
            {
              displayName: true,
              pure: true,
              ssr: false,
            },
          ],
        ],
      }),
      removeConsole({
        includes: ['log', 'warn', 'error', 'debug'],
      }),
      tailwindcss(),
    ],
    css: {
      modules: {
        localsConvention: 'camelCase',
      },
    },
    resolve: {
      alias: {
        '@mui/styled-engine': '@mui/styled-engine-sc',
        '@': path.resolve(__dirname, './src'),
        '@api': path.resolve(__dirname, './src/api'),
        '@assets': path.resolve(__dirname, './src/assets'),
        '@components': path.resolve(__dirname, './src/components'),
        '@context': path.resolve(__dirname, './src/context'),
        '@db': path.resolve(__dirname, './src/db'),
        '@features': path.resolve(__dirname, './src/features'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@layouts': path.resolve(__dirname, './src/layouts'),
        '@routes': path.resolve(__dirname, './src/routes'),
        '@services': path.resolve(__dirname, './src/services'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@store': path.resolve(__dirname, './src/store'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@views': path.resolve(__dirname, './src/views'),
      },
    },
    test: {
      projects: [
        {
          extends: true,
          plugins: [
            // The plugin will run tests for the stories defined in your Storybook config
            // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
            storybookTest({
              configDir: path.join(dirname, '.storybook'),
            }),
          ],
          test: {
            name: 'storybook',
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              instances: [
                {
                  browser: 'chromium',
                },
              ],
            },
          },
        },
      ],
    },
  }
})
