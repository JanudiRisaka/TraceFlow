
import { describe, expect, it } from 'vitest'
import { createString } from './value'
import { RESOURCE_LIMITS } from '../resourceLimits'
import { ResourceLimitError } from '../ResourceLimitError'

describe('createString', () => {
  it('accepts a string within the configured limit', () => {
    expect(createString('TraceFlow')).toEqual({
      type: 'string',
      value: 'TraceFlow',
    })
  })

  it('accepts a string exactly at the configured limit', () => {
    const value = 'a'.repeat(RESOURCE_LIMITS.maxStringLength)

    expect(createString(value)).toEqual({
      type: 'string',
      value,
    })
  })

  it('rejects a string exceeding the configured limit', () => {
    const value = 'a'.repeat(
      RESOURCE_LIMITS.maxStringLength + 1,
    )

    expect(() => createString(value)).toThrow(ResourceLimitError)
  })

  it('measures string length using UTF-16 code units', () => {
    const value = '😀'.repeat(
      RESOURCE_LIMITS.maxStringLength / 2,
    )

    expect(value.length).toBe(RESOURCE_LIMITS.maxStringLength)

    expect(createString(value)).toEqual({
      type: 'string',
      value,
    })
  })

  it('rejects an emoji string exceeding the UTF-16 code-unit limit', () => {
  const value = '😀'.repeat(
    RESOURCE_LIMITS.maxStringLength / 2 + 1,
  )

  expect(() => createString(value)).toThrow(ResourceLimitError)
  })
})