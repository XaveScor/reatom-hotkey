export type Modifier = 'alt' | 'ctrl' | 'meta' | 'shift'

export type ModifierEntry = {
  type: 'modifier'
  modifier: Modifier
}

export type KeyEntry = {
  type: 'key'
  code: KeyboardEvent['code']
}

export type Entry = ModifierEntry | KeyEntry

const modifierAliases = {
  alt: 'alt',
  control: 'ctrl',
  ctrl: 'ctrl',
  meta: 'meta',
  shift: 'shift',
} as const satisfies Record<string, Modifier>

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

export const parse = (input: string): readonly Entry[] => {
  if ([...input].some((character) => character.charCodeAt(0) > 0x7f)) {
    throw new TypeError('Hotkey must contain ASCII characters only')
  }

  const normalized = input.trim()

  if (normalized === '') {
    throw new TypeError('Hotkey must not be empty')
  }

  const entries: Entry[] = []
  const modifiers = new Set<Modifier>()
  const codes = new Set<string>()

  for (const part of normalized.split('+')) {
    const rawToken = part.trim()

    if (rawToken === '') {
      throw new TypeError(`Invalid hotkey: "${input}"`)
    }

    if (/^[A-Z]$/.test(rawToken)) {
      throw new TypeError(
        `Uppercase key "${rawToken}" is ambiguous because it may imply Shift. Please use the lowercase version: "${rawToken.toLowerCase()}".`,
      )
    }

    const token = rawToken.toLowerCase()

    if (token in modifierAliases) {
      const modifier = modifierAliases[token as keyof typeof modifierAliases]

      if (modifiers.has(modifier)) {
        throw new TypeError(`Duplicate key in hotkey: "${token}"`)
      }

      modifiers.add(modifier)
      entries.push({ type: 'modifier', modifier })
      continue
    }

    const code = /^[0-9]$/.test(token)
      ? `Digit${token}`
      : codeByToken.get(token)

    if (code === undefined) {
      throw new TypeError(`Unknown key in hotkey: "${token}"`)
    }

    if (codes.has(code)) {
      throw new TypeError(`Duplicate key in hotkey: "${token}"`)
    }

    codes.add(code)
    entries.push({ type: 'key', code })
  }

  if (codes.size === 0) {
    throw new TypeError('Hotkey must contain at least one non-modifier key')
  }

  return entries
}
