# Tailwind CSS v4 — reference

Litsa · ft_transcendence · 19 Aug 2026

Written for converting this project's inline `style={{}}` objects to utility
classes. Tailwind **v4** specifically — v3 configures completely differently and
most tutorials online are still v3.

---

## Index

1. [What Tailwind is, and why we need it](#1-what-tailwind-is-and-why-we-need-it)
2. [How it's set up here](#2-how-its-set-up-here)
3. [The spacing scale](#3-the-spacing-scale)
4. [Conversion table](#4-conversion-table)
5. [Layout: flex and grid](#5-layout-flex-and-grid)
6. [Typography](#6-typography)
7. [Colour](#7-colour)
8. [Borders, radius, shadow](#8-borders-radius-shadow)
9. [Responsive design](#9-responsive-design)
10. [States: hover, focus, disabled](#10-states-hover-focus-disabled)
11. [Forms](#11-forms)
12. [Preflight — the reset](#12-preflight--the-reset)
13. [Conditional and dynamic classes in React](#13-conditional-and-dynamic-classes-in-react)
14. [Gotchas](#14-gotchas)
15. [Defending it at evaluation](#15-defending-it-at-evaluation)

---

## 1. What Tailwind is, and why we need it

Instead of writing CSS in a stylesheet, you compose small single-purpose classes
in the markup:

```jsx
// before
<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

// after
<div className="flex flex-col gap-4">
```

**Two reasons this project needs it, both mandatory requirements:**

- The eval sheet requires a **CSS framework** and states plain CSS alone isn't
  sufficient. Inline style objects are *less* than plain CSS — no shared
  vocabulary, no reuse.
- **Responsive design is structurally impossible with inline styles.** An inline
  style is one declaration on one element; there is nowhere to write "…but
  narrower than 640px, stack these instead". Tailwind gives you `md:flex-row`.

The evaluator will ask to see examples of the framework *used in the code*, not
just installed.

---

## 2. How it's set up here

Three pieces, all already done (TRAN-44, PR #19):

**`frontend/package.json`** — in `devDependencies`, because Tailwind compiles CSS
at build time and ships nothing to the browser:
```json
"@tailwindcss/vite": "^4.3.3",
"tailwindcss": "^4.3.3"
```

**`frontend/vite.config.js`** — plugin added before VitePWA, so the generated
stylesheet exists when the service worker precaches build output:
```js
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({ /* ... */ })],
});
```

**`frontend/src/index.css`** — one line, imported by `main.tsx`:
```css
@import "tailwindcss";
```

**v4 needs nothing else.** No `tailwind.config.js`, no PostCSS, no autoprefixer,
no `content` globs. If a guide tells you to run `npx tailwindcss init -p`, it's
a v3 guide and it will fail.

Also present: `frontend/src/vite-env.d.ts` containing
`/// <reference types="vite/client" />` — without it, TypeScript can't type the
CSS import and `tsc` fails with `ts(2882)`.

---

## 3. The spacing scale

**The single most useful thing to internalise.** The number is in quarter-rems:

| Class | rem | px (at 16px base) |
|---|---|---|
| `1` | 0.25rem | 4px |
| `2` | 0.5rem | 8px |
| `3` | 0.75rem | 12px |
| `4` | 1rem | 16px |
| `6` | 1.5rem | 24px |
| `8` | 2rem | 32px |
| `12` | 3rem | 48px |
| `16` | 4rem | 64px |

So `gap-4` is `gap: 1rem`. `p-8` is `padding: 2rem`. Divide your rem value by
0.25 and you have the number.

**Prefixes:**

| Prefix | Means |
|---|---|
| `p` | padding |
| `m` | margin |
| `pt` `pb` `pl` `pr` | top / bottom / left / right |
| `px` | left **and** right (horizontal) |
| `py` | top **and** bottom (vertical) |
| `gap` | space between flex/grid children |

`mx-auto` = `margin-left: auto; margin-right: auto` — the standard centring
trick, and it works because `auto` is a valid value in the scale.

---

## 4. Conversion table

The patterns that appear in this codebase:

| Inline style | Tailwind |
|---|---|
| `display: "flex"` | `flex` |
| `display: "grid"` | `grid` |
| `flexDirection: "column"` | `flex-col` |
| `flexWrap: "wrap"` | `flex-wrap` |
| `alignItems: "center"` | `items-center` |
| `justifyContent: "center"` | `justify-center` |
| `justifyContent: "space-between"` | `justify-between` |
| `gap: "1rem"` | `gap-4` |
| `padding: "2rem"` | `p-8` |
| `marginBottom: "2rem"` | `mb-8` |
| `margin: "0 auto"` | `mx-auto` |
| `maxWidth: "600px"` | `max-w-xl` |
| `minHeight: "100vh"` | `min-h-screen` |
| `width: "100%"` | `w-full` |
| `textAlign: "center"` | `text-center` |
| `fontWeight: "bold"` | `font-bold` |
| `fontFamily: "system-ui, sans-serif"` | `font-sans` |
| `color: "red"` | `text-red-600` |
| `backgroundColor: "#f5f5f5"` | `bg-gray-100` |
| `borderRadius: "0.5rem"` | `rounded-lg` |
| `cursor: "pointer"` | `cursor-pointer` |

**Max-width scale** (useful for page containers): `max-w-sm` 24rem ·
`max-w-md` 28rem · `max-w-lg` 32rem · `max-w-xl` 36rem · `max-w-2xl` 42rem.

---

## 5. Layout: flex and grid

```jsx
// vertical stack with spacing — the most common pattern in this app
<div className="flex flex-col gap-4">

// horizontal row, vertically centred, space pushed between
<div className="flex items-center justify-between">

// centred page container
<div className="max-w-xl mx-auto p-8">

// two columns that become one on narrow screens
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
```

`items-*` controls the **cross** axis, `justify-*` the **main** axis. In a
`flex-col`, those swap over — `items-center` centres horizontally, because the
main axis is now vertical.

---

## 6. Typography

| Class | Size |
|---|---|
| `text-xs` | 0.75rem |
| `text-sm` | 0.875rem |
| `text-base` | 1rem (default) |
| `text-lg` | 1.125rem |
| `text-xl` | 1.25rem |
| `text-2xl` | 1.5rem |
| `text-3xl` | 1.875rem |
| `text-4xl` | 2.25rem |

Weight: `font-normal` `font-medium` `font-semibold` `font-bold`
Family: `font-sans` `font-serif` `font-mono`
Other: `italic` · `underline` · `uppercase` · `leading-relaxed` (line height) ·
`tracking-tight` (letter spacing)

```jsx
<h1 className="text-3xl font-bold mb-4">Check-in app</h1>
<p className="text-base leading-relaxed text-gray-700">…</p>
```

---

## 7. Colour

Pattern: `{property}-{colour}-{shade}`. Shades run 50 (lightest) to 950
(darkest), in steps of 100.

| Property | Prefix |
|---|---|
| text | `text-` |
| background | `bg-` |
| border | `border-` |

```jsx
text-gray-700      // body text
text-red-600       // the emergency disclaimer
bg-gray-100        // subtle panel
bg-blue-600        // primary button
border-gray-300    // input border
```

Rough guide: **50–200** backgrounds · **400–600** borders and accents ·
**700–900** text.

Keep the palette small. Picking two or three colours and reusing them is what
makes an app look designed rather than assembled.

---

## 8. Borders, radius, shadow

```jsx
border               // 1px, all sides
border-2             // 2px
border-t             // top only
border-gray-300      // colour

rounded              // 0.25rem
rounded-md           // 0.375rem
rounded-lg           // 0.5rem
rounded-full         // pill / circle — good for avatars

shadow-sm            // subtle
shadow               // default
shadow-md
```

---

## 9. Responsive design

**This is why we're doing the conversion.** Prefix any class with a breakpoint
and it applies from that width upward:

| Prefix | From |
|---|---|
| *(none)* | all sizes |
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |

**Mobile-first**: the unprefixed class is the small-screen version; prefixed
classes override it as the screen grows.

```jsx
// stacked on phones, side by side from 768px
<div className="flex flex-col md:flex-row gap-4">

// smaller heading on mobile
<h1 className="text-2xl md:text-4xl">

// full width on mobile, constrained on desktop
<div className="w-full md:max-w-xl md:mx-auto">

// less padding on small screens
<div className="p-4 md:p-8">
```

**Testing:** DevTools device toolbar (`⌘⇧M` in Chrome and Firefox). Check 375px
(phone), 768px (tablet), and full width. Nothing should overflow horizontally.

---

## 10. States: hover, focus, disabled

Same prefix mechanism:

```jsx
<button className="bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed">
```

`focus:` matters for the accessibility pass (TRAN-56) — every interactive
element needs a **visible focus indicator** for keyboard users. `focus:ring-2`
is the easy way to guarantee one.

Also available: `active:` · `focus-visible:` (focus ring only for keyboard, not
mouse clicks) · `group-hover:`

---

## 11. Forms

The pattern to establish once in `LoginPage` and reuse everywhere:

```jsx
<div className="flex flex-col gap-4 max-w-sm">
  <label htmlFor="email" className="text-sm font-medium text-gray-700">
    Email
  </label>
  <input
    id="email"
    type="email"
    className="border border-gray-300 rounded-md px-3 py-2
               focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
  <button
    type="submit"
    className="bg-blue-600 text-white rounded-md px-4 py-2
               hover:bg-blue-700 disabled:opacity-50"
  >
    Log in
  </button>
</div>
```

Note `htmlFor` on the label matching the input's `id` — that's an accessibility
requirement (TRAN-56), not a Tailwind thing, but this is where it gets written.

Error messages keep `role="alert"`, which the auth forms already do.

---

## 12. Preflight — the reset

Tailwind ships a CSS reset that runs automatically. It strips browser defaults:
heading sizes, margins, list bullets, form-control styling.

**This is why unconverted pages currently look bunched-up and small.** It isn't
breakage — it's the reset removing defaults that inline styles never replaced.
Converting a component fixes its appearance.

Practical consequence: **a heading has no size until you give it one.**
`<h1>` renders at body-text size. Always pair headings with an explicit
`text-2xl`/`text-3xl` and a weight.

---

## 13. Conditional and dynamic classes in React

```jsx
// simple conditional
<div className={`p-4 rounded ${isActive ? "bg-blue-100" : "bg-gray-100"}`}>

// conditional presence
<button className={`px-4 py-2 rounded ${disabled ? "opacity-50" : ""}`}>
```

**The trap:** Tailwind scans your source for complete class name strings. It
cannot see classes you build by concatenation.

```jsx
// BROKEN — the class never gets generated
<div className={`text-${colour}-600`}>

// FINE — both full names appear literally in the source
<div className={isError ? "text-red-600" : "text-green-600"}>
```

---

## 14. Gotchas

- **v3 tutorials will mislead you.** No config file, no PostCSS, no `content`
  globs in v4.
- **Don't build class names dynamically** — see §13.
- **`items-*` vs `justify-*` swap meaning in `flex-col`** — the main axis
  changes.
- **Long `className` strings are normal.** They look wrong at first; it passes.
  Break across lines with a template literal or just let them wrap.
- **Restart the dev server** after touching `vite.config.js` — plugin changes
  aren't hot-reloaded.
- **Don't convert files that are in someone else's open PR.**

---

## 15. Defending it at evaluation

Likely questions and honest answers:

**"Why Tailwind rather than Bootstrap or plain CSS?"**
The subject requires a styling framework and states plain CSS isn't sufficient.
Tailwind was chosen over a component library because we're also claiming the
custom design system module — a component library would have given us prebuilt
components and undermined that claim. Tailwind gives us primitives to build our
own.

**"Show me where it's used."**
Any converted component. Have one open.

**"How does responsive work?"**
Breakpoint prefixes — `flex-col md:flex-row`. Demonstrate with the DevTools
device toolbar. Worth adding: this was impossible before, because the frontend
used inline style objects and there is nowhere in an inline style to express a
media query. That's a good answer because it shows the change had a reason
beyond ticking a box.

**"Why is it in devDependencies?"**
It compiles CSS at build time and ships nothing to the browser, so a production
install (`npm ci --omit=dev`) shouldn't be pulling in Tailwind or its native
binaries.
