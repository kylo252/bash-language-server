// nice with some tests of this

import ShellScript, { Node as SyntaxNode } from 'mvdan-sh'
import { Range } from 'vscode-languageserver/lib/main'

export function range(node: SyntaxNode): Range {
  return Range.create(
    node.Pos().Line() - 1,
    node.Pos().Col(),
    node.End().Line() - 1,
    node.End().Col(),
  )
}

export function isDefinition(node: SyntaxNode): boolean {
  switch (ShellScript.syntax.NodeType(node)) {
    // TODO: other cases?
    case 'Assign':
    case 'FuncDecl':
      return true
    default:
      return false
  }
}

export function isReference(node: SyntaxNode): boolean {
  switch (ShellScript.syntax.NodeType(node)) {
    case 'Assign':
      // TODO: cannot detect this...
      //    case 'command_name':
      return true
    default:
      return false
  }
}

export function findParent(
  start: SyntaxNode,
  predicate: (n: SyntaxNode) => boolean,
): SyntaxNode | null {
  /*
  // TODO: not easy to find parent node it seems
  let node = start.parent
  while (node !== null) {
    if (predicate(node)) {
      return node
    }
    node = node.parent
  }
  */
  return null
}
