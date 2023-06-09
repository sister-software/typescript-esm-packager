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
import { FileExtensionPatterns } from './formatter.mjs'
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

  const parsedCLI = ts.parseJsonConfigFileContent(tsConfig.config, configHostParser, resolve(dirname(pathToTSConfig)))
  parsedCLI.options.configFilePath = pathToTSConfig

  return parsedCLI
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
  if (diagnostic.code === 5096) {
    // "Option 'allowImportingTsExtensions' can only be used when either 'noEmit' or 'emitDeclarationOnly' is set."
    // This can be ignored, since we're overriding the emit function.
    console.log('Diagnostic suppressed:', diagnostic.code, '(allowImportingTsExtensions)')
    return
  }

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

/**
 * Emits the result of the program with the transformer and formatter applied.
 * This is a convenience wrapper around the TypeScript API and can be replaced
 * with a custom implementation if needed.
 */
export type EmitWithTransformerFn = () => ts.EmitResult

export type WithTransformerEmit<T> = T & {
  emitWithTransformer: EmitWithTransformerFn
}

export interface SimpleProgramConfig {
  tsConfig: ts.ParsedCommandLine
  transformer?: TSPathTransformer
  writeFileCallback?: ts.WriteFileCallback
}

/**
 * Creates a file name mapping used to rewrite the output file names.
 */
export function _createFileNameMap(tsConfig: ts.ParsedCommandLine, transformer?: TSPathTransformer) {
  const fileNameRewriteMap = new Map<string, string>()

  if (!transformer) return fileNameRewriteMap

  for (const originalFileName of tsConfig.fileNames) {
    const transformedFileName = transformer.rewriteFilePath(originalFileName)
    const transformedToMJS = originalFileName.endsWith('.tsx') && transformedFileName.endsWith('.mjs')

    const outputNames = ts.getOutputFileNames(tsConfig, originalFileName, ts.sys.useCaseSensitiveFileNames)

    for (const outputName of outputNames) {
      let rewrittenOutput = transformer.rewriteFilePath(outputName)

      if (transformedToMJS) {
        if (FileExtensionPatterns.TypeScriptDeclaration.test(outputName)) {
          rewrittenOutput = rewrittenOutput.replace(FileExtensionPatterns.TypeScriptDeclaration, '.d.mts')
        } else if (FileExtensionPatterns.JavaScript.test(outputName)) {
          rewrittenOutput = rewrittenOutput.replace(FileExtensionPatterns.JavaScript, '.mjs')
        }
      }

      fileNameRewriteMap.set(outputName, rewrittenOutput)
    }
  }

  return fileNameRewriteMap
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
  writeFileCallback = ts.sys.writeFile,
}: SimpleProgramConfig) {
  const host = ts.createWatchCompilerHost(
    tsConfig.fileNames,
    tsConfig.options,
    ts.sys,
    ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    reportDiagnostic,
    reportWatchStatusChanged,
    tsConfig.projectReferences
  )

  const fileNameRewriteMap = _createFileNameMap(tsConfig, transformer)
  const originalPostProgramCreate = host.afterProgramCreate

  host.afterProgramCreate = (builderProgram) => {
    builderProgram.emit(
      undefined,
      (fileName, text, writeByteOrderMark) => {
        const nextFileName = fileNameRewriteMap.get(fileName) ?? fileName
        const nextText = transformer ? transformer.rewriteFileText(fileName, text) : text

        return writeFileCallback(nextFileName, nextText, writeByteOrderMark)
      },
      undefined,
      undefined,
      transformer?.asCustomTransformers()
    )

    originalPostProgramCreate!(builderProgram)
  }

  const watchProgram = ts.createWatchProgram(host)

  return watchProgram
}

/**
 * Creates a TypeScript compiler that emits the result.
 * This is a convenience wrapper around the TypeScript API and can be replaced
 * with a custom implementation if needed.
 *
 * @see {@linkcode createSimpleTSProgramWithWatcher} for a watching compiler.
 */
export function createSimpleTSProgram({
  tsConfig,
  transformer,
  writeFileCallback = ts.sys.writeFile,
}: SimpleProgramConfig) {
  const program = ts.createProgram({
    host: ts.createCompilerHost(tsConfig.options, true),
    options: tsConfig.options,
    rootNames: tsConfig.fileNames,
  })

  const fileNameRewriteMap = _createFileNameMap(tsConfig, transformer)

  const emitWithTransformer: EmitWithTransformerFn = () =>
    program.emit(
      undefined,
      (fileName, text, writeByteOrderMark) => {
        const nextFileName = fileNameRewriteMap.get(fileName) ?? fileName
        const nextText = transformer ? transformer.rewriteFileText(fileName, text) : text

        return writeFileCallback(nextFileName, nextText, writeByteOrderMark)
      },
      undefined,
      undefined,
      transformer?.asCustomTransformers()
    )

  const mixedProgram: WithTransformerEmit<typeof program> = Object.assign(program, {
    emitWithTransformer,
  })

  return mixedProgram
}
