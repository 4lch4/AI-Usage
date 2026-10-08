import type { ElectrobunConfig } from 'electrobun'

export default {
  app: {
    name: 'AI Usage',
    identifier: 'com.4lch4.ai-usage',
    version: '0.1.0',
  },
  runtime: {
    exitOnLastWindowClosed: false,
  },
  build: {
    mainProcess: 'bun',
    bun: {
      entrypoint: 'src/shell/index.ts',
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig
