
import { parse, type Program } from 'acorn'

export type ParseError = {
  message: string
  position: number | null
  line: number | null
  column: number | null
}

export type ParseResult =
  | {
      ok: true
      ast: Program
    }
  | {
      ok: false
      error: ParseError
    }

export function parseJavaScript(source: string): ParseResult {
  try {
    const ast = parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      locations: true,
    })

    return {
      ok: true,
      ast,
    }
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      const parserError = error as SyntaxError & {
        pos?: number
        loc?: {
          line: number
          column: number
        }
      }

      return {
        ok: false,
        error: {
          message: parserError.message,
          position: parserError.pos ?? null,
          line: parserError.loc?.line ?? null,
          // Acorn columns start at 0; we report columns starting at 1.
          column: parserError.loc
            ? parserError.loc.column + 1
            : null,
        },
      }
    }

    // Unexpected errors should not be disguised as syntax errors.
    throw error
  }
}
