import { describe, expect, test } from 'vitest'

import { compile } from './compile'
import type { Entry } from './parse'

const event = (
  code: string,
  init: KeyboardEventInit = {},
): KeyboardEvent => new KeyboardEvent('keydown', { code, ...init })

describe('compile', () => {
  test('matches a key with an exact set of modifiers', () => {
    const entries: Entry[] = [
      { type: 'modifier', modifier: 'ctrl' },
      { type: 'modifier', modifier: 'shift' },
      { type: 'key', code: 'KeyA' },
    ]
    const match = compile(entries)
    const pressedCodes = new Set(['KeyA'])

    expect(
      match(event('KeyA', { ctrlKey: true, shiftKey: true }), pressedCodes),
    ).toBe(true)
    expect(match(event('KeyA', { ctrlKey: true }), pressedCodes)).toBe(false)
    expect(
      match(
        event('KeyA', { altKey: true, ctrlKey: true, shiftKey: true }),
        pressedCodes,
      ),
    ).toBe(false)
  })

  test('requires every chord key to be pressed', () => {
    const match = compile([
      { type: 'key', code: 'KeyA' },
      { type: 'key', code: 'KeyB' },
    ])

    expect(match(event('KeyB'), new Set(['KeyA', 'KeyB']))).toBe(true)
    expect(match(event('KeyB'), new Set(['KeyB']))).toBe(false)
  })

  test('requires the current event to belong to the chord', () => {
    const match = compile([
      { type: 'key', code: 'KeyA' },
      { type: 'key', code: 'KeyB' },
    ])

    expect(match(event('KeyC'), new Set(['KeyA', 'KeyB', 'KeyC']))).toBe(
      false,
    )
  })
})
