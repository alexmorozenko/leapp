module.exports = {
  cli: {
    name: 'build',
    description: 'Build the leapp core library',
    version: '0.1',
  },
  run: async () => {
    const path = require('path')
    const shellJs = require('shelljs')
    const compileFunction = require('./compile-func')

    try {
      await gushio.run(path.join(__dirname, './target-clean.js'))

      console.log('Building leapp-core library... ')
      await compileFunction(shellJs)
      console.log('Build completed successfully')
    } catch (e) {
      console.error(e.message.red)
    }
  },
}
