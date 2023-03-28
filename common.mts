/**
 * @copyright Sister Software. All rights reserved.
 * @author Teffen Ellis, et al.
 * @license
 * See LICENSE file in the project root for full license information.
 */

/**
 * A function that takes an import path and returns a new import path.
 */
export type PathRewriterFn = (
  /**
   * The path to the file being imported.
   */
  importPath: string,
  /**
   * The path to the file containing the import statement.
   */
  sourceFilePath?: string
) => string

/**
 * A map of aliases to regular expressions. If the import path matches the
 * regular expression, the alias will be used to rewrite the import path.
 */
export interface PathRewriterRecord {
  [alias: string]: RegExp
}

export interface _RewriteFnArgs {
  importPath: string
  sourceFilePath?: string

  /**
   * Either a function that takes an import path and returns a new import path,
   * or a map of aliases to regular expressions.
   */
  rewriter: PathRewriterFn | PathRewriterRecord
}

/**
 * @internal
 */
export type _RewriteFn = (args: _RewriteFnArgs) => string

/**
 * @internal
 */
export const _rewriteImportPath: _RewriteFn = ({ importPath, sourceFilePath, rewriter }) => {
  if (typeof rewriter === 'function') {
    const newImportPath = rewriter(importPath, sourceFilePath)
    if (newImportPath) {
      return newImportPath
    }

    return importPath
  }

  for (const [alias, pattern] of Object.entries(rewriter)) {
    if (pattern.test(importPath)) {
      return importPath.replace(pattern, alias)
    }
  }

  return importPath
}
