import type { ElectrobunConfig } from 'electrobun'

export default {
  app: {
    name: 'AI Usage',
    identifier: 'com.4lch4.ai-usage',
    version: '0.2.2', // x-release-please-version
  },
  runtime: {
    exitOnLastWindowClosed: false,
  },
  build: {
    mainProcess: 'bun',
    bun: {
      entrypoint: 'src/index.ts',
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig
