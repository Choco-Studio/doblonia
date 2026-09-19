import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`)
  return result.stdout
}

assert.equal(run('git', ['status', '--porcelain']).trim(), '', 'Commit the reviewed version before packaging')
const revision = run('git', ['rev-parse', 'HEAD']).trim()
const project = JSON.parse(await readFile('package.json', 'utf8'))
const npmCli = process.env.npm_execpath
assert.ok(npmCli, 'Run this script with npm run package:release')
console.log('Building the committed revision…')
run(process.execPath, [npmCli, 'run', 'build'], { stdio: 'inherit' })

const output = path.resolve('build/releases')
await mkdir(output, { recursive: true })
const name = `doblonia-${project.version}-${revision.slice(0, 8)}`
const source = path.join(output, `${name}-source.zip`)
const runtime = path.join(output, `${name}-runtime.tar.gz`)
for (const file of [source, runtime]) {
  assert.equal(
    await access(file).then(
      () => true,
      () => false,
    ),
    false,
    `Artifact already exists: ${file}`,
  )
}
const staging = await mkdtemp(path.join(output, 'runtime-'))
const files = [
  'package.json',
  'package-lock.json',
  '.env.example',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'THIRD_PARTY_LICENSES',
  'docs',
  'deploy',
  'scripts/start.mjs',
  'apps/client/package.json',
  'apps/server/package.json',
  'packages/content/package.json',
  'packages/protocol/package.json',
  'packages/sim/package.json',
  'apps/client/dist',
  'apps/server/dist',
]
for (const file of files) {
  const target = path.join(staging, file)
  await mkdir(path.dirname(target), { recursive: true })
  await cp(file, target, { recursive: true })
}
await writeFile(
  path.join(staging, 'README.md'),
  `# Doblonia.io ${project.version}\n\nRevisión: ${revision}\n\nRequiere Node.js 22.13 o posterior. Ejecuta:\n\n\`\`\`sh\nnpm ci --omit=dev --ignore-scripts\nnpm start\n\`\`\`\n\nAbre http://localhost:2567. Configuración y operación en docs/DEPLOYMENT.md.\n\nEl archivo ${name}-source.zip contiene el código de esta revisión, con licencia AGPL-3.0-or-later.\nEsta distribución es una candidata de pruebas; consulta docs/VALIDACION.md antes de publicarla.\n`,
)
await writeFile(
  path.join(staging, 'release.json'),
  JSON.stringify(
    {
      name: project.name,
      version: project.version,
      revision,
      builtAt: new Date().toISOString(),
      sourceArchive: path.basename(source),
    },
    null,
    2,
  ) + '\n',
)
const sbom = run(process.execPath, [npmCli, 'sbom', '--omit=dev', '--sbom-format=cyclonedx'])
JSON.parse(sbom)
await writeFile(path.join(staging, 'sbom.cdx.json'), sbom)
run('git', ['archive', '--format=zip', `--output=${source}`, 'HEAD'])
run('tar', ['-czf', runtime, '-C', staging, '.'])
const hashes = await Promise.all(
  [source, runtime].map(async (file) => {
    const digest = createHash('sha256')
      .update(await readFile(file))
      .digest('hex')
    return `${digest}  ${path.basename(file)}`
  }),
)
await writeFile(path.join(output, `${name}-SHA256SUMS.txt`), hashes.join('\n') + '\n')
console.log(`Source: ${source}\nRuntime: ${runtime}\nInstall verification directory: ${staging}`)
