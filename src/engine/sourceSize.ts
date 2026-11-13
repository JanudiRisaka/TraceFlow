
import { RESOURCE_LIMITS } from './resourceLimits'

export function exceedsSourceSizeLimit(source: string): boolean {
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
