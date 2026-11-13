import { describe, expect, it } from 'vitest'
import { parseJavaScript } from './parse'
import { RESOURCE_LIMITS } from '../resourceLimits'

describe('parseJavaScript', () => {
    it('parses a variable declaration', () => {
        const result = parseJavaScript('let score = 10')

        expect(result.ok).toBe(true)

        if (result.ok) {
        expect(result.ast.type).toBe('Program')
        expect(result.ast.body).toHaveLength(1)
        expect(result.ast.body[0].type).toBe('VariableDeclaration')
        }
    })

    it('parses a function declaration', () => {
        const result = parseJavaScript(
        'function greet(name) { return name }',
        )

        expect(result.ok).toBe(true)

        if (result.ok) {
        expect(result.ast.body[0].type).toBe('FunctionDeclaration')
        }
    })


    it('returns an error for invalid JavaScript', () => {
    const result = parseJavaScript('let = ;')

    expect(result.ok).toBe(false)

    if (result.ok === false) {
        expect(result.error.message).toBeTruthy()
        expect(result.error.line).not.toBeNull()
    }
    })

    it('records source locations', () => {
        const result = parseJavaScript('let score = 10\nlet bonus = 5')

        expect(result.ok).toBe(true)

        if (result.ok) {
        const firstStatement = result.ast.body[0]
        const secondStatement = result.ast.body[1]

        expect(firstStatement.loc?.start.line).toBe(1)
        expect(secondStatement.loc?.start.line).toBe(2)
        }
    })

    it('accepts empty source code', () => {
        const result = parseJavaScript('')

        expect(result.ok).toBe(true)

        if (result.ok) {
        expect(result.ast.body).toHaveLength(0)
        }
    })

    it('accepts source code at the maximum byte limit', () => {
    const source = ' '.repeat(RESOURCE_LIMITS.maxSourceBytes)
    const result = parseJavaScript(source)

    expect(result.ok).toBe(true)
    })

    it('rejects source code exceeding the maximum byte limit', () => {
    const source = ' '.repeat(RESOURCE_LIMITS.maxSourceBytes + 1)
    const result = parseJavaScript(source)

    expect(result.ok).toBe(false)

    if (result.ok === false) {
        expect(result.error.message).toContain(
        'Source code exceeds the maximum allowed size',
        )
    }
    })


it('accepts UTF-8 source code at the maximum byte limit', () => {
  const maxBytes = RESOURCE_LIMITS.maxSourceBytes
  const commentOverhead = 4 // /* and */
  const contentBytes = maxBytes - commentOverhead

  const source =
    '/*' +
    '€'.repeat(Math.floor(contentBytes / 3)) +
    ' '.repeat(contentBytes % 3) +
    '*/'

  const result = parseJavaScript(source)

  expect(result.ok).toBe(true)
})

it('rejects UTF-8 source code exceeding the maximum byte limit', () => {
  const maxBytes = RESOURCE_LIMITS.maxSourceBytes
  const commentOverhead = 4
  const contentBytes = maxBytes - commentOverhead

  const source =
    '/*' +
    '€'.repeat(Math.floor(contentBytes / 3)) +
    ' '.repeat(contentBytes % 3) +
    '*/ '

  const result = parseJavaScript(source)

  expect(result.ok).toBe(false)
})


    it('returns an error for excessively nested expressions', () => {
  const source =
    'let value = ' +
    '('.repeat(5_000) +
    '1' +
    ')'.repeat(5_000) +
    ';'

  const result = parseJavaScript(source)

  expect(result.ok).toBe(false)

  if (result.ok === false) {
    expect(result.error.message).toContain(
      'parser nesting limit',
    )
  }
})
})
