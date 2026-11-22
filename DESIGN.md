# Prodrome Design System & UI Spec

Use this file to apply branding and a design system to the existing bare-bones screens. Do not change app logic or data flow. Only change layout, styling, components, copy, and icons as described here.

"Prodrome" is a working name. Keep it in one constant so it can be swapped later.

---

## 1. Product in one line

A deskside companion that quietly tracks a room's air and light, and helps people spot what's behind their headaches, brain fog, and bad sleep.

## 2. Look and feel

**Smooth, sleek, calming, clean.**

- Lots of white space. White background, thin outlines, very few filled areas.
- Deep green and soft lavender are the brand pair. They always appear together on filled surfaces.
- Pixel art (square-grid icons) gives the product its personality. Everything else is smooth and rounded.
- Nothing flashes, shakes, or shouts. No red, no alarm styling, no exclamation marks.

## 3. Design principles

1. **Calm by default.** The app is open all day. The normal state should feel quiet.
2. **Never interrupt.** System messages never block the screen. Suggestions wait until the user is ready. (User-opened flows like "Log a symptom" can use a modal.)
3. **Words before numbers.** Status words are always visible. Numbers support them.
4. **Suggestions, not orders.** Copy offers, never commands.
5. **Private and personal.** No sharing, no export, no leaderboards.
6. **One system, two surfaces.** The website and the 7x7 LED matrix on the device use the same spiral and the same states.

---

## 4. Color

Only these colors. Do not introduce others (no red, no grey text, no extra greens).

| Token | Hex | Role |
|---|---|---|
| `--green` | `#084307` | Main color. All text, outlines, filled CTAs, filled cards, icons on white |
| `--lavender` | `#E4CCFF` | Highlight. Text and icons placed on green surfaces |
| `--blue` | `#8CC7FF` | Supporting. Air quality data (bars, chart line) |
| `--yellow` | `#FDC25B` | Supporting. Lighting data (bars, chart line) |
| `--white` | `#FFFFFF` | Page and card background |
| `--line` | `#084307` at 35% opacity | Thin outlines, dividers, chart axes, empty progress squares |

### Rules

- **All text is `--green`** on white. No black, no grey. Secondary text uses `--green` at 70% opacity if needed.
- **Green and lavender always pair.** Any filled green surface (hero banner, selected card, primary button) uses lavender for its text and icons. Lavender never sits on white by itself as text.
- **Blue means air. Yellow means light.** Use them only for data about those two things. Never use them for status, buttons, or decoration.
- **Status is never shown with color.** Good vs poor is shown with words and the spiral, not with red/amber/green.
- Light mode only for now.

---

## 5. Typography

**Font: Modern Era.** Load from local font files if provided (`/public/fonts`). Fallback stack: `"Modern Era", "DM Sans", system-ui, sans-serif`.

Two weights only: **Regular (400)** and **Bold (700)**.

| Role | Weight | Size (web) | Example |
|---|---|---|---|
| Greeting / page title | Bold | 44px, letter-spacing -0.02em | "Good morning, Alex" |
| Onboarding question | Bold | 32px, -0.02em | "What do you want help with?" |
| Modal question | Bold | 24px, -0.01em | "What symptom are you experiencing?" |
| Big data number | Regular | 56px | "800" |
| Modal title, wordmark | Regular | 26px | "Log a symptom", "Prodrome" |
| Section label (above cards) | Regular | 24px | "Lighting", "How your space has felt" |
| Status word in cards | Regular | 24px | "Good" |
| Hero banner message | Regular | 26px, lavender | "A great time for deep work" |
| Sidebar nav | Regular | 20px | "Dashboard" |
| Card labels, buttons, body | Regular | 18px | "Eye strain", "Next" |
| Units, small labels | Regular | 16px | "lux", "Mild" |

- Line height: 1.15 for bold headings, 1.4 for body
- Sentence case everywhere ("Good morning, Alex", "Log a symptom")
- Bold is only for headings and questions. Body, labels, and numbers stay regular.

---

