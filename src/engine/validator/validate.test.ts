
import { describe, expect, it } from 'vitest'
import { parseJavaScript } from '../parser/parse'
import { validateJavaScript } from './validate'

function validateSource(source: string) {
  const parseResult = parseJavaScript(source)

  if (parseResult.ok === false) {
    throw new Error('Test source contains invalid JavaScript.')
  }

  return validateJavaScript(parseResult.ast)
}

describe('validateJavaScript', () => {
  it('accepts supported variable declarations', () => {
    const result = validateSource(`
      let score = 10;
      const limit = 20;
      score = score + 5;
    `)

    expect(result).toEqual({ ok: true })
  })

  it('accepts a for loop', () => {
    const result = validateSource(`
      for (let i = 0; i < 5; i++) {
        let total = i + 1;
      }
    `)

    expect(result).toEqual({ ok: true })
  })

  it('accepts if and else statements', () => {
    const result = validateSource(`
      let age = 20;

      if (age >= 18) {
        age = age + 1;
      } else {
        age = 0;
      }
    `)

    expect(result).toEqual({ ok: true })
  })

  it('rejects while loops', () => {
    const result = validateSource(`
      while (true) {
        break;
      }
    `)

    expect(result.ok).toBe(false)
  })

  it('rejects arrow functions', () => {
    const result = validateSource(`
      const greet = () => "Hello";
    `)

    expect(result.ok).toBe(false)
  })

  it('rejects unsupported syntax nested inside another expression', () => {
    const result = validateSource(`
      let calculate = function () {
        return 10;
      };
    `)

    expect(result.ok).toBe(false)
  })

  it('rejects unsupported operators', () => {
    const result = validateSource(`
      let result = 2 ** 3;
    `)

    expect(result.ok).toBe(false)
  })

  it('reports the line of unsupported syntax', () => {
    const result = validateSource(`
      let score = 10;
      while (score > 0) {
        score = score - 1;
      }
    `)

    expect(result.ok).toBe(false)

    if (result.ok === false) {
      expect(result.diagnostics[0].line).toBe(3)
    }
  })


  it('accepts console.log with a string argument', () => {
    const result = validateSource(`
      console.log("Hello");
    `)

    expect(result).toEqual({ ok: true })
  })

  it('accepts console.log with a number argument', () => {
    const result = validateSource(`
      console.log(10);
    `)

    expect(result).toEqual({ ok: true })
  })

  it('accepts console.log with a variable argument', () => {
    const result = validateSource(`
      let score = 10;
      console.log(score);
    `)

    expect(result).toEqual({ ok: true })
  })

  it('accepts console.log inside a function', () => {
    const result = validateSource(`
      function greet(name) {
        console.log("Hello", name);
      }

      greet("TraceFlow");
    `)

    expect(result).toEqual({ ok: true })
  })

  it('rejects console.error', () => {
    const result = validateSource(`
      console.error("Hello");
    `)

    expect(result.ok).toBe(false)
  })

  it('rejects computed console property access', () => {
    const result = validateSource(`
      console["log"]("Hello");
    `)

    expect(result.ok).toBe(false)
  })

  it('rejects console.log without calling it', () => {
    const result = validateSource(`
      console.log;
    `)

    expect(result.ok).toBe(false)
  })

  it('rejects arbitrary object property access', () => {
    const result = validateSource(`
      window.location;
    `)

    expect(result.ok).toBe(false)
  })

  
})
