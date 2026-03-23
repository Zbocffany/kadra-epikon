import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const sourceDir = path.join(rootDir, 'node_modules', 'flag-icons', 'flags', '4x3')
const targetDir = path.join(rootDir, 'public', 'flags', '4x3')
const mappingFile = path.join(rootDir, 'lib', 'flags', 'fifaFlagMap.ts')

if (!existsSync(sourceDir)) {
  throw new Error(`Missing source flags directory: ${sourceDir}`)
}

rmSync(targetDir, { recursive: true, force: true })
mkdirSync(targetDir, { recursive: true })

const mappingSource = readFileSync(mappingFile, 'utf8')
const assetCodes = [...mappingSource.matchAll(/: '([a-z0-9-]+)'/g)]
  .map((match) => match[1])
  .filter((code, index, allCodes) => allCodes.indexOf(code) === index)

for (const code of assetCodes) {
  const sourceFile = path.join(sourceDir, `${code}.svg`)
  const targetFile = path.join(targetDir, `${code}.svg`)

  if (!existsSync(sourceFile)) {
    throw new Error(`Missing source flag asset: ${sourceFile}`)
  }

  copyFileSync(sourceFile, targetFile)
}

console.log(`Copied ${assetCodes.length} flag SVGs to ${targetDir}`)