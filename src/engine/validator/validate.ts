
import type { Program } from 'acorn'

export type ValidationDiagnostic = {
  code: 'UNSUPPORTED_SYNTAX' | 'UNSUPPORTED_OPERATOR' | 'UNSUPPORTED_FEATURE'
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
      // Acorn columns start at 0. We report columns starting at 1.
      column: node.loc ? node.loc.start.column + 1 : null,
    })
  }

  function visit(
    value: unknown,
    parent: AstNode | null = null,
  ) {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, parent))
      return
    }

    if (!isAstNode(value)) {
      return
    }

    const node = value

    if (
  node.type === 'MemberExpression' &&
  !isAllowedConsoleLogCall(node, parent)
) {
  addDiagnostic(
    node,
    'UNSUPPORTED_SYNTAX',
    'TraceFlow only supports console.log() for member expressions.',
  )
}

    const isAllowedMemberExpression =
  node.type === 'MemberExpression' &&
  isAllowedConsoleLogCall(node, parent)

if (!supportedNodeTypes.has(node.type) && !isAllowedMemberExpression) {
  addDiagnostic(
    node,
    'UNSUPPORTED_SYNTAX',
    node.type === 'MemberExpression'
      ? 'TraceFlow only supports console.log() for member expressions.'
      : `TraceFlow does not support "${node.type}" syntax yet.`,
  )
}

    if (
      node.type === 'VariableDeclaration' &&
      node.kind !== 'let' &&
      node.kind !== 'const'
    ) {
      addDiagnostic(
        node,
        'UNSUPPORTED_FEATURE',
        'TraceFlow supports let and const declarations, but not var.',
      )
    }

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

    if (
      node.type === 'FunctionDeclaration' &&
      (node.async === true || node.generator === true)
    ) {
      addDiagnostic(
        node,
        'UNSUPPORTED_FEATURE',
        'TraceFlow supports synchronous functions, not async or generator functions.',
      )
    }

    // Inspect child nodes too. This catches unsupported syntax nested
    // inside otherwise supported statements and expressions.
    for (const child of Object.values(node)) {
      visit(child, node)
    }
  }

  visit(ast)

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics }
  }

  return { ok: true }
}
