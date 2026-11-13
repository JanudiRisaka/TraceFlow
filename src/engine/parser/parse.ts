import { parse, type Program } from 'acorn'
import { RESOURCE_LIMITS } from '../resourceLimits'
import { exceedsSourceSizeLimit } from '../sourceSize'
import { isParserStackExhaustion } from './isParserStackExhaustion'

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
  if (exceedsSourceSizeLimit(source)) {
    return {
      ok: false,
      error: {
        message: `Source code exceeds the maximum allowed size of ${RESOURCE_LIMITS.maxSourceBytes} bytes.`,
        position: null,
        line: null,
        column: null,
      },
    }
  }

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
    if (isParserStackExhaustion(error)) {
      return {
        ok: false,
        error: {
          message: 'Source code exceeds the parser nesting limit.',
          position: null,
          line: null,
          column: null,
        },
      }
    }

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
          column: parserError.loc
            ? parserError.loc.column + 1
            : null,
        },
      }
    }

    throw error
  }
}