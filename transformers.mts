/**
 * @copyright Sister Software. All rights reserved.
 * @author Teffen Ellis, et al.
 * @license
 * See LICENSE file in the project root for full license information.
 */

import ts from 'typescript'
import { PathRewriterFn, PathRewriterRecord, _rewriteImportPath } from './common.mts'
import { importExportVisitor } from './visitor.mts'

/**
 * AST Transformer to rewrite any imported or exported paths.
 * This is typically used to rewrite relative imports into absolute imports,
 * or to rewrite imports to a different file extension.
 */
export class TSPathTransformer {
  constructor(public rewriter: PathRewriterFn | PathRewriterRecord) {}

  /**
   * Rewrite the file names of the given source files.
   *
   * ```ts
   * transformer.rewriteSourceFiles(program.getSourceFiles())
   * ```
   */
  public rewriteSourceFiles(sourceFiles: readonly ts.SourceFile[]) {
    for (const sourceFile of sourceFiles) {
      sourceFile.fileName = _rewriteImportPath({ importPath: sourceFile.fileName, rewriter: this.rewriter })
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
