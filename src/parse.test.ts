import { describe, expect, test } from 'vitest'

import { parse } from './parse'

describe('parse', () => {
  test('returns normalized discriminated entries in source order', () => {
    expect(parse('Control + Shift + a + b')).toEqual([
      { type: 'modifier', modifier: 'ctrl' },
      { type: 'modifier', modifier: 'shift' },
      { type: 'key', code: 'KeyA' },
      { type: 'key', code: 'KeyB' },
    ])
  })

  test('maps digits, aliases, canonical codes, and punctuation', () => {
    const shortcuts = [
      ['1', 'Digit1'],
      ['esc', 'Escape'],
      ['arrowleft', 'ArrowLeft'],
      ['f12', 'F12'],
      ['numpad1', 'Numpad1'],
      ['/', 'Slash'],
    ] as const

    for (const [shortcut, code] of shortcuts) {
      expect(parse(shortcut), shortcut).toEqual([{ type: 'key', code }])
    }
  })

  test('rejects non-ASCII and invalid hotkeys', () => {
    expect(() => parse('ф')).toThrowError(
      'Hotkey must contain ASCII characters only',
    )
    expect(() => parse('shift+🔥')).toThrow(TypeError)
    expect(() => parse('')).toThrowError('Hotkey must not be empty')
    expect(() => parse('ctrl++a')).toThrowError('Invalid hotkey')
    expect(() => parse('ctrl+A')).toThrowError(
      'Uppercase key "A" is ambiguous because it may imply Shift. Please use the lowercase version: "a".',
    )
    expect(() => parse('ctrl+control+a')).toThrowError('Duplicate key')
    expect(() => parse('a+keya')).toThrowError('Duplicate key')
    expect(() => parse('shift')).toThrowError(
      'Hotkey must contain at least one non-modifier key',
    )
    expect(() => parse('unknown')).toThrowError('Unknown key')
  })
})
