import { action, onEvent, withConnectHook } from '@reatom/core'
import type { GAction } from '@reatom/core'

import { compile } from './compile'
import { parse } from './parse'

export interface HotkeyOptions {
  document?: Document
  trigger?: 'keydown' | 'keyup'
  capture?: boolean
  repeat?: 'allow' | 'ignore'
  editable?: 'allow' | 'ignore'
  preventDefault?: boolean
  propagation?: 'allow' | 'stop' | 'immediate'
  name?: string
}

const isEditableEvent = (event: KeyboardEvent): boolean => {
  const path = event.composedPath()
  const targets = path.length === 0 ? [event.target] : path

  return targets.some((target) => {
    if (target === null || typeof target !== 'object') return false

    const element = target as {
      isContentEditable?: unknown
      tagName?: unknown
    }

    return (
      element.isContentEditable === true ||
      (typeof element.tagName === 'string' &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName.toUpperCase()))
    )
  })
}

/** Creates a lazily connected action for a physical keyboard shortcut. */
export const reatomHotkey = (
  hotkey: string,
  options: HotkeyOptions = {},
): GAction<(event: KeyboardEvent) => KeyboardEvent> => {
  const match = compile(parse(hotkey))
  const {
    trigger = 'keydown',
    capture = false,
    repeat = 'allow',
    editable = 'allow',
    preventDefault = false,
    propagation = 'allow',
    name = `hotkey.${hotkey.trim().toLowerCase()}`,
  } = options
  const hotkeyAction = action(
    (event: KeyboardEvent) => event,
    name,
  )

  return hotkeyAction.extend(
    withConnectHook(() => {
      const targetDocument = options.document ?? globalThis.document
      if (targetDocument === undefined) return

      const pressedCodes = new Set<string>()

      const accept = (event: KeyboardEvent) => {
        if (!match(event, pressedCodes)) return
        if (repeat === 'ignore' && event.repeat) return
        if (editable === 'ignore' && isEditableEvent(event)) return

        if (preventDefault) event.preventDefault()

        if (propagation === 'stop') event.stopPropagation()
        if (propagation === 'immediate') event.stopImmediatePropagation()

        hotkeyAction(event)
      }

      onEvent<KeyboardEvent>(
        targetDocument,
        'keydown',
        (event) => {
          pressedCodes.add(event.code)

          if (trigger === 'keydown') accept(event)
        },
        { capture },
      )
      onEvent<KeyboardEvent>(
        targetDocument,
        'keyup',
        (event) => {
          try {
            if (trigger === 'keyup') accept(event)
          } finally {
            pressedCodes.delete(event.code)
          }
        },
        { capture },
      )
      onEvent(targetDocument, 'visibilitychange', () => pressedCodes.clear())

      if (targetDocument.defaultView !== null) {
        onEvent(targetDocument.defaultView, 'blur', () => pressedCodes.clear())
      }
    }),
  )
}
