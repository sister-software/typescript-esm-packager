/**
 * @copyright Sister Software. All rights reserved.
 * @author Teffen Ellis, et al.
 * @license
 * See LICENSE file in the project root for full license information.
 */

import * as path from 'node:path'
import ts from 'typescript'

import { cleanDir, readParsedTSConfig } from './compiler.mjs'
import { createDefaultPrettierFormatter } from './formatter.mjs'
import { TSPathTransformer } from './transformers.mjs'

const watching = process.argv.includes('--watch')

const __dirname = new URL('.', import.meta.url).pathname
const buildDir = path.join(__dirname, 'dist')

await cleanDir(buildDir)

const tsConfig = readParsedTSConfig(path.join(__dirname, 'tsconfig.json'))

const compilerOptions: ts.CompilerOptions = {
  ...tsConfig.options,
  emitDeclarationOnly: false,
}

const formatter = await createDefaultPrettierFormatter()
const transformer = new TSPathTransformer(
  {
    '.d.mts': /\.d\.mts$/gi,
    '.mjs': /\.m?tsx?$/gi,
  },
  formatter
)

if (watching) {
  const watchHost = ts.createWatchCompilerHost(
    tsConfig.fileNames,
    compilerOptions,
    ts.sys,
    ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    (diagnostic) => console.error(diagnostic.messageText),
    (diagnostic) => console.error(diagnostic.messageText)
  )

  watchHost.afterProgramCreate = (program) => {
    program.emit(undefined, transformer.writeFileCallback, undefined, undefined, transformer.asCustomTransformers())
  }

  ts.createWatchProgram(watchHost)
} else {
  const program = ts.createProgram({
    host: ts.createCompilerHost(tsConfig.options, true),
    options: compilerOptions,
    rootNames: tsConfig.fileNames,
  })

  program.emit(undefined, transformer.writeFileCallback, undefined, undefined, transformer.asCustomTransformers())
}
