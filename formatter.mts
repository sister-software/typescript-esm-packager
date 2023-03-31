/**
 * @copyright Sister Software. All rights reserved.
 * @author Teffen Ellis, et al.
 * @license
 * See LICENSE file in the project root for full license information.
 */

import type { Options as PrettierOptions } from 'prettier'
import ts from 'typescript'

/**
 * A collection of regular expressions that match TypeScript-related file extensions.
 */
export const FileExtensionPatterns = {
  /** File ends with .js or .mjs */
  JavaScript: /\.m?js$/,
  /** File ends with .d.ts or .d.mts */
  TypeScriptDeclaration: /\.d\.m?ts$/,
}

export function isFormattable(filePath: string): boolean {
  return FileExtensionPatterns.JavaScript.test(filePath) || FileExtensionPatterns.TypeScriptDeclaration.test(filePath)
}

/**
 * Creates a TypeScript `writeFileCallback` that uses Prettier to format the file contents.
 * This is convenience wrapper around TypeScript's default `ts.sys.writeFile` function.
 * @see {@linkcode ts.sys.writeFile}
 */
export async function createPrettierWriteFileCallback(
  prettierOverrides: Partial<PrettierOptions> = {}
): Promise<ts.WriteFileCallback> {
  const prettier = await import('prettier')

  let sisterSoftwareConfig: PrettierOptions

  try {
    const configPkg = await import('@sister.software/prettier-config')
    sisterSoftwareConfig = configPkg.default
  } catch (error) {
    console.debug('Could not load @sister.software/prettier-config. Using default Prettier options.')
    sisterSoftwareConfig = {}
  }

  const prettierOptions: PrettierOptions = {
    parser: 'typescript',
    ...sisterSoftwareConfig,
    ...prettierOverrides,
  }

  const formatter: ts.WriteFileCallback = (fileName, fileContents, writeByteOrderMark) => {
    const formattedContents = isFormattable(fileName) ? prettier.format(fileContents, prettierOptions) : fileContents

    ts.sys.writeFile(fileName, formattedContents, writeByteOrderMark)
  }

  return formatter
}
