# @xavescor/reatom-hotkey

Physical keyboard shortcuts represented as lazy Reatom actions. The library
normalizes DOM keyboard events; application behavior stays in regular Reatom
effects and actions.

## Installation

```sh
npm install --save @xavescor/reatom-hotkey
```

## Usage

```ts
import { effect, getCalls } from '@reatom/core'
import { reatomHotkey } from '@xavescor/reatom-hotkey'

const replayHotkey = reatomHotkey('a', {
  document: pageDocument,
  editable: 'ignore',
  preventDefault: true,
  propagation: 'stop',
  name: 'youtubeHost.replayHotkey',
})

effect(() => {
  getCalls(replayHotkey).forEach(({ payload: event }) => {
    // Application behavior belongs here.
  })
})
```

`reatomHotkey` returns a plain
`GAction<(event: KeyboardEvent) => KeyboardEvent>`. The action receives and
returns the original native event.

To observe a shortcut without interfering with the page's own handler, leave
`preventDefault` and `propagation` at their defaults:

```ts
const subtitlesHotkey = reatomHotkey('c', {
  document: pageDocument,
  editable: 'ignore',
  repeat: 'ignore',
  name: 'youtubePlayer.nativeSubtitles.hotkey',
})
```

## Options

```ts
interface HotkeyOptions {
  document?: Document
  trigger?: 'keydown' | 'keyup'
  capture?: boolean
  repeat?: 'allow' | 'ignore'
  editable?: 'allow' | 'ignore'
  preventDefault?: boolean
  propagation?: 'allow' | 'stop' | 'immediate'
  name?: string
}
```

| Option | Default | Behavior |
| --- | --- | --- |
| `document` | `globalThis.document` | Document that owns the keyboard and lifecycle listeners. Useful for iframes. |
| `trigger` | `'keydown'` | Event type that can invoke the action. Both event types are still tracked for chord state. |
| `capture` | `false` | Uses the capture phase for keyboard listeners. |
| `repeat` | `'allow'` | Allows or ignores events with `KeyboardEvent.repeat === true`. |
| `editable` | `'allow'` | Allows or ignores events from `input`, `textarea`, `select`, and contenteditable elements or their descendants. |
| `preventDefault` | `false` | Calls `event.preventDefault()` for an accepted hotkey. |
| `propagation` | `'allow'` | Allows propagation, calls `stopPropagation()`, or calls `stopImmediatePropagation()`. |
| `name` | normalized `hotkey.*` declaration | Reatom action name, for example `hotkey.ctrl+s`. |

The action is invoked only after the shortcut matches and every configured
filter accepts the event. Event handling follows this order:

1. Match physical codes, chord state, and exact modifiers.
2. Apply the `repeat` filter.
3. Apply the `editable` filter.
4. Apply `preventDefault` and `propagation`.
5. Invoke the action with the event.

Filtered and unmatched events are not modified. Calling the returned action
directly is a normal Reatom action call and therefore bypasses DOM matching and
filters.

## Syntax

Letters and digits refer to physical keyboard codes:

- `a` matches `KeyboardEvent.code === 'KeyA'`
- `1` matches `KeyboardEvent.code === 'Digit1'`
- `shift+a` requires exactly Shift and `KeyA`
- `a+b` matches an order-independent chord
- `ctrl+a+b` combines modifiers with a chord

Supported modifiers are `alt`, `ctrl` (or `control`), `meta`, and `shift`.
Named codes such as `escape`, `arrowleft`, `f12`, `slash`, and `numpad1` are
also supported. Named tokens are case-insensitive, but single-letter shortcuts
must be lowercase. Declarations must contain ASCII characters only. Invalid
declarations throw a `TypeError` immediately.

## Lifecycle And SSR

Listeners are attached through `withConnectHook` when the action gets its first
subscriber and removed after its last subscriber disconnects. Pressed chord
state is cleared on window blur, document visibility changes, disconnect, and
reconnect.

Creating or connecting a hotkey without a global `document` is safe and does
not attach listeners. Pass a specific `Document` when working with an iframe or
another browsing context.
