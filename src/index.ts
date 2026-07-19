import { action, onEvent, withConnectHook } from '@reatom/core'
import type { GAction } from '@reatom/core'

import { compile } from './compile'
import { parse } from './parse'

type ModifierFlag = 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

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

const isEditableTarget = (target: unknown): boolean => {
  if (target === null || typeof target !== 'object') return false

  const element = target as {
    isContentEditable?: unknown
    tagName?: unknown
  }

  return (
    element.isContentEditable === true ||
    (typeof element.tagName === 'string' &&
      EDITABLE_TAGS.has(element.tagName.toUpperCase()))
  )
}

const isEditableEvent = (event: KeyboardEvent): boolean => {
  const path = event.composedPath()

  if (path.length === 0) return isEditableTarget(event.target)

  for (let index = 0; index < path.length; index++) {
    if (isEditableTarget(path[index])) return true
  }

  return false
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
      const suspendedModifiers = new Set<ModifierFlag>()
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

        if (event.altKey) suspendedModifiers.add('altKey')
        if (event.ctrlKey) suspendedModifiers.add('ctrlKey')
        if (event.metaKey) suspendedModifiers.add('metaKey')
        if (event.shiftKey) suspendedModifiers.add('shiftKey')
      }

      const updateSuspension = (event: KeyboardEvent) => {
        if (!event.altKey) suspendedModifiers.delete('altKey')
        if (!event.ctrlKey) suspendedModifiers.delete('ctrlKey')
        if (!event.metaKey) suspendedModifiers.delete('metaKey')
        if (!event.shiftKey) suspendedModifiers.delete('shiftKey')

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
