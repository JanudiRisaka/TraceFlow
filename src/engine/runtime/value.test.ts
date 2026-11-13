
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
})