# @xavescor/reatom-hotkey

Physical keyboard shortcuts represented as lazy Reatom actions.

## Installation

```sh
npm install --save @xavescor/reatom-hotkey
```

## Usage

```ts
import { reatomHotkey } from '@xavescor/reatom-hotkey'

const save = reatomHotkey('ctrl+s') // Action<[event: KeyboardEvent], KeyboardEvent>

const unsubscribe = save.subscribe((event) => {
  console.log(event.code)
})
```

The listeners are attached when the action gets its first subscriber and are
removed after its last subscriber disconnects.

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

The action fires on `keydown` and returns the original `KeyboardEvent` as its
payload. Repeated keydown events are not filtered, editable elements are not
ignored, and the event's default behavior is not prevented.