## 6. Squares vs squircles

The single most important shape rule:

> **Squares are information. Rounded shapes hold things or do things.**

### Use squares (sharp corners, 0 radius) for
- Pixel icons (symptoms, triggers, the spiral)
- Mini bar charts on the sensor cards
- Chart data markers
- Progress steps (onboarding and modal)
- The dial handle on the time picker
- Pixel cells in the LED matrix mirror
- Legend swatches

### Use squircles / rounded shapes for
- Cards and option tiles: 28px radius
- Modals: 32px radius
- Hero banner: 32px radius
- Text inputs and textareas: 24px radius
- Buttons: fully rounded ends (radius = half height)
- Slider track and thumb: fully rounded

Never mix within one element. A square never gets rounded corners, and a card never gets sharp ones.

### No pill tags
Status and labels are plain text, never inside pill-shaped badges or chips. The only fully rounded elements are buttons and the slider.

---

## 7. Layout and spacing

- 8px spacing scale: 8, 16, 24, 32, 48, 64
- **Desktop layout:** fixed left sidebar (240px) + main content (max 1100px)
- Sidebar: "Prodrome" wordmark at top, nav links (Dashboard, Insights) about 120px below, Settings at the bottom
- Section labels sit **above** their card, outside it, with 16px gap
- Cards: white fill, 1px `--line` outline, no shadow
- Generous padding inside cards: 32px
- Mobile: sidebar collapses to a top bar with menu, cards stack, 16px side padding, no horizontal scroll

## 8. Motion

- Slow and soft: 400 to 600ms, ease-in-out
- Spiral grows or unwinds one square at a time when status changes (about 40ms per square)
- Selected tiles fade from white to green
- Modal fades and rises 16px on open
- Bar charts update by stepping squares up or down, never sliding
- Respect `prefers-reduced-motion` (show final state, no animation)

---

## 9. Status scale

One scale for **overall condition, lighting, and air quality**:

| Level | Spiral stage | Meaning |
|---|---|---|
| **Great** | Full spiral | Ideal for this time of day |
| **Good** | Mostly wound | Fine |
| **Caution** | Half wound | Starting to drift |
| **Poor** | Single dot | Worth adjusting when you can |

- Shown as a plain word (top right of each sensor card) and through the spiral (hero banner, device).
- No colors attached to levels.

### Hero banner messages

| Level | Daytime | Evening (after wind-down time) |
|---|---|---|
| Great | A great time for deep work | A calm space to wind down |
| Good | Your space feels balanced | Settling in nicely |
| Caution | Needing some rest soon | A little bright for this late |
| Poor | Your space could use a reset | Time to dim things down |

When a specific issue causes Caution or Poor, a short suggestion line can appear under the banner (see "Suggestion line" in components).

### Severity scale (symptom logging)

Slider from **1 to 10** with four anchor labels spaced evenly underneath:

**Mild · Dull · Intense · Searing**

---

## 10. The spiral (brand icon)

The spiral represents balance. It's the logo mark, the hero banner icon, and the main display on the device's 7x7 LED matrix.

**Dot = not optimal. Full spiral = optimal.** The spiral grows outward from the center as conditions improve.

`#` = square on, `.` = square off. 7 columns x 7 rows.

**Poor** (1 square)
```
.......
.......
.......
.......
..#....
.......
.......
```

**Caution** (15 squares)
```
.......
.......
#####..
#...#..
#.###..
#......
###....
```

**Good** (23 squares)
```
.......
.......
#####.#
#...#.#
#.###.#
#.....#
#######
```

**Great** (31 squares, full)
```
#######
......#
#####.#
#...#.#
#.###.#
#.....#
#######
```

### Growth order
The spiral is one continuous path. Squares turn on in this order (x = column, y = row, from top left):

```
(2,4) (3,4) (4,4) (4,3) (4,2) (3,2) (2,2) (1,2) (0,2) (0,3) (0,4) (0,5) (0,6)
(1,6) (2,6) (3,6) (4,6) (5,6) (6,6) (6,5) (6,4) (6,3) (6,2) (6,1) (6,0)
(5,0) (4,0) (3,0) (2,0) (1,0) (0,0)
```

