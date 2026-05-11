# Prompt 31: Implement Line Counter V2 with separate added/deleted slot counters

## Goal

Implement the placeholder **Line Counter V2** UI.

The existing toggle button for switching to V2 already exists.  
Use that toggle path and replace the placeholder with a real V2 counter.

Line Counter V2 should show two separate counters:

```txt
+ added lines
- deleted lines
```

This is mostly a React/UI change. Do not change preprocessing unless the current timeline data does not expose enough line-change information.

---

## Desired visual

Show two counters close together, for example:

```txt
+ 12,430
-  1,284
```

Style:

### Added lines

```txt
dark green
normal font weight, not bold
digits roll upward
```

### Deleted lines

```txt
dark red
normal font weight, not bold
digits roll downward
```

The signs should be clear:

```txt
+ for added
- for deleted
```

Do not combine them into net lines.

---

## Counter meaning

The V2 counter should track cumulative totals up to the current timeline position:

```txt
addedTotal = total added lines up to selected unit
deletedTotal = total deleted lines up to selected unit
```

Important:

```txt
deletedTotal is still an increasing positive count
```

So:

```txt
- 001
- 002
- 003
```

means “total deleted lines so far increased.”

Do not show deleted lines as a negative arithmetic value like `-(-3)`.

---

## Data source

Use the existing repo timeline/display-model data.

Prefer deriving totals from timeline units using fields like:

```txt
type
lineDelta
addedLines
deletedLines
beforeLineCount
afterLineCount
```

or whatever currently exists in the display model.

Expected mapping:

```txt
grow/create/add activity => addedTotal
shrink/delete/remove activity => deletedTotal
```

If the display model already has explicit added/deleted line values, use those.

If it only has `beforeLineCount` and `afterLineCount`, derive:

```ts
delta = afterLineCount - beforeLineCount

if delta > 0:
  addedTotal += delta

if delta < 0:
  deletedTotal += Math.abs(delta)
```

Be careful with structural create/delete units so they do not double-count if separate grow/shrink units already account for line changes.

If the data is ambiguous, choose the safest non-double-counting method and document it in a short code comment.

---

## Slot-machine digit animation

Create a reusable digit/number component, for example:

```txt
SlotNumber
SlotDigit
LineCounterV2
```

The animation should be digit-based.

### Added lines

Digits roll upward.

```txt
0 → 1 → 2 → ...
```

### Deleted lines

Digits roll downward visually.

```txt
0 ↓ 1 ↓ 2 ...
```

Even though the deleted total increases, the visual direction is downward.

---

## Digit order behavior

Animate digit changes from lowest digit to highest digit.

Meaning:

```txt
units digit changes first
then tens
then hundreds
...
```

This should create the feeling of a mechanical slot/counter.

Do not hardcode special cases like “lower digit always loops.”  
Just animate changed digits in staggered order from right to left.

Suggested implementation:

```txt
rightmost digit delay = 0ms
next digit to the left delay = 35ms
next = 70ms
...
```

Keep the animation fast enough to work during playback.

---

## Number formatting

Use stable digit width so the counter does not jitter.

Requirements:

```txt
monospace or tabular numbers
fixed digit width
right-aligned numbers
optional comma grouping if it does not break animation
```

If comma grouping makes slot animation harder, skip commas for now or render separators statically.

The important part is smooth digit rolling.

---

## Integration

Find the existing line counter component / V2 placeholder.

Likely files may include something like:

```txt
LineCounterOverlay
RepoExplorerScene
```

Use the existing toggle that switches between V1 and V2.

When V1 is selected, keep the current line counter unchanged.

When V2 is selected, show:

```txt
LineCounterV2
```

Do not remove V1.

---

## Playback behavior

The counter should respond to:

```txt
Play/Pause
Reset
manual slider changes
duration/speed changes
final rest frame
```

At reset:

```txt
+ 0
- 0
```

At final rest frame:

```txt
same final totals
no extra fake line changes
```

The final rest frame should not make the counter animate new lines. It should only keep the completed totals.

---

## Styling constraints

Keep it presentation-friendly.

Use:

```txt
dark green for + lines
dark red for - lines
normal font weight
clean compact layout
```

Avoid:

```txt
huge dashboard card
bold text
bright neon colors
overly flashy animation
```

The line counter should feel like a small production detail, not dominate the scene.

---

## Critical invariant

Do not use activity mass as file geometry.

This task is only about the line counter.

Still preserve the existing project invariant:

```txt
file/folder visual geometry = replayed current line state / persistent line counts
```

Never change geometry to:

```txt
addedLines + deletedLines
```

Activity mass may drive glow/fire/timing, but not file size.

---

## V1 safety

Do not break the frozen Repository V1 scene.

If the V1 scene shares the same repo component, make sure the V2 line counter only appears when the existing V2 toggle is selected.

Do not modify V1 snapshot data.

---

## Constraints

- Prefer UI-only changes.
- Do not change preprocessing unless required for missing added/deleted line data.
- Do not change Git extraction unless absolutely necessary.
- Do not change display-model generation unless absolutely necessary.
- Do not touch the document/Word scene.
- Do not reintroduce `+ N more`.
- Do not reintroduce `collapseFolders`.
- Do not remove existing playback controls.
- Keep TypeScript/build clean.

---

## Validation

Run:

```bash
npm run build
```

Browser check:

```txt
V1 line counter still works.
V2 toggle shows separate + added and - deleted counters.
+ counter rolls upward.
- counter rolls downward.
Digits animate from lowest digit to highest digit.
Reset returns both to 0.
Manual slider updates both counters correctly.
Final rest frame does not add fake extra changes.
No file/folder geometry logic changed.
```

## Success criteria

- Line Counter V2 replaces the placeholder.
- Added and deleted line totals are separate.
- Slot-machine digit animation works.
- Added rolls upward; deleted rolls downward.
- V1 counter remains intact.
- `npm run build` passes.
