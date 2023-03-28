/**
 * @copyright Sister Software. All rights reserved.
 * @author Teffen Ellis, et al.
 * @license
 * See LICENSE file in the project root for full license information.
 */

import type { Options as PrettierOptions } from 'prettier'

export type WriteFileFormatter = (fileContents: string, previousFileName: string, rewrittenFileName: string) => string
export const writeFileIdentityFormatter: WriteFileFormatter = (fileContents) => fileContents
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

export async function createDefaultPrettierFormatter(
  prettierOverrides: Partial<PrettierOptions> = {}
): Promise<WriteFileFormatter> {
  const prettier = await import('prettier')
  const config = await import('@sister.software/prettier-config')

  const prettierOptions: PrettierOptions = {
    parser: 'typescript',
    ...config,
    ...prettierOverrides,
  }

  return (fileContents, previousFileName) => {
    if (!isFormattable(previousFileName)) {
      return fileContents
    }

    return prettier.format(fileContents, prettierOptions)
  }
}
