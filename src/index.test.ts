import { sleep, wrap } from '@reatom/core'
import type { GAction } from '@reatom/core'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { reatomHotkey } from './index'

const connect = async (hotkey: ReturnType<typeof reatomHotkey>) => {
  const listener = vi.fn()
  const unsubscribe = hotkey.subscribe(listener)

  await wrap(sleep())

  return { listener, unsubscribe }
}

const dispatchKeyboard = (
  target: EventTarget,
  type: 'keydown' | 'keyup',
  code: string,
  init: KeyboardEventInit = {},
) => {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    code,
    ...init,
  })

  target.dispatchEvent(event)
  return event
}

afterEach(async () => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
  await wrap(sleep())
})

describe('reatomHotkey', () => {
  test('returns a plain typed action with the native event as its payload', () => {
    const hotkey: GAction<(event: KeyboardEvent) => KeyboardEvent> =
      reatomHotkey('a')
    const event = new KeyboardEvent('keydown', { code: 'KeyA' })

    expect(hotkey(event)).toBe(event)
  })

  test('uses the 1.0.0 defaults', async () => {
    const input = document.createElement('input')
    document.body.append(input)
    const { listener, unsubscribe } = await connect(reatomHotkey('a'))
    const event = dispatchKeyboard(input, 'keydown', 'KeyA', { repeat: true })
    await wrap(sleep())

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(event, [event])
    expect(event.defaultPrevented).toBe(false)
    unsubscribe()
  })

  test('requires exact modifiers and a complete order-independent chord', async () => {
    const { listener, unsubscribe } = await connect(
      reatomHotkey('ctrl+shift+a+b'),
    )
    const modifiers = { ctrlKey: true, shiftKey: true }

    dispatchKeyboard(document, 'keydown', 'KeyB', modifiers)
    dispatchKeyboard(document, 'keydown', 'KeyA', {
      ...modifiers,
      altKey: true,
    })
    dispatchKeyboard(document, 'keydown', 'KeyA', modifiers)
    await wrap(sleep())

    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  test('tracks released keys and clears chord state on blur and visibilitychange', async () => {
    const { listener, unsubscribe } = await connect(reatomHotkey('a+b'))

    dispatchKeyboard(document, 'keydown', 'KeyA')
    dispatchKeyboard(document, 'keyup', 'KeyA')
    dispatchKeyboard(document, 'keydown', 'KeyB')
    await wrap(sleep())
    expect(listener).not.toHaveBeenCalled()
    dispatchKeyboard(document, 'keyup', 'KeyB')

    dispatchKeyboard(document, 'keydown', 'KeyA')
    window.dispatchEvent(new Event('blur'))
    dispatchKeyboard(document, 'keydown', 'KeyB')
    await wrap(sleep())
    expect(listener).not.toHaveBeenCalled()
    dispatchKeyboard(document, 'keyup', 'KeyB')

    dispatchKeyboard(document, 'keydown', 'KeyA')
    document.dispatchEvent(new Event('visibilitychange'))
    dispatchKeyboard(document, 'keydown', 'KeyB')
    await wrap(sleep())
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  test('can trigger on keyup before removing the released chord key', async () => {
    const { listener, unsubscribe } = await connect(
      reatomHotkey('a+b', { trigger: 'keyup' }),
    )

    dispatchKeyboard(document, 'keydown', 'KeyA')
    dispatchKeyboard(document, 'keydown', 'KeyB')
    expect(listener).not.toHaveBeenCalled()

    const event = dispatchKeyboard(document, 'keyup', 'KeyB')
    dispatchKeyboard(document, 'keyup', 'KeyA')
    await wrap(sleep())

    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0]?.[0]).toBe(event)
    unsubscribe()
  })

  test('listens only to the configured document', async () => {
    const pageDocument = document.implementation.createHTMLDocument()
    const { listener, unsubscribe } = await connect(
      reatomHotkey('a', { document: pageDocument }),
    )

    dispatchKeyboard(document, 'keydown', 'KeyA')
    expect(listener).not.toHaveBeenCalled()

    dispatchKeyboard(pageDocument, 'keydown', 'KeyA')
    await wrap(sleep())
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  test('uses the configured capture phase', async () => {
    const target = document.createElement('button')
    document.body.append(target)
    const observedAtTarget: boolean[] = []
    const captureHotkey = reatomHotkey('a', {
      capture: true,
      preventDefault: true,
    })
    const bubbleHotkey = reatomHotkey('b', { preventDefault: true })
    const unsubscribeCapture = captureHotkey.subscribe()
    const unsubscribeBubble = bubbleHotkey.subscribe()
    await wrap(sleep())
    target.addEventListener('keydown', (event) =>
      observedAtTarget.push(event.defaultPrevented),
    )

    dispatchKeyboard(target, 'keydown', 'KeyA')
    dispatchKeyboard(target, 'keydown', 'KeyB')

    expect(observedAtTarget).toEqual([true, false])
    unsubscribeCapture()
    unsubscribeBubble()
  })

  test('can ignore repeated events after matching', async () => {
    const { listener, unsubscribe } = await connect(
      reatomHotkey('a', {
        repeat: 'ignore',
        preventDefault: true,
        propagation: 'stop',
      }),
    )
    const event = dispatchKeyboard(document, 'keydown', 'KeyA', {
      repeat: true,
    })
    await wrap(sleep())

    expect(listener).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    unsubscribe()
  })

  test('can ignore form controls and contenteditable descendants', async () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    const editable = document.createElement('div')
    const editableChild = document.createElement('span')
    const button = document.createElement('button')
    editable.contentEditable = 'true'
    editable.append(editableChild)
    document.body.append(input, textarea, select, editable, button)
    const { listener, unsubscribe } = await connect(
      reatomHotkey('a', { editable: 'ignore' }),
    )

    for (const target of [input, textarea, select, editable, editableChild]) {
      dispatchKeyboard(target, 'keydown', 'KeyA')
    }
    await wrap(sleep())
    expect(listener).not.toHaveBeenCalled()

    dispatchKeyboard(button, 'keydown', 'KeyA')
    await wrap(sleep())
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  test('applies event side effects only after every filter accepts the event', async () => {
    const observed: Array<[boolean, number, number]> = []
    const hotkey = reatomHotkey('a', {
      repeat: 'ignore',
      preventDefault: true,
      propagation: 'immediate',
    })
    const unsubscribe = hotkey.subscribe((event) => {
      observed.push([
        event.defaultPrevented,
        preventDefault.mock.calls.length,
        stopImmediatePropagation.mock.calls.length,
      ])
    })
    await wrap(sleep())
    const accepted = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyA',
    })
    const preventDefault = vi.spyOn(accepted, 'preventDefault')
    const stopImmediatePropagation = vi.spyOn(
      accepted,
      'stopImmediatePropagation',
    )
    const unmatched = dispatchKeyboard(document, 'keydown', 'KeyB')
    const repeated = dispatchKeyboard(document, 'keydown', 'KeyA', {
      repeat: true,
    })

    document.dispatchEvent(accepted)
    await wrap(sleep())

    expect(unmatched.defaultPrevented).toBe(false)
    expect(repeated.defaultPrevented).toBe(false)
    expect(observed).toEqual([[true, 1, 1]])
    unsubscribe()
  })

  test.each([
    ['allow', true, true],
    ['stop', true, false],
    ['immediate', false, false],
  ] as const)(
    'supports %s propagation',
    async (propagation, reachesDocumentPeer, reachesWindow) => {
      const { unsubscribe } = await connect(
        reatomHotkey('a', { propagation }),
      )
      const documentPeer = vi.fn()
      const windowListener = vi.fn()
      document.addEventListener('keydown', documentPeer)
      window.addEventListener('keydown', windowListener)

      dispatchKeyboard(document.body, 'keydown', 'KeyA')

      expect(documentPeer).toHaveBeenCalledTimes(reachesDocumentPeer ? 1 : 0)
      expect(windowListener).toHaveBeenCalledTimes(reachesWindow ? 1 : 0)
      document.removeEventListener('keydown', documentPeer)
      window.removeEventListener('keydown', windowListener)
      unsubscribe()
    },
  )

  test('supports custom and compatible default action names', () => {
    expect(reatomHotkey(' Ctrl+a ').name).toBe('hotkey.ctrl+a')
    expect(reatomHotkey('a', { name: 'youtube.replayHotkey' }).name).toBe(
      'youtube.replayHotkey',
    )
  })

  test('connects lazily, shares one connection, and disconnects cleanly', async () => {
    const hotkey = reatomHotkey('a')
    const first = vi.fn()
    const second = vi.fn()

    dispatchKeyboard(document, 'keydown', 'KeyA')
    expect(first).not.toHaveBeenCalled()

    const unsubscribeFirst = hotkey.subscribe(first)
    const unsubscribeSecond = hotkey.subscribe(second)
    await wrap(sleep())
    dispatchKeyboard(document, 'keydown', 'KeyA')
    await wrap(sleep())

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()

    unsubscribeFirst()
    dispatchKeyboard(document, 'keydown', 'KeyA')
    await wrap(sleep())
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledTimes(2)

    unsubscribeSecond()
    await wrap(sleep())
    dispatchKeyboard(document, 'keydown', 'KeyA')
    expect(second).toHaveBeenCalledTimes(2)
  })

  test('does not retain pressed chord state after reconnecting', async () => {
    const hotkey = reatomHotkey('a+b')
    const first = await connect(hotkey)

    dispatchKeyboard(document, 'keydown', 'KeyA')
    first.unsubscribe()
    await wrap(sleep())

    const second = await connect(hotkey)
    dispatchKeyboard(document, 'keydown', 'KeyB')
    await wrap(sleep())

    expect(second.listener).not.toHaveBeenCalled()
    second.unsubscribe()
  })
})
