import type { Program } from 'acorn'
import { RESOURCE_LIMITS } from '../resourceLimits'

export type ValidationDiagnostic = {
  code:
  | 'UNSUPPORTED_SYNTAX'
  | 'UNSUPPORTED_OPERATOR'
  | 'UNSUPPORTED_FEATURE'
  | 'RESOURCE_LIMIT_EXCEEDED'
  message: string
  nodeType: string
  line: number | null
  column: number | null
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; diagnostics: ValidationDiagnostic[] }

type AstNode = {
  type: string
  start: number
  end: number
  loc?: {
    start: { line: number; column: number }
  } | null
  [key: string]: unknown
}

// These are the AST node types TraceFlow currently plans to support.
const supportedNodeTypes = new Set([
  'Program',
  'VariableDeclaration',
  'VariableDeclarator',
  'Identifier',
  'Literal',
  'ExpressionStatement',
  'BinaryExpression',
  'UnaryExpression',
  'UpdateExpression',
  'AssignmentExpression',
  'CallExpression',
  'FunctionDeclaration',
  'ReturnStatement',
  'BlockStatement',
  'IfStatement',
  'ForStatement',
  'EmptyStatement',
])

const supportedBinaryOperators = new Set([
  '+', '-', '*', '/', '%',
  '<', '<=', '>', '>=',
  '==', '!=', '===', '!==',
])

const supportedUnaryOperators = new Set([
  '+', '-', '!',
])

const supportedUpdateOperators = new Set([
  '++', '--',
])

function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    'start' in value &&
    typeof value.start === 'number'
  )
}

function isAllowedConsoleLogCall(
  node: AstNode,
  parent: AstNode | null,
): boolean {
  if (
    parent === null ||
    parent.type !== 'CallExpression' ||
    parent.callee !== node
  ) {
    return false
  }

  const object = node.object
  const property = node.property

  return (
    node.computed === false &&
    node.optional !== true &&
    isAstNode(object) &&
    object.type === 'Identifier' &&
    object.name === 'console' &&
    isAstNode(property) &&
    property.type === 'Identifier' &&
    property.name === 'log' &&
    parent.optional !== true
  )
}


export function validateJavaScript(ast: Program): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = []

  function addDiagnostic(
    node: AstNode,
    code: ValidationDiagnostic['code'],
    message: string,
  ) {
    diagnostics.push({
      code,
      message,
      nodeType: node.type,
      line: node.loc?.start.line ?? null,
      column: node.loc ? node.loc.start.column + 1 : null,
    })
  }

  let nodeCount = 0
  let resourceLimitExceeded = false

  function visit(
    value: unknown,
    parent: AstNode | null = null,
    depth = 1,
  ) {
    if (resourceLimitExceeded) return

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, parent, depth)
        if (resourceLimitExceeded) return
      }
      return
    }

    if (!isAstNode(value)) return

    const node = value

    if (depth > RESOURCE_LIMITS.maxAstDepth) {
      addDiagnostic(
        node,
        'RESOURCE_LIMIT_EXCEEDED',
        `AST nesting depth exceeds the maximum allowed depth of ${RESOURCE_LIMITS.maxAstDepth}.`,
      )
      resourceLimitExceeded = true
      return
    }

    nodeCount += 1

    if (nodeCount > RESOURCE_LIMITS.maxAstNodes) {
      addDiagnostic(
        node,
        'RESOURCE_LIMIT_EXCEEDED',
        `AST node count exceeds the maximum allowed count of ${RESOURCE_LIMITS.maxAstNodes}.`,
      )
      resourceLimitExceeded = true
      return
    }

    // Reject unsupported member access.
    if (node.type === 'MemberExpression') {
      if (!isAllowedConsoleLogCall(node, parent)) {
        addDiagnostic(
          node,
          'UNSUPPORTED_FEATURE',
          'Only direct console.log(...) calls are supported.',
        )
      }
    }

    // Reject unsupported AST node types.
    if (!supportedNodeTypes.has(node.type) && node.type !== 'MemberExpression') {
      addDiagnostic(
        node,
        'UNSUPPORTED_SYNTAX',
        `The syntax "${node.type}" is not supported.`,
      )
    }

    // Only let and const declarations are supported.
    if (
      node.type === 'VariableDeclaration' &&
      node.kind !== 'let' &&
      node.kind !== 'const'
    ) {
      addDiagnostic(
        node,
        'UNSUPPORTED_FEATURE',
        'Only let and const declarations are supported.',
      )
    }

    // Check binary operators.
    if (
      node.type === 'BinaryExpression' &&
      !supportedBinaryOperators.has(String(node.operator))
    ) {
      addDiagnostic(
        node,
        'UNSUPPORTED_OPERATOR',
        `The binary operator "${String(node.operator)}" is not supported.`,
      )
    }

    // Check unary operators.
    if (
      node.type === 'UnaryExpression' &&
      !supportedUnaryOperators.has(String(node.operator))
    ) {
      addDiagnostic(
        node,
        'UNSUPPORTED_OPERATOR',
        `The unary operator "${String(node.operator)}" is not supported.`,
      )
    }

    // Check update operators.
    if (
      node.type === 'UpdateExpression' &&
      !supportedUpdateOperators.has(String(node.operator))
    ) {
      addDiagnostic(
        node,
        'UNSUPPORTED_OPERATOR',
        `The update operator "${String(node.operator)}" is not supported.`,
      )
    }

    // Check assignment operators.
    if (
      node.type === 'AssignmentExpression' &&
      node.operator !== '='
    ) {
      addDiagnostic(
        node,
        'UNSUPPORTED_OPERATOR',
        `The assignment operator "${String(node.operator)}" is not supported.`,
      )
    }

    // Async and generator functions are not supported.
    if (
      node.type === 'FunctionDeclaration' &&
      (node.async === true || node.generator === true)
    ) {
      addDiagnostic(
        node,
        'UNSUPPORTED_FEATURE',
        'Async and generator functions are not supported.',
      )
    }

    // Visit child nodes.
    for (const child of Object.values(node)) {
      visit(child, node, depth + 1)
      if (resourceLimitExceeded) return
    }
  }

  visit(ast)

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics }
  }

  return { ok: true }
}