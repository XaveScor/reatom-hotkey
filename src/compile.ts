import type { Entry, Modifier } from './parse'

export type Matcher = (
  event: KeyboardEvent,
  pressedCodes: ReadonlySet<string>,
) => boolean

export const compile = (entries: readonly Entry[]): Matcher => {
  const modifiers = new Set<Modifier>()
  const codes = new Set<string>()

  for (const entry of entries) {
    if (entry.type === 'modifier') {
      modifiers.add(entry.modifier)
    } else {
      codes.add(entry.code)
    }
  }

  const requiredCodes = [...codes]

  return (event, pressedCodes) =>
    codes.has(event.code) &&
    event.altKey === modifiers.has('alt') &&
    event.ctrlKey === modifiers.has('ctrl') &&
    event.metaKey === modifiers.has('meta') &&
    event.shiftKey === modifiers.has('shift') &&
    requiredCodes.every((code) => pressedCodes.has(code))
}
