# Ring HUD — radial menu proof of concept

A dependency-free HTML/CSS/JS radial ("pie"/marking-menu style) HUD, built as
a proof of concept for a future VR settings menu. No build step — open
`index.html` directly, or serve the folder with any static file server.

## What it is

- A press-and-hold **or** click-to-navigate radial menu (toggle in the
  top-left panel) driven purely by pointer **angle** and **radius** from a
  fixed center point — the same two numbers a VR controller's thumbstick
  produces (`Gamepad.axes` → angle via `atan2`, magnitude → radius), so the
  gesture state machine is meant to carry over into a real WebXR build with
  the input source swapped out.
- Every menu type a settings screen needs: nested categories, dropdowns,
  toggles (checkboxes), continuous sliders, and a long alphabetical list with
  windowed scrolling — see `menu-data.js`.
- Only the root ring spans the full circle. Every deeper ring fans out over a
  bounded arc centered on its parent's own angle, so reaching a child is a
  small nudge in the direction you're already pointing rather than a sweep
  around the whole wheel (see "Marking menus" below for why this matters).

## Files

| File | Contents |
|---|---|
| `index.html` | Page shell, SVG icon sprite, config panel markup |
| `menu-data.js` | The sample menu tree (edit this to change content) |
| `ring-menu.js` | The engine: geometry, gesture handling, rendering |
| `style.css` | All visual styling, including the few CSS hooks meant to be tweaked directly (`.center-hub-image` scale/pan, category colors) |

## Design decisions and the research behind them

This wasn't just eyeballed — a few concrete choices below are grounded in
published HCI work on radial/marking menus, going back to the original 1988
pie-menu paper and Kurtenbach's early-90s marking-menu research.

### Why 8 items per ring, and why depth is capped

Kurtenbach & Buxton's foundational marking-menu research found that **eight
items per ring is close to the learnability/speed sweet spot** — people can
reliably distinguish 8 compass-ish directions by muscle memory once they've
used a menu a few times ("mark ahead," i.e. drawing the gesture from memory
without waiting for the menu to render), and **even counts outperform odd
counts**. It also found a breadth/depth tradeoff: at 8 items per level, error
rate stays low to about 2 levels deep; at 4 items per level, you can go
about 4 levels deep before errors climb past ~10%.

- Kurtenbach, G. (1993). *The Design and Evaluation of Marking Menus* (PhD
  thesis, University of Toronto).
  [research.autodesk.com PDF](https://www.research.autodesk.com/app/uploads/2023/03/the-design-and-evaluation.pdf_recHpUp1v9dc1n2CJ.pdf)
- Kurtenbach, G. & Buxton, W. (1993). *Some articulatory and cognitive
  aspects of "marking menus": an empirical study*.
  [Microsoft Research PDF](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/08/marking-menus-93.pdf)
- Buxton, B. *The Limits of Expert Performance Using Hierarchic Marking Menus*.
  [billbuxton.com/MMExpert.html](https://www.billbuxton.com/MMExpert.html)
- Zhao, S. & Balakrishnan, R. (2004). *Simple vs. Compound Mark Hierarchical
  Marking Menus* (UIST '04).
  [dgp.toronto.edu PDF](https://www.dgp.toronto.edu/~sszhao/paper/UIST04_SMM.pdf)
- Zhao, S. et al. *Scale Independence in Marking Menus*.
  [academia.edu](https://www.academia.edu/22188827/Scale_Independence_in_Marking_Menus)

**Applied here:** the sample data (`menu-data.js`) uses 8 top-level
categories (Kurtenbach's sweet spot), keeps most branches to 2 levels deep,
and allows exactly one branch (Graphics → Advanced) to go a 3rd level as a
capability demo rather than the norm.

### Why pie/radial beats a linear list for this use case

The original empirical comparison found pie menus faster and more accurate
than linear (dropdown-style) menus for the same content, because selection
time in a radial layout is roughly constant regardless of item count (bounded
by angle discrimination), whereas linear list scanning time grows with list
length and serial position.

- Callahan, J., Hopkins, D., Weiser, M., & Shneiderman, B. (1988). *An
  Empirical Comparison of Pie vs. Linear Menus* (CHI '88). — the original pie
  menu paper.
- Hopkins, D. *The Design and Implementation of Pie Menus*.
  [Medium](https://donhopkins.medium.com/the-design-and-implementation-of-pie-menus-80db1e1b5293)
- Nielsen Norman Group. *Expandable Menus: Pull-Down, Square, or Pie?*
  [nngroup.com](https://www.nngroup.com/articles/expandable-menus/)
- Buxton, B. *Pie Menus* (historical overview).
  [billbuxton.com/PieMenus.html](https://www.billbuxton.com/PieMenus.html)

**Applied here:** this is also *why* the new "Open Tool" list (32 items) gets
a distinct treatment — a flat alphabetical list is exactly the case pie
menus don't help with (no meaningful "direction" per item once you're past
~8-12 entries), so it intentionally breaks from the radial pattern into a
windowed, scrollable list instead of forcing 32 wedges into a circle.

### Fitts's Law and Hick's Law (the two laws underneath most of this)

- **Fitts's Law** (target acquisition time grows with distance to a target
  and shrinks with target size) is why wedges fan out *near the direction
  you're already pointing* instead of spanning the full circle — it minimizes
  the angular distance from "roughly aiming" to "on target," and why deeper
  wedges get progressively easier to hit rather than harder.
- **Hick's Law / Hick–Hyman Law** (decision time grows ~logarithmically with
  the number of choices) is the underlying reason breadth is capped near 8
  per ring instead of, say, showing all settings flat in one enormous wheel.

### Why hovering previews children instead of requiring a full push-out

This isn't from a specific paper — it's a standard progressive-disclosure
pattern (seen in OS context menus and application menu bars) adapted to the
radial gesture: showing the next ring on hover, before you've committed to
pushing past the edge, lets you preview without committing, which reduces
the cost of a wrong guess to near zero (you just don't push further).

