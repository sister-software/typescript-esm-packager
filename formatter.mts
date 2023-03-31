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
  /** File ends with `.js` */
  JavaScript: /\.js$/i,
  /** File ends with `.js.map` */
  JavaScriptMap: /\.js\.map$/i,
  /** File ends with `.mjs` */
  JavaScriptModule: /\.mjs$/i,
  /** File ends with `.js.map` */
  JavaScriptModuleMap: /\.mjs\.map$/i,
  /** File ends with .js or .mjs */
  JavaScriptLike: /\.m?js$/i,
  /** File ends with `.ts` */
  TypeScript: /\.ts$/i,
  /** File ends with `.tsx` */
  TypeScriptReact: /\.tsx$/i,
  TypeScriptModule: /\.mts$/i,
  /**
   * File ends with `.ts` or `.tsx` or `.mts`
   */
  TypeScriptLike: /\.m?tsx?$/i,
  /** File ends with `.d.ts` */
  TypeScriptDeclaration: /\.d\.ts$/i,
  /** File ends with `.d.mts` */
  TypeScriptDeclarationModule: /\.d\.mts$/i,
  /** File ends with `.d.ts` or `.d.mts` */
  TypeScriptDeclarationLike: /\.d\.m?ts$/i,
} as const

export const SourceMappingURLPreamble = '//# sourceMappingURL='

/**
 * A pattern that matches a source mapping URL comment.
 */
export const SourceMappingURLPattern = /\/\/# sourceMappingURL=(.*)$/i
/**
 * Creates a source mapping URL comment.
 * @internal
 */
export function createSourceMappingURL(url: string): string {
  return `${SourceMappingURLPreamble}${url}`
}

/**
 * Determines if the given file name is a TypeScript declaration file.
 */
export function isTypeScriptDeclarationLike(fileName: string): boolean {
  return FileExtensionPatterns.TypeScriptDeclarationLike.test(fileName)
}

/**
 * Determines if the given file name is a JavaScript map file.
 */
export function isJavaScriptMap(fileName: string): boolean {
  return FileExtensionPatterns.JavaScriptMap.test(fileName)
}

/**
 * Determines if the given file name is a JavaScript module map file.
 */
export function isJavaScriptModuleMap(fileName: string): boolean {
  return FileExtensionPatterns.JavaScriptModuleMap.test(fileName)
}

/**
 * Determines if the given file name is a TypeScript file.
 * Note that this does not include TypeScript declaration files.
 */
export function isTypeScriptLike(fileName: string): boolean {
  return !isTypeScriptDeclarationLike(fileName) && FileExtensionPatterns.TypeScriptLike.test(fileName)
}

/**
 * Determines if the given file is formattable by Prettier.
 */
export function isFormattable(filePath: string): boolean {
  return (
    FileExtensionPatterns.JavaScriptLike.test(filePath) ||
    FileExtensionPatterns.TypeScriptDeclarationLike.test(filePath)
  )
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
