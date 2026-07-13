import { userEvent } from '@vitest/browser/context'
import { sleep, wrap } from '@reatom/core'
import { describe, expect, test, vi } from 'vitest'

import { reatomHotkey } from './index'

const connect = async (hotkey: ReturnType<typeof reatomHotkey>) => {
  const listener = vi.fn()
  const unsubscribe = hotkey.subscribe(listener)

  await wrap(sleep())

  return { listener, unsubscribe }
}

describe('reatomHotkey', () => {
  test('rejects non-ASCII and invalid hotkeys synchronously', () => {
    expect(() => reatomHotkey('ф')).toThrowError(
      'Hotkey must contain ASCII characters only',
    )
    expect(() => reatomHotkey('shift+🔥')).toThrow(TypeError)
    expect(() => reatomHotkey('')).toThrowError('Hotkey must not be empty')
    expect(() => reatomHotkey('ctrl++a')).toThrowError('Invalid hotkey')
    expect(() => reatomHotkey('ctrl+control+a')).toThrowError('Duplicate key')
    expect(() => reatomHotkey('shift')).toThrowError(
      'Hotkey must contain at least one non-modifier key',
    )
    expect(() => reatomHotkey('unknown')).toThrowError('Unknown key')
  })

  test('matches browser keyboard events and returns the native event', async () => {
    const { listener, unsubscribe } = await connect(reatomHotkey('a'))

    await userEvent.keyboard('a')

    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0]?.[0]).toBeInstanceOf(KeyboardEvent)
    expect(listener.mock.calls[0]?.[0].code).toBe('KeyA')
    unsubscribe()
  })

  test('maps digits, aliases, canonical codes, and punctuation', async () => {
    const shortcuts = [
      ['1', '1'],
      ['esc', '{Escape}'],
      ['arrowleft', '{ArrowLeft}'],
      ['f12', '{F12}'],
      ['numpad1', '{Numpad1}'],
      ['/', '/'],
    ] as const

    for (const [shortcut, keys] of shortcuts) {
      const { listener, unsubscribe } = await connect(reatomHotkey(shortcut))

      await userEvent.keyboard(keys)

      expect(listener, shortcut).toHaveBeenCalledOnce()
      unsubscribe()
      await wrap(sleep())
    }
  })

  test('requires an exact set of modifiers', async () => {
    const { listener, unsubscribe } = await connect(
      reatomHotkey('ctrl+shift+a'),
    )

    await userEvent.keyboard('{Control>}{Shift>}a{/Shift}{/Control}')
    await userEvent.keyboard('{Control>}{Shift>}{Alt>}a{/Alt}{/Shift}{/Control}')
    await userEvent.keyboard('a')

    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  test('matches order-independent chords and tracks released keys', async () => {
    const { listener, unsubscribe } = await connect(reatomHotkey('a+b'))

    await userEvent.keyboard('{b>}')
    expect(listener).not.toHaveBeenCalled()

    await userEvent.keyboard('{a>}')
    expect(listener).toHaveBeenCalledOnce()

    await userEvent.keyboard('{/b}')
    await userEvent.keyboard('{a>3}')
    expect(listener).toHaveBeenCalledOnce()

    await userEvent.keyboard('{b>}')
    expect(listener).toHaveBeenCalledTimes(2)

    await userEvent.keyboard('{/a}{/b}')
    unsubscribe()
  })

  test('clears pressed chord keys when the window loses focus', async () => {
    const { listener, unsubscribe } = await connect(reatomHotkey('a+b'))

    await userEvent.keyboard('{a>}')
    window.dispatchEvent(new Event('blur'))
    await userEvent.keyboard('b')
    await userEvent.keyboard('{/a}')

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  test('connects lazily and disconnects after the last subscriber', async () => {
    const hotkey = reatomHotkey('a')
    const first = vi.fn()
    const second = vi.fn()

    await userEvent.keyboard('a')
    expect(first).not.toHaveBeenCalled()

    const unsubscribeFirst = hotkey.subscribe(first)
    const unsubscribeSecond = hotkey.subscribe(second)
    await wrap(sleep())
    await userEvent.keyboard('a')

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()

    unsubscribeFirst()
    await userEvent.keyboard('a')
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledTimes(2)

    unsubscribeSecond()
    await wrap(sleep())
    await userEvent.keyboard('a')
    expect(second).toHaveBeenCalledTimes(2)
  })
})
