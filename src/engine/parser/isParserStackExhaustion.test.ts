
import { describe, expect, it } from 'vitest'
import { isParserStackExhaustion } from './isParserStackExhaustion'

describe('isParserStackExhaustion', () => {
  it.each([
    'Not enough stack space',
    'Maximum call stack size exceeded',
    'too much recursion',
  ])('recognizes stack exhaustion: %s', (message) => {
    expect(isParserStackExhaustion(new RangeError(message))).toBe(true)
  })

  it('does not classify unrelated RangeErrors as stack exhaustion', () => {
    expect(
      isParserStackExhaustion(new RangeError('Invalid array length')),
    ).toBe(false)
  })

  it('does not classify ordinary errors as stack exhaustion', () => {
    expect(
      isParserStackExhaustion(new Error('Something went wrong')),
    ).toBe(false)
  })

  it('does not classify non-error values as stack exhaustion', () => {
    expect(isParserStackExhaustion('Maximum call stack size exceeded')).toBe(
      false,
    )
  })
})
