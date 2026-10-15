export default {
  packageManager: 'bun',
  scripts: {
    dev: ['hutch', 'electrobun', 'dev', '--watch'],
    build: ['hutch', 'electrobun', 'build', '--env=stable'],
  },
}
