/**
 * @copyright Sister Software. All rights reserved.
 * @author Teffen Ellis, et al.
 * @license
 * See LICENSE file in the project root for full license information.
 */

import ts from 'typescript'
import { PathRewriterFn, PathRewriterRecord, _rewriteImportPath } from './common.mjs'
import { importExportVisitor } from './visitor.mjs'

/**
 * AST Transformer to rewrite any imported or exported paths.
 * This is typically used to rewrite relative imports into absolute imports,
 * or to rewrite imports to a different file extension.
 */
export class TSPathTransformer {
  constructor(public rewriter: PathRewriterFn | PathRewriterRecord) {}

  /**
   * Wrapper around TypeScript's default `writeFile` function.
   * Automatically applies path transformations to the file name.
   */
  writeFileCallback: ts.WriteFileCallback = (fileName, fileContents, writeByteOrderMark) => {
    const nextFileName = _rewriteImportPath({ importPath: fileName, rewriter: this.rewriter })

    ts.sys.writeFile(nextFileName, fileContents, writeByteOrderMark)
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
