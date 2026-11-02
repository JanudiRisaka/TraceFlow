
import { describe, expect, it } from 'vitest'
import { parseJavaScript } from './parse'

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
})
