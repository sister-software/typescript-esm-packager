/**
 * @copyright Sister Software. All rights reserved.
 * @author Teffen Ellis, et al.
 * @license
 * See LICENSE file in the project root for full license information.
 */

import ts from 'typescript'
import { PathRewriterFn, PathRewriterRecord, _rewriteImportPath } from './common.mts'
import {
  FileExtensionPatterns,
  SourceMappingURLPattern,
  createSourceMappingURL,
  isJavaScriptMap,
  isJavaScriptModuleMap,
  isTypeScriptLike,
} from './formatter.mjs'
import { importExportVisitor } from './visitor.mts'

/**
 * Rewrites '.ts', '.mts', and '.tsx' files to '.mjs' files
 * @internal
 */
export const simpleESMRewriter: PathRewriterFn = (importPath) => {
  if (isJavaScriptMap(importPath)) {
    return importPath.replace(FileExtensionPatterns.JavaScriptMap, '.mjs.map')
  }

  if (isJavaScriptModuleMap(importPath)) {
    return importPath.replace(FileExtensionPatterns.JavaScriptModule, '.mjs.map')
  }

  if (isTypeScriptLike(importPath)) {
    return importPath.replace(FileExtensionPatterns.TypeScriptLike, '.mjs')
  }

  return importPath
}

/**
 * AST Transformer to rewrite any imported or exported paths.
 * This is typically used to rewrite relative imports into absolute imports,
 * or to rewrite imports to a different file extension.
 */
export class TSPathTransformer {
  constructor(public rewriter: PathRewriterFn | PathRewriterRecord = simpleESMRewriter) {}

  /**
   * Rewrite a single file path.
   *
   * ```ts
   * transformer.rewriteFilePath(filePath)
   * ```
   */
  public rewriteFilePath(filePath: string) {
    return _rewriteImportPath({ importPath: filePath, rewriter: this.rewriter })
  }

  /**
   * Rewrite the file names of the given source files.
   *
   * ```ts
   * transformer.rewriteSourceFiles(program.getSourceFiles())
   * ```
   */
  public rewriteSourceFiles(sourceFiles: readonly ts.SourceFile[]) {
    for (const sourceFile of sourceFiles) {
      sourceFile.fileName = this.rewriteFilePath(sourceFile.fileName)
    }
  }

  /**
   * Reshape the transformer into a TypeScript transformer factory.
   *
   * @returns A TypeScript transformer factory.
   */
  public asTransformerFactory(): ts.CustomTransformerFactory {
    const transformFactory: ts.CustomTransformerFactory = (ctx) => {
      const transformSourceFile = (node: ts.SourceFile): ts.SourceFile => {
        return ts.visitNode<ts.SourceFile, ts.Node, ts.SourceFile>(
          node,
          importExportVisitor(ctx, node, this.rewriter),
          ts.isSourceFile
        )
      }

      const transformBundle = (node: ts.Bundle): ts.Bundle => {
        return ts.visitEachChild(
          node,
          (node) => {
            if (ts.isSourceFile(node)) {
              return ts.visitNode(node, importExportVisitor(ctx, node, this.rewriter))
            }
            return node
          },
          ctx
        )
      }

      return {
        transformSourceFile,
        transformBundle,
      }
    }

    return transformFactory
  }

  /**
   * Rewrite the text of a single file.
   *
   * By default, this will rewrite the source map declaration to point to the new file name.
   */
  public rewriteFileText(fileName: string, text: string): string {
    const match = text.match(SourceMappingURLPattern)

    if (!match || !match.index) {
      return text
    }

    const [, sourceMappingPath] = match
    const nextSourceMappingPath = this.rewriteFilePath(sourceMappingPath)
    const nextSourceMappingURL = createSourceMappingURL(nextSourceMappingPath)

    return text.slice(0, match.index) + nextSourceMappingURL + text.slice(match.index + match[0].length)
  }

  public asCustomTransformers({
    afterBuiltIn = true,
    afterDeclarations = true,
  }: AsCustomTransformersOptions = {}): ts.CustomTransformers {
    const customTransformers: ts.CustomTransformers = {}

    if (afterBuiltIn) {
      customTransformers.after = [this.asTransformerFactory()]
    }

    if (afterDeclarations) {
      customTransformers.afterDeclarations = [this.asTransformerFactory()]
    }

    return customTransformers
  }
}

/**
 * Options for the `asCustomTransformers` method.
 */
export interface AsCustomTransformersOptions {
  afterBuiltIn?: boolean
  afterDeclarations?: boolean
}
