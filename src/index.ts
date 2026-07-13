import { action, onEvent, withConnectHook } from '@reatom/core'

import { compile } from './compile'
import { parse } from './parse'

/** Creates a lazily connected action for a physical keyboard shortcut. */
export const reatomHotkey = (hotkey: string) => {
  const match = compile(parse(hotkey))
  const hotkeyAction = action(
    (event: KeyboardEvent) => event,
    `hotkey.${hotkey.trim().toLowerCase()}`,
  )

  return hotkeyAction.extend(
    withConnectHook(() => {
      if (typeof document === 'undefined') return

      const pressedCodes = new Set<string>()

      onEvent<KeyboardEvent>(document, 'keydown', (event) => {
        pressedCodes.add(event.code)

        if (match(event, pressedCodes)) {
          hotkeyAction(event)
        }
      })
      onEvent<KeyboardEvent>(document, 'keyup', (event) => {
        pressedCodes.delete(event.code)
      })
      onEvent(document, 'visibilitychange', () => pressedCodes.clear())

      if (document.defaultView !== null) {
        onEvent(document.defaultView, 'blur', () => pressedCodes.clear())
      }
    }),
  )
}