Stage = first N squares of the path: Poor 1, Caution 15, Good 23, Great 31. Animate by turning squares on or off along this path. Store the path once and derive every stage from it.

### Usage
- **Hero banner:** lavender squares on green, left aligned
- **Logo mark:** green squares on white, next to the wordmark (optional)
- **Device:** same patterns on the 7x7 LED grid
- **Idle animation (Great only):** very slow shimmer where one square at a time dims and returns, travelling along the path

---

## 11. Pixel icons (9x7 grid)

All illustrative icons are pixel art on a **9 column x 7 row** grid of squares. Render with a reusable `PixelIcon` component.

- Square size: 10px on cards (icon ~ 90x70px), scale in whole pixels only
- Gap between squares: 2px (matches the gapped look in the screens)
- Color: `--green` on white, `--lavender` on green
- Functional UI glyphs (close X, arrow, plus) are **not** pixel icons. They stay thin 1.5px line icons in `--green` (or lavender on green).

### Symptoms

**Headache**
```
...#####.
.########
#########
#########
.########
.#######.
....###..
```

**Eye strain**
```
...###...
..#...#..
.#.###.#.
#..###..#
.#.###.#.
..#...#..
...###...
```

**Brain fog**
```
...###...
..#...##.
.#......#
.########
.........
##.###.##
.........
```

**Fatigue**
```
.........
########.
##.....##
##.....##
##.....##
########.
.........
```

**Poor sleep**
```
..###....
.##...###
##.....#.
##....###
##.......
.##......
..###....
```

**Something else / not sure**
```
..####...
.#....#..
......#..
....##...
....#....
.........
....#....
```

**Just curious**
```
....#....
...###...
..#####..
#########
..#####..
...###...
....#....
```

### Triggers

**Stale air**
```
.........
######.##
.........
.########
.........
#####.##.
.........
```

**Strong smells**
```
.#..#..#.
#..#..#..
.#..#..#.
#..#..#..
.........
#########
.#######.
```

**Bright light**
```
#...#...#
.#.....#.
...###...
##.###.##
...###...
.#.....#.
#...#...#
```

**Dim light**
```
.........
.........
...###...
..#####..
.#######.
#########
.........
```

**Late-night screens**
```
..#####..
..#...#..
..#...#..
..#...#..
..#...#..
..##.##..
..#####..
```

(Reuse "Something else / not sure" for "Not sure".)

---

## 12. Components

### Buttons

| Type | Style | Used for |
|---|---|---|
| **Primary** | Filled `--green`, lavender text, fully rounded | "+ Symptom", "Next →", "Finish", "Get started" |
| **Secondary** | White, 1px `--green` outline, green text, fully rounded | "Skip", "Sign in", "Snooze 1 hr" |
| **Text** | Green text, no border | "Delete my data", small links |

- Height 48px, horizontal padding 28px
- "Next" includes a thin right arrow after the label
- Primary and secondary sit side by side, secondary on the left, bottom right of the container

### Sidebar
Wordmark top left. Nav links stacked, regular weight. Active link: bold. No background highlight, no icons.

### Greeting header
"Good morning / afternoon / evening, [Name]" in bold, left. "+ Symptom" primary button aligned right on the same line.

### Hero banner
- Full-width green card, 32px radius, ~220px tall
- Spiral (lavender squares) top left, large (square size ~16px)
- Banner message bottom right in lavender, regular weight
- Content changes with the status scale (section 9)

### Suggestion line
Shown under the hero banner only when something's off. A thin outlined white card, 24px radius, one row:
- Small pixel icon (trigger icon) left
- One soft sentence: "Air's been getting a bit stale. Some fresh air might help when you get a chance."
- "Snooze 1 hr" secondary button right
- Fades out by itself when conditions improve. No close button needed.

### "While you were away"
One small text line under the suggestion area: "2 suggestions earlier today". Click to expand a simple list with times. Same thin-outline style.

