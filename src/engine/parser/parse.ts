
import { parse, type Program } from 'acorn'
import { RESOURCE_LIMITS } from '../resourceLimits'

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

function exceedsSourceSizeLimit(source: string): boolean {
  let byteLength = 0

  for (let index = 0; index < source.length; index += 1) {
    const characterCode = source.charCodeAt(index)

    if (characterCode <= 0x7f) {
      byteLength += 1
    } else if (characterCode <= 0x7ff) {
      byteLength += 2
    } else if (
      characterCode >= 0xd800 &&
      characterCode <= 0xdbff &&
      index + 1 < source.length &&
      source.charCodeAt(index + 1) >= 0xdc00 &&
      source.charCodeAt(index + 1) <= 0xdfff
    ) {
      byteLength += 4
      index += 1
    } else {
      byteLength += 3
    }

    if (byteLength > RESOURCE_LIMITS.maxSourceBytes) {
      return true
    }
  }

  return false
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
    if (error instanceof SyntaxError) {
      if (error.message.includes('Not enough stack space')) {
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
