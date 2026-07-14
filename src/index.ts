import { action, onEvent, withConnectHook } from '@reatom/core'
import type { GAction } from '@reatom/core'

import { compile } from './compile'
import { parse } from './parse'

const modifierFlags = [
  'altKey',
  'ctrlKey',
  'metaKey',
  'shiftKey',
] as const

export interface HotkeyOptions {
  document?: Document
  trigger?: 'keydown' | 'keyup'
  capture?: boolean
  repeat?: boolean
  editable?: boolean
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
  const compiled = compile(parse(hotkey))
  const {
    trigger = 'keydown',
    capture = false,
    repeat = true,
    editable = true,
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
      const suspendedModifiers = new Set<(typeof modifierFlags)[number]>()
      let armed = false
      let suspended = false

      const reset = () => {
        pressedCodes.clear()
        suspendedModifiers.clear()
        armed = false
        suspended = false
      }

      const isImeEvent = (event: KeyboardEvent) =>
        // IME boundary keydowns can fall just outside the composition session.
        event.isComposing || event.keyCode === 229

      const isIgnoredEditable = (event: KeyboardEvent) =>
        !editable && isEditableEvent(event)

      const suspend = (event: KeyboardEvent) => {
        suspended = true
        armed = false

        for (const flag of modifierFlags) {
          if (event[flag]) suspendedModifiers.add(flag)
        }
      }

      const updateSuspension = (event: KeyboardEvent) => {
        for (const flag of modifierFlags) {
          if (!event[flag]) suspendedModifiers.delete(flag)
        }

        if (pressedCodes.size === 0 && suspendedModifiers.size === 0) {
          suspended = false
        }
      }

      const acceptsRepeat = (event: KeyboardEvent) => repeat || !event.repeat

      const invoke = (event: KeyboardEvent) => {
        if (preventDefault) event.preventDefault()

        if (propagation === 'stop') event.stopPropagation()
        if (propagation === 'immediate') event.stopImmediatePropagation()

        hotkeyAction(event)
      }

      onEvent<KeyboardEvent>(
        targetDocument,
        'keydown',
        (event) => {
          if (isImeEvent(event)) {
            reset()
            return
          }

          pressedCodes.add(event.code)

          if (isIgnoredEditable(event)) {
            suspend(event)
            return
          }

          if (suspended) {
            updateSuspension(event)
            return
          }

          if (!compiled.match(event, pressedCodes)) return

          if (trigger === 'keydown') {
            if (!acceptsRepeat(event)) return
            invoke(event)
          } else {
            armed = true
          }
        },
        { capture },
      )
      onEvent<KeyboardEvent>(
        targetDocument,
        'keyup',
        (event) => {
          if (isImeEvent(event)) {
            reset()
            return
          }

          const releasedChordCode = compiled.hasCode(event.code)

          try {
            if (isIgnoredEditable(event)) {
              suspend(event)
              return
            }

            if (
              !suspended &&
              trigger === 'keyup' &&
              armed &&
              releasedChordCode &&
              pressedCodes.has(event.code) &&
              acceptsRepeat(event)
            ) {
              invoke(event)
            }
          } finally {
            pressedCodes.delete(event.code)
            if (releasedChordCode) armed = false
            if (suspended) updateSuspension(event)
          }
        },
        { capture },
      )
      onEvent(targetDocument, 'visibilitychange', reset)

      if (targetDocument.defaultView !== null) {
        onEvent(targetDocument.defaultView, 'blur', reset)
      }
    }),
  )
}