### Sensor cards (Lighting, Air quality)
- Section label above card ("Lighting", "Air quality")
- Two cards side by side, equal width
- Inside, using the screens' layout:
  - **Top right:** status word (Great / Good / Caution / Poor)
  - **Bottom left:** mini pixel bar chart, 7 columns x up to 7 squares tall, showing recent readings. Yellow for lighting, blue for air.
  - **Bottom right:** big number, unit small next to it
- Units: lighting is **lux**, air quality uses the sensor's unit (**ppm** for CO₂, or "index" for a VOC index)

### Trend chart ("How your space has felt")
- Section label above, card below
- Two lines: lighting `--yellow`, air `--blue`, 2px
- Square data markers (10px) on each point, same color as line
- Axes: thin `--line` with small arrowheads
- Small legend top right: square swatch + label for each line
- Logged symptoms: small green squares along the bottom of the chart at the time they were logged
- Range control top left as text buttons: 15m · 6h · 24h · 7d (active one bold). No pill toggles.

### Progress steps
- Row of small squares (12px, 8px gap)
- Done and current: filled `--green`
- Upcoming: 1px `--green` outline, empty
- Onboarding: centered at top of screen. Modal: right aligned, level with the question.

### Option tiles (onboarding + symptom picker)
- 3 x 2 grid, 24px gap, 28px radius, 1px `--line` outline
- Pixel icon top right, label bottom left
- **Unselected:** white, green icon, green label
- **Selected:** filled green, lavender icon, lavender label
- Hover: outline becomes solid `--green`
- Multi-select where noted, otherwise single

### Time dial
- Thin 1px `--green` circle with 4 short tick marks at top, right, bottom, left
- Labels: "12 am" left, "12 pm" right (so 6 am is at top, 6 pm at bottom)
- Handle: 14px green square on the circle, draggable
- Selected range shown as a 3px `--green` arc from 12 am to the handle
- Time label in regular weight next to the handle ("6:30 am")
- Wind-down step: the arc runs from the wind-down time to the wake time and is drawn in `--lavender` with a thin green edge, so the user sees their night window

### Slider (severity)
- Fully rounded track, 1px `--line` outline, 48px tall
- Filled portion: `--green`
- Thumb: `--lavender` circle inside the track
- "1" above the left end, "10" above the right end
- Anchor labels below: Mild · Dull · Intense · Searing

### Text area
- 1px `--line` outline, 24px radius, ~150px tall, placeholder in green at 50%: "Anything you noticed? Optional"

### Modal (Log a symptom)
- White, 32px radius, 1px `--line` outline, centered, max width 840px
- Title "Log a symptom" top left (regular), thin X close top right
- Question in bold green below, with 3 progress squares on the right
- Buttons bottom right
- Background behind modal: white at 70% with slight blur

### Toast
After finishing a log, bottom center, thin-outline white rounded card:
"Logged: Headache, 3:42 pm. See what happened before →"
Fades after ~6 seconds. Link opens Insights for that entry.

### LED matrix mirror (Settings)
7x7 grid of squares. On squares `--green`, off squares `--line` outline only. Shows the same spiral stage as the device.

### Empty states
Spiral at Poor stage (single dot) in `--green`, plus one sentence:
- Insights: "Log a few symptoms and we'll start finding patterns."
- History: "Nothing logged yet. Tap + Symptom when you feel off."

---

## 13. Flows

### Onboarding (5 steps)

Progress squares at the top. Every step has "Skip" (secondary) and "Next →" (primary).

1. **What do you want help with?** *(multi-select tiles)*
   Headaches · Eye strain · Brain fog · Fatigue · Sleep · Just curious
2. **What do you think sets it off?** *(multi-select tiles)*
   Stale air · Strong smells · Bright light · Dim light · Late-night screens · Not sure
3. **When do you usually wake up?** *(time dial)*
4. **When do you usually wind down?** *(time dial, shows night window)*
5. **Pair your device** *(enter the 4-character code shown on the device, or "Skip, I'll do it later")*

