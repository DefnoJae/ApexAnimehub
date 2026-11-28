# My List Dice Icon Size Design

## Intent

The dice icon in the My List random-picker button is 20px inside a roughly 46px
button and was reported as looking small. Increase it so the control reads
clearly at its existing size.

## Goals

- Make the My List dice icon visibly larger.
- Preserve the dark purple/glass styling and the existing button footprint.
- Keep the picker using the already-loaded filtered list with no new API calls.

## Non-Goals

- Do not change the random-picker modal's own "Spin again" dice.
- Do not change button dimensions, padding, colors, or behavior.
- Do not touch account/API routing.

## Constraints

- `.library-filters > button` keeps its current 44px minimum width/height.
- The My List trigger's `Dice5` SVG must render with width and height `26`.

## Approaches

1. **24px** — subtle bump, still close to the current appearance.
2. **26px (chosen)** — clearly larger with comfortable padding in the ~46px button.
3. **28px** — boldest, but leaves little breathing room inside the button.

## Design

Change only the `size` prop on the `Dice5` icon in `src/components/MyList.tsx`
from `20` to `26`. Add one regression test in `src/components/MyList.test.tsx`
that asserts the trigger SVG has width and height `26`. No CSS changes.
