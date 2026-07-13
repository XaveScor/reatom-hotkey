import { action, onEvent, withConnectHook } from '@reatom/core'

const modifierAliases = {
  alt: 'alt',
  control: 'ctrl',
  ctrl: 'ctrl',
  meta: 'meta',
  shift: 'shift',
} as const

type Modifier = (typeof modifierAliases)[keyof typeof modifierAliases]

const namedCodes = [
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Backquote',
  'Backslash',
  'Backspace',
  'BracketLeft',
  'BracketRight',
  'CapsLock',
  'Comma',
  'ContextMenu',
  'Delete',
  'End',
  'Enter',
  'Equal',
  'Escape',
  'Home',
  'Insert',
  'IntlBackslash',
  'IntlRo',
  'IntlYen',
  'Minus',
  'NumLock',
  'PageDown',
  'PageUp',
  'Pause',
  'Period',
  'PrintScreen',
  'Quote',
  'ScrollLock',
  'Semicolon',
  'Slash',
  'Space',
  'Tab',
] as const

const codeByToken = new Map<string, string>(
  namedCodes.map((code) => [code.toLowerCase(), code]),
)

for (let index = 1; index <= 24; index++) {
  codeByToken.set(`f${index}`, `F${index}`)
}

for (let index = 0; index <= 9; index++) {
  codeByToken.set(`digit${index}`, `Digit${index}`)
  codeByToken.set(`numpad${index}`, `Numpad${index}`)
}

for (let index = 0; index < 26; index++) {
  const letter = String.fromCharCode(97 + index)
  codeByToken.set(letter, `Key${letter.toUpperCase()}`)
  codeByToken.set(`key${letter}`, `Key${letter.toUpperCase()}`)
}

const codeAliases: Record<string, string> = {
  down: 'ArrowDown',
  esc: 'Escape',
  left: 'ArrowLeft',
  return: 'Enter',
  right: 'ArrowRight',
  up: 'ArrowUp',
}

for (const [alias, code] of Object.entries(codeAliases)) {
  codeByToken.set(alias, code)
}

const punctuationCodes: Record<string, string> = {
  ',': 'Comma',
  '-': 'Minus',
  '.': 'Period',
  '/': 'Slash',
  ';': 'Semicolon',
  '=': 'Equal',
  '[': 'BracketLeft',
  '\\': 'Backslash',
  ']': 'BracketRight',
  '`': 'Backquote',
  "'": 'Quote',
}

for (const [key, code] of Object.entries(punctuationCodes)) {
  codeByToken.set(key, code)
}

const parseHotkey = (hotkey: string) => {
  if ([...hotkey].some((character) => character.charCodeAt(0) > 0x7f)) {
    throw new TypeError('Hotkey must contain ASCII characters only')
  }

  const normalized = hotkey.trim().toLowerCase()

  if (normalized === '') {
    throw new TypeError('Hotkey must not be empty')
  }

  const codes = new Set<string>()
  const modifiers = new Set<Modifier>()

  for (const part of normalized.split('+')) {
    const token = part.trim()

    if (token === '') {
      throw new TypeError(`Invalid hotkey: "${hotkey}"`)
    }

    if (token in modifierAliases) {
      const modifier = modifierAliases[token as keyof typeof modifierAliases]

      if (modifiers.has(modifier)) {
        throw new TypeError(`Duplicate key in hotkey: "${token}"`)
      }

      modifiers.add(modifier)
      continue
    }

    const code = /^[0-9]$/.test(token)
      ? `Digit${token}`
      : codeByToken.get(token)

    if (code === undefined || code === '') {
      throw new TypeError(`Unknown key in hotkey: "${token}"`)
    }

    if (codes.has(code)) {
      throw new TypeError(`Duplicate key in hotkey: "${token}"`)
    }

    codes.add(code)
  }

  if (codes.size === 0) {
    throw new TypeError('Hotkey must contain at least one non-modifier key')
  }

  return { codes, modifiers, normalized }
}

const hasExactModifiers = (
  event: KeyboardEvent,
  modifiers: ReadonlySet<Modifier>,
) =>
  event.altKey === modifiers.has('alt') &&
  event.ctrlKey === modifiers.has('ctrl') &&
  event.metaKey === modifiers.has('meta') &&
  event.shiftKey === modifiers.has('shift')

/** Creates a lazily connected action for a physical keyboard shortcut. */
export const reatomHotkey = (hotkey: string) => {
  const { codes, modifiers, normalized } = parseHotkey(hotkey)
  const hotkeyAction = action(
    (event: KeyboardEvent) => event,
    `hotkey.${normalized}`,
  )

  return hotkeyAction.extend(
    withConnectHook(() => {
      if (typeof document === 'undefined') return

      const pressedCodes = new Set<string>()

      onEvent<KeyboardEvent>(document, 'keydown', (event) => {
        pressedCodes.add(event.code)

        if (
          codes.has(event.code) &&
          hasExactModifiers(event, modifiers) &&
          [...codes].every((code) => pressedCodes.has(code))
        ) {
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