Final screen: spiral animates from dot to full, with "You're set. Prodrome will get to know you as you log how you feel." Primary button "Go to dashboard".

### Log a symptom (3 steps, modal)

Opened from "+ Symptom".

1. **What symptom are you experiencing?** *(single-select tiles)*
   Headache · Eye strain · Brain fog · Fatigue · Poor sleep · Something else
2. **On a scale of 1 to 10, how strong does it feel?** *(slider, Mild · Dull · Intense · Searing)*
   For headache only, the question can read "how painful does it feel?"
3. **Anything else?** *(optional text area)* → "Finish" primary button

Then the modal closes and the toast appears. Skip on steps 2 and 3 still logs the symptom.

---

## 14. Pages

### `/` Landing & login
- Wordmark top left
- Large bold headline: "Catch invisible air and light triggers before they catch you"
- Supporting line: "Prodrome quietly tracks the air and light in your room and helps you see what's behind headaches, brain fog, and bad sleep."
- Green banner with the spiral animating from dot to full
- "Get started" (primary) and "Sign in" (secondary)

### `/onboarding`
5 steps from section 13.

### `/dashboard`, top to bottom
1. Greeting + "+ Symptom"
2. Hero banner
3. Suggestion line (only when needed)
4. "While you were away" (only when needed)
5. Lighting and Air quality cards
6. "How your space has felt" chart

### `/insights`, top to bottom
1. **What seems to affect you:** outlined card with 2 to 3 plain-language patterns. Each has a confidence line in regular text, e.g. "Strong pattern · 4 of 5 headaches" or "Early pattern · 2 logs". No tags.
2. **Before your symptom:** 2-hour chart in the trend chart style for a selected log, with the time window of the spike shaded in `--lavender` at 50% and a short label ("Air quality dropped here, 50 min before")
3. **Today's brief:** green filled card with lavender text. Three short lines: best focus window, biggest dip, one tip for tomorrow
4. **Your log:** simple list rows with the symptom pixel icon, symptom name, severity word, date and time. Thin divider lines between rows.

### `/settings`
1. Device: status text (Connected / Offline), last synced time, LED matrix mirror
2. Schedule: wake and wind-down dials (smaller versions)
3. What you notice: option tiles (same as onboarding step 1)
4. Suggestions: quiet hours, device sound toggle (off by default)
5. Thresholds: sliders for lighting and air, with an "Auto-learn" toggle
6. "Delete my data" text button at the bottom, with a confirm step

Offline message: "Readings saved on the device. They'll sync when it reconnects."

---

## 15. Voice and copy

- Warm, plain, low-key. A thoughtful friend, not a doctor or coach.
- Soft suggestions: "might help," "when you get a chance."
- Never: "Warning," "Danger," "Alert," "Now," exclamation marks.
- No medical claims. Say "spot your triggers," never "prevent" or "treat."
- One sentence per suggestion.
- Sentence case. No em dashes.

| Don't | Do |
|---|---|
| "VOCs spiked 35%! Open a window now!" | "Air's been getting a bit stale. Some fresh air might help when you get a chance." |
| "Warning: light too bright" | "A little bright for this late. Dimming things might help you wind down." |
| "No data available" | "Log a few symptoms and we'll start finding patterns." |

---

## 16. Fixes to apply to the current mockups

- Lighting unit should be **lux**, not ppm
- Headings in black ("When do you usually wake up?") should be `--green`
- Time dial arc and handle should be `--green`, not black
- Slider thumb should be `--lavender`, not light green
- "Next", "+ Symptom", and "Finish" should be filled primary buttons
- Greeting uses sentence case: "Good morning, Alex"

## 17. Don'ts

- No colors outside the palette (no red, no grey, no black text)
- No pill tags or chips
- No rounded corners on pixel squares, no sharp corners on cards or buttons
- No shadows or gradients
- No modals or pop-ups for system messages
- No data export or sharing
- No gamification (streaks, badges, scores to "beat")
