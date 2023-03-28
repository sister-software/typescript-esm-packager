/**
 * @copyright Sister Software. All rights reserved.
 * @author Teffen Ellis, et al.
 * @license
 * See LICENSE file in the project root for full license information.
 */

import ts from 'typescript'
import { PathRewriterFn, PathRewriterRecord, _rewriteImportPath } from './common.mjs'

/**
 * @internal
 */
export function pluckDeclarationSpecifier(
  node: ts.ImportDeclaration | ts.ExportDeclaration,
  sourceFile: ts.SourceFile
) {
  const importPathWithQuotes = node.moduleSpecifier!.getText(sourceFile)
  return importPathWithQuotes.slice(1, importPathWithQuotes.length - 1)
}

/**
 * @internal
 */
export function importExportVisitor(
  ctx: ts.TransformationContext,
  sourceFile: ts.SourceFile,
  rewriter: PathRewriterFn | PathRewriterRecord
) {
  const visitor: ts.Visitor<ts.Node, ts.Node> = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const importPath = pluckDeclarationSpecifier(node, sourceFile)
      const rewrittenPath = _rewriteImportPath({ importPath, sourceFilePath: sourceFile.fileName, rewriter })

      return ctx.factory.updateImportDeclaration(
        node,
        ts.getModifiers(node),
        node.importClause,
        ctx.factory.createStringLiteral(rewrittenPath, true),
        node.assertClause
      )
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const importPath = pluckDeclarationSpecifier(node, sourceFile)
      const rewrittenPath = _rewriteImportPath({ importPath, sourceFilePath: sourceFile.fileName, rewriter })

      return ctx.factory.updateExportDeclaration(
        node,
        ts.getModifiers(node),
        node.isTypeOnly,
        node.exportClause,
        ctx.factory.createStringLiteral(rewrittenPath, true),
        node.assertClause
      )
    }

    if (ts.isTypeReferenceNode(node) && node.typeArguments) {
      return ctx.factory.updateTypeReferenceNode(
        node,
        node.typeName,
        ctx.factory.createNodeArray(
          node.typeArguments.map((typeArg) => {
            return visitor(typeArg) as any
          })
        )
      )
    }

    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      const importPath = node.argument.literal.text
      const rewrittenPath = _rewriteImportPath({ importPath, sourceFilePath: sourceFile.fileName, rewriter })

      return ctx.factory.updateImportTypeNode(
        node,
        ctx.factory.createLiteralTypeNode(ctx.factory.createStringLiteral(rewrittenPath, true)),
        node.assertions,
        node.qualifier,
        node.typeArguments
          ? ctx.factory.createNodeArray(
              node.typeArguments.map((typeArg) => {
                return visitor(typeArg) as any
              })
            )
          : undefined,
        node.isTypeOf
      )
    }

    if (ts.isExportAssignment(node) && ts.isStringLiteral(node.expression)) {
      const importPath = node.expression.text
      const rewrittenPath = _rewriteImportPath({ importPath, sourceFilePath: sourceFile.fileName, rewriter })

      return ctx.factory.updateExportAssignment(
        node,
        node.modifiers,
        ctx.factory.createStringLiteral(rewrittenPath, true)
      )
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const importPath = node.moduleSpecifier.text
      const rewrittenPath = _rewriteImportPath({ importPath, sourceFilePath: sourceFile.fileName, rewriter })

      return ctx.factory.updateExportDeclaration(
        node,
        node.modifiers,
        node.isTypeOnly,
        node.exportClause,
        ctx.factory.createStringLiteral(rewrittenPath, true),
        node.assertClause
      )
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const importPath = node.moduleSpecifier.text
      const rewrittenPath = _rewriteImportPath({ importPath, sourceFilePath: sourceFile.fileName, rewriter })

      return ctx.factory.updateImportDeclaration(
        node,
        node.modifiers,
        node.importClause,
        ctx.factory.createStringLiteral(rewrittenPath, true),
        node.assertClause
      )
    }

    return ts.visitEachChild(node, visitor, ctx)
  }

  return visitor
}
