# @xavescor/reatom-hotkey

Physical keyboard shortcuts as lazy, typed Reatom actions.

Declare `ctrl+s` or an order-independent `a+b` chord and observe it like any
other Reatom action. The library owns keyboard state and DOM listener lifecycle
while application behavior stays in regular Reatom effects and actions.

- **Layout-independent** physical shortcuts based on `KeyboardEvent.code`.
- **Order-independent chords** with exact modifiers.
- **Lazy listeners** with automatic cleanup.
- **Native events** as action payloads.
- **Full event control** for keydown, keyup, repeat, capture and propagation.
- **IME-safe, SSR-safe and iframe-ready.**

## Installation

```sh
npm install @xavescor/reatom-hotkey
```

## Usage

```ts
import { effect, getCalls } from '@reatom/core'
import { reatomHotkey } from '@xavescor/reatom-hotkey'

const saveHotkey = reatomHotkey('ctrl+s', {
  editable: false,
  preventDefault: true,
})

effect(() => {
  for (const { payload: event } of getCalls(saveHotkey)) {
    console.log('Save requested', event)
  }
})
```

`reatomHotkey` returns a Reatom action carrying the original `KeyboardEvent`.
Its DOM listeners exist only while the action is observed.

## Syntax

Letters and digits refer to physical keyboard codes, not produced characters:

- `a` matches `KeyboardEvent.code === 'KeyA'`
- `ctrl+s` combines a key with an exact modifier set
- `a+b` declares an order-independent chord
- `ctrl+a+b` combines modifiers and a chord
- named keys include `escape`, `arrowleft`, `f12`, `slash` and `numpad1`

Supported modifiers are `alt`, `ctrl` (or `control`), `meta` and `shift`.
Single-letter shortcuts must be lowercase. Invalid declarations throw
immediately.

## Options

| Option | Default | Behavior |
| --- | --- | --- |
| `document` | `globalThis.document` | Document to listen on. Pass an iframe document when needed. |
| `trigger` | `'keydown'` | Invoke the action on `keydown` or `keyup`. |
| `capture` | `false` | Listen during the capture phase. |
| `repeat` | `true` | Whether to handle repeated keyboard events. |
| `editable` | `true` | Whether to handle events from editable controls. |
| `preventDefault` | `false` | Prevent the accepted event's browser default. |
| `propagation` | `'allow'` | Allow, stop or immediately stop event propagation. |
| `name` | normalized declaration | Reatom action name, such as `hotkey.ctrl+s`. |

The library works without a global `document`, making hotkeys safe to create
during SSR. Pass `document` explicitly for iframes and other browsing contexts.
