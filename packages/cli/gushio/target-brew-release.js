module.exports = {
  cli: {
    name: 'brew-release',
    description: 'Release leapp cli on npm and homebrew',
    version: '0.1'
  },
  deps: [],
  run: async () => {
    const shellJs = await gushio.import('shelljs')
    const path = await gushio.import('path')
    const os = await gushio.import('os')

    const cliPackageJson = require('../package.json')
    const getFormula = require('./homebrew/get-formula')

    const gitHubOrganization = "Noovolari"
    const gitHubRepo = "homebrew-brew"

    const gitPushToken = process.env['GIT_PUSH_TOKEN']
    const credentials = gitPushToken ? `${gitPushToken}:x-oauth-basic@` : ''
    const formulaRepo = `https://${credentials}github.com/${gitHubOrganization}/${gitHubRepo}.git`
    const tempDir = os.tmpdir();
    const formulaRepoPath = path.join(tempDir, gitHubRepo);

    const leappCliVersion = cliPackageJson.version
    const gitFormulaCommitMessage = `leapp-cli v${leappCliVersion}`;

    try {
      console.log('Cloning formula repo... ')

      await fs.remove(formulaRepoPath)

      shellJs.cd(tempDir)
      let result = shellJs.exec(`git clone ${formulaRepo}`)
      if (result.code !== 0) {
        throw new Error(result.stderr)
      }


      console.log('Downloading tarball... ')

      result = shellJs.exec('npm view @noovolari/leapp-cli dist.tarball')
      if (result.code !== 0) {
        throw new Error(result.stderr)
      }
      const tarballUrl = result.stdout.trim()

      result = shellJs.exec(`curl -o tarball ${tarballUrl}`)
      if (result.code !== 0) {
        throw new Error(result.stderr)
      }

      result = shellJs.exec(`openssl dgst -sha256 -r tarball`)
      if (result.code !== 0) {
        throw new Error(result.stderr)
      }
      const tarballSha256 = result.stdout.split(' ')[0]


      console.log('Updating formula... ')

      const formula = getFormula(leappCliVersion, tarballUrl, tarballSha256)
      await fs.writeFile(path.join(formulaRepoPath, 'Formula/leapp-cli.rb'), formula)


      console.log('Pushing updated formula repo... ')

      shellJs.cd(formulaRepoPath)
      result = shellJs.exec(`git add .`)
      if (result.code !== 0) {
        throw new Error(result.stderr)
      }

      result = shellJs.exec(`git commit -m "${gitFormulaCommitMessage}"`)
      if (result.code !== 0) {
        throw new Error(result.stderr)
      }

      result = shellJs.exec(`git push`)
      if (result.code !== 0) {
        throw new Error(result.stderr)
      }
    } catch (e) {
      e.message = e.message.red
      throw e
    } finally {
      await fs.remove(formulaRepoPath)
    }
  }
}
