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
export async function cleanDir(directoryPath: string) {
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
