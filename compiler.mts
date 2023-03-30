/**
 * @copyright Sister Software. All rights reserved.
 * @author Teffen Ellis, et al.
 * @license
 * See LICENSE file in the project root for full license information.
 */

import { constants, existsSync, readFileSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'
import { TSPathTransformer } from './transformers.mjs'

export function createTSNodeConfigHostParser() {
  const configHostParser: ts.ParseConfigHost = {
    fileExists: existsSync,
    readDirectory: ts.sys.readDirectory,
    readFile: (file) => readFileSync(file, 'utf8'),
    useCaseSensitiveFileNames: process.platform === 'linux',
  }

  return configHostParser
}

/**
 * Reads a tsconfig.json file and returns the parsed result.
 */
export function readParsedTSConfig(
  pathToTSConfig: string,
  configHostParser = createTSNodeConfigHostParser()
): ts.ParsedCommandLine {
  const tsConfig = ts.readConfigFile(pathToTSConfig, ts.sys.readFile)

  return ts.parseJsonConfigFileContent(tsConfig.config, configHostParser, resolve(dirname(pathToTSConfig)))
}

/**
 * Cleans a given directory, creating it if it doesn't exist.
 */
export async function cleanDirectory(directoryPath: string) {
  if (!directoryPath || directoryPath.trim().length === 0) throw new Error('Cannot clean empty directory path!')
  if (directoryPath === '/') throw new Error('Cannot clean root directory!')

  const present = await fs
    .access(directoryPath, constants.F_OK)
    .then(() => true)
    .catch(() => false)

  if (present) {
    console.log('Cleaning...', directoryPath)
    await fs.rm(directoryPath, { recursive: true })
  }

  await fs.mkdir(directoryPath, { recursive: true })
}

export async function cleanTSBuildDirectory(tsConfig: ts.ParsedCommandLine) {
  if (!tsConfig.options.outDir) throw new Error('The given tsconfig.json file does not have an "outDir" option!')

  await cleanDirectory(tsConfig.options.outDir)
}

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (path) => path,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
}

export function reportDiagnostic(diagnostic: ts.Diagnostic) {
  console.error(
    'Error',
    diagnostic.code,
    ':',
    ts.flattenDiagnosticMessageText(diagnostic.messageText, formatHost.getNewLine())
  )
}

/**
 * Prints a diagnostic every time the watch status changes.
 * This is mainly for messages like "Starting compilation" or "Compilation completed".
 */
export function reportWatchStatusChanged(diagnostic: ts.Diagnostic) {
  console.info(ts.formatDiagnostic(diagnostic, formatHost))
}

export type WithTransformerEmit<T> = T & {
  /**
   * Emits the result of the program with the transformer and formatter applied.
   * This is a convenience wrapper around the TypeScript API and can be replaced
   * with a custom implementation if needed.
   */
  emitWithTransformer: () => ts.EmitResult
}

export interface SimpleProgramConfig {
  tsConfig: ts.ParsedCommandLine
  transformer?: TSPathTransformer
  formatter?: ts.WriteFileCallback
}

/**
 * Creates a TypeScript compiler that watches for changes and emits the result.
 * This is a convenience wrapper around the TypeScript API and can be replaced
 * with a custom implementation if needed.
 *
 * @see {@linkcode createSimpleTSProgram} for a non-watching compiler.
 */
export function createSimpleTSProgramWithWatcher({
  tsConfig,
  transformer,
  formatter = ts.sys.writeFile,
}: SimpleProgramConfig) {
  const watchHost = ts.createWatchCompilerHost(
    tsConfig.fileNames,
    {
      ...tsConfig.options,
      emitDeclarationOnly: false,
    },
    ts.sys,
    ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    reportDiagnostic,
    reportWatchStatusChanged
  )

  watchHost.afterProgramCreate = (builderProgram) => {
    builderProgram.emit(undefined, formatter, undefined, undefined, transformer?.asCustomTransformers())
  }

  const watchProgram = ts.createWatchProgram(watchHost)

  return watchProgram
}

/**
 * Creates a TypeScript compiler that emits the result.
 * This is a convenience wrapper around the TypeScript API and can be replaced
 * with a custom implementation if needed.
 *
 * @see {@linkcode createSimpleTSProgramWithWatcher} for a watching compiler.
 */
export function createSimpleTSProgram({ tsConfig, transformer, formatter = ts.sys.writeFile }: SimpleProgramConfig) {
  const program = ts.createProgram({
    host: ts.createCompilerHost(tsConfig.options, true),
    options: {
      ...tsConfig.options,
      // As of TypeScript 5, we can only use module extensions in imports and exports,
      // if the compiler option `emitDeclarationOnly` is set to `true`.
      // So we turn it off for the duration of the emit...
      emitDeclarationOnly: false,
    },
    rootNames: tsConfig.fileNames,
  })

  transformer?.rewriteSourceFiles(program.getSourceFiles())

  const mixedProgram: WithTransformerEmit<typeof program> = Object.assign(program, {
    emitWithTransformer: () =>
      program.emit(undefined, formatter, undefined, undefined, transformer?.asCustomTransformers()),
  })

  return mixedProgram
}
