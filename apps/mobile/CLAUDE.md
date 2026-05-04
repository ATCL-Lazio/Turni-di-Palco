# Mobile App — Design System Rules (for Figma MCP integration)

This document tells Claude (and any other AI agent) how to map a Figma
design into this codebase faithfully and idiomatically. It is scoped to
`apps/mobile/` — the user-facing React app built with Vite + Tailwind v4.

> When the user shares a Figma URL, prefer the Figma MCP tools (`get_design_context`,
> `get_screenshot`, `get_metadata`). Treat their React + Tailwind output as a
> **reference**: do not paste it verbatim. Adapt to the conventions below.

---

## 1. Project structure

```
apps/mobile/
├── index.html              # Vite entry, base="/mobile/", PWA meta
├── vite.config.ts          # base: '/mobile/', outDir: 'build', plugins: [react(), tailwindcss()]
├── package.json            # React 19, Tailwind v4, Radix, lucide-react, vaul
├── src/
│   ├── main.tsx            # ReactDOM.createRoot(...).render(<App/>)
│   ├── App.tsx             # AccessibilityProvider → GameStateProvider → NavigatorProvider → AppShell
│   ├── index.css           # ⚠️ empty — actual stylesheet is shared/styles/main.css
│   ├── styles/globals.css  # mobile-only overrides (legal embed, welcome buttons)
│   ├── components/
│   │   ├── AppShell.tsx    # screen renderer (giant switch on nav.screen)
│   │   ├── BottomNav.tsx
│   │   ├── screens/        # ⚠️ feature-level components live here, NOT under features/
│   │   │   ├── Home.tsx, Login.tsx, Profile.tsx, AccountSettings.tsx, …
│   │   └── ui/             # design-system primitives + Radix wrappers
│   │       ├── Button.tsx, Card.tsx, Badge.tsx, Tag.tsx, Screen.tsx, …
│   │       ├── accordion.tsx, dialog.tsx, popover.tsx, switch.tsx, …
│   │       └── utils.ts    # cn() helper (twMerge + clsx)
│   ├── hooks/              # useAccessibilityPreferences, useAuth, useNavigation, …
│   ├── state/store.tsx     # single GameStateProvider (5K LOC, ground truth for app state)
│   ├── handlers/, services/, lib/, gameplay/, router/, layouts/, types/, constants/, data/
│   └── assets/figma/       # raw Figma exports (use sparingly — prefer SVGs/icons elsewhere)
└── build/                  # vite output — `assets/*.{js,css}` and `sw.js` are gitignored
```

The repo is a monorepo with `apps/mobile`, `apps/pwa`, `apps/control-plane`.
Shared CSS lives in `shared/styles/` and is imported from `apps/mobile/src/main.tsx`.

---

## 2. Frameworks & libraries

| Concern        | Stack                                                                |
| -------------- | -------------------------------------------------------------------- |
| Framework      | **React 19** (function components, hooks; no class components)       |
| Bundler        | **Vite 7** (`@vitejs/plugin-react-swc`)                              |
| Styling        | **Tailwind CSS v4** via `@tailwindcss/vite` plugin                   |
| Headless UI    | **Radix UI** primitives wrapped in `src/components/ui/*`             |
| Icons          | **lucide-react** (only — no other icon library)                      |
| Variants       | **class-variance-authority** (`cva`) for component variants          |
| Class merging  | **tailwind-merge** + **clsx**, exported as `cn()` from `ui/utils.ts` |
| State          | Custom React Context (`GameStateProvider` in `state/store.tsx`)      |
| Drawer/Sheet   | **vaul**                                                             |
| Tests          | **vitest**                                                           |
| Lint           | ESLint 9 (flat config) + Biome for formatting                        |

> **Do not** add new icon libraries, CSS-in-JS runtimes, state managers
> (Redux/Zustand/Jotai), or routing libraries. The app uses an internal
> `NavigatorProvider` + a screen-name `switch` in `AppShell.tsx`.

---

## 3. Token definitions

### 3a. Source of truth: `shared/styles/main.css`

All design tokens are CSS custom properties on `:root`. The `:root` block
defines the **dark palette** (default); `html[data-theme="light"]`
overrides for light theme. Tokens in groups:

```css
:root {
  /* Brand palette */
  --color-burgundy-950: #2d0a0f;
  --color-burgundy-900: #4a0e1a;
  --color-burgundy-800: #6b1529;
  --color-burgundy-700: #8c1c38;
  --color-burgundy-600: #a82847;
  --color-burgundy-500: #c23456;
  --color-gold-400:    #f4bf4f;
  --color-gold-500:    #e6a23c;
  --color-gold-600:    #d48806;

  /* Surface / text (theme-aware) */
  --color-bg-primary:           #0f0d0e;
  --color-bg-surface:           #1a1617;
  --color-bg-surface-elevated:  #241f20;
  --color-bg-surface-hover:     #2d2728;
  --color-text-primary:         #f5f5f5;
  --color-text-secondary:       #b8b2b3;
  --color-text-tertiary:        #9a9697;

  /* State */
  --color-success: #52c41a;
  --color-error:   #ff4d4f;
  --color-warning: #faad14;

  /* Spacing (lg-prefixed) */
  --space-xs: 0.25rem; --space-sm: 0.5rem; --space-md: 1rem;
  --space-lg: 1.5rem;  --space-xl: 2rem;   --space-2xl: 3rem;

  /* Radii */
  --radius-sm: 0.5rem;  --radius-md: 0.75rem;
  --radius-lg: 1rem;    --radius-xl: 1.5rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -1px rgba(0,0,0,0.3);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.4);

  /* Type scale (heading-N tokens) */
  --heading-1-size: 2rem;     --heading-1-line: 1.2; --heading-1-weight: 700;
  --heading-2-size: 1.5rem;   --heading-2-line: 1.3; --heading-2-weight: 700;
  --heading-3-size: 1.25rem;  --heading-3-line: 1.4; --heading-3-weight: 600;

  /* Safe-area insets */
  --safe-area-inset-top:    env(safe-area-inset-top, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  /* … plus right/left */

  /* Theme-aware semantic tokens (default = dark) */
  --color-accent:        var(--color-gold-400);
  --color-accent-strong: var(--color-gold-500);
  --color-border:        #2d2728;
  --color-border-strong: #3d3a3b;
  --color-warning-surface: #2a1f14;
}
```

### 3b. Token transformation: utility-class override layer

Components were historically written with **Tailwind arbitrary values**
(`bg-[#1a1617]`, `text-[#b8b2b3]`, …) which bake hex literals into the
compiled CSS and break theme switching. We solved this without touching
600+ component sites by adding a `@layer utilities` block in
`shared/styles/main.css` that **remaps** the most-used hex utilities to
CSS variables:

```css
@layer utilities {
  .bg-\[\#1a1617\]    { background-color: var(--color-bg-surface); }
  .bg-\[\#241f20\]    { background-color: var(--color-bg-surface-elevated); }
  .text-\[\#b8b2b3\]  { color: var(--color-text-secondary); }
  .text-\[\#f4bf4f\]  { color: var(--color-accent); }
  .border-\[\#2d2728\]{ border-color: var(--color-border); }
  .bg-\[\#1a1617\]\/90{ background-color: color-mix(in srgb, var(--color-bg-surface) 90%, transparent); }
  /* …gradient stops via --tw-gradient-from / --to / --via … */
}
```

**Rule when porting a Figma design**: if the design uses one of the
"surface", "border", or "text" hex colors above, **prefer** writing the
arbitrary class (e.g. `bg-[#1a1617]`) — it will theme-flip automatically.
For new colors, **add a CSS variable** in `shared/styles/main.css` and a
matching utility override; do **not** scatter new hex literals across
components.

### 3c. Compatibility tokens: `shared/styles/extracted-pwa-styles/tokens.css`

Older PWA-derived tokens (`--color-brand-500`, `--color-surface-800`,
`--color-neutral-200`, …) are mapped onto the canonical theatre tokens.
Treat that file as a **legacy alias layer** — do not add new tokens
there; add them to `main.css` instead.

---

## 4. Component library

### 4a. Architecture

Two-tier component model under `src/components/`:

1. **`ui/`** — design-system primitives. Two flavours:
   - **Custom-built**: `Button`, `Card`, `Badge`, `Tag`, `Screen`,
     `Input`, `FormField`, `MetricTile`, `ProgressBar` … (named
     exports, PascalCase files).
   - **Radix-wrapped**: `accordion.tsx`, `dialog.tsx`, `popover.tsx`,
     `switch.tsx`, `tabs.tsx`, … These follow the **shadcn/ui** pattern
     (lower-case file, multiple named exports, `data-slot` attributes,
     `cn()` for class merging). New Radix wrappers should follow the
     same shape.

2. **`screens/`** — feature/page-level components, one per app screen.
   PascalCase. Each screen is rendered from `AppShell.tsx`'s `switch
   (nav.screen)`. Adding a new screen means: (a) create
   `screens/Foo.tsx`, (b) add a `case 'foo'` in `AppShell`, (c) add it
   to the navigator route table.

### 4b. Component conventions

```tsx
// src/components/ui/Button.tsx — canonical pattern using cva()
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl transition-all duration-200',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-b from-[#8c1c38] to-[#a82847] text-white …',
        outline: 'border border-[#2d2728] bg-transparent text-[#f7f3f4] …',
        ghost:   'text-[#f4bf4f] hover:bg-[#241f20] …',
      },
      size: { sm: 'px-4 py-2 text-sm', md: 'px-6 py-3 text-base', lg: 'px-8 py-4 text-lg' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export function Button({ variant, size, fullWidth, className, ...props }: ButtonProps) {
  return <Comp className={cn(buttonVariants({ variant, size }), fullWidth && 'w-full', className)} {...props} />;
}
```

Conventions:
- **Function components only**, named (not default) exports.
- Variants via `cva()`; never an ad-hoc `if/else` ternary tower for
  variant styles.
- Always use `cn(...)` for class composition (never raw template
  strings concatenated with `${maybeClass}`).
- Props are explicit TypeScript interfaces (no `any`). Optional
  Radix-style polymorphism via `asChild` + `<Slot>` where needed.
- Accessibility: icon-only buttons need `aria-label`; decorative icons
  inside labelled buttons should have `aria-hidden="true"`. Modal
  surfaces use the Radix wrappers in `ui/` which handle focus traps.

### 4c. Layout primitives

Use `ui/Screen.tsx` as the page shell — it handles safe-area padding,
bottom-nav offset, and the `app-content` width clamp.

```tsx
<Screen withBottomNavPadding contentClassName="space-y-5 pt-8">
  {/* page content */}
</Screen>
```

Width breakpoints (defined in `main.css`):

```css
.app-content { max-width: 100% }
@media (min-width: 768px)  { .app-content { max-width: 720px } }
@media (min-width: 1024px) { .app-content { max-width: 840px } }
```

> No Storybook. No Chromatic. There is no component documentation site;
> this file is the canonical reference.

---

## 5. Styling approach

- **Tailwind v4** with the Vite plugin. Source globs are declared in
  `shared/styles/main.css` via `@source "../../apps/mobile/src/**/*.{ts,tsx,…}"`.
- **No PostCSS config**, no `tailwind.config.{js,ts}` file — Tailwind v4
  reads its config from `@theme` directives in CSS (this codebase does
  not currently use `@theme`; it relies on raw CSS variables).
- **No CSS-in-JS** (styled-components, emotion). No CSS Modules.
  All styling is utility-class via Tailwind + a small set of custom
  CSS classes in `shared/styles/main.css` for things Tailwind can't
  express (e.g. `app-shell`, `app-gradient`, `mobile-card-hover`,
  animations, scrollbar styling).

### 5a. Animation classes

Defined in `main.css`. Prefer them over inline `style={{ animation: … }}`:

```
mobile-badge-pop, mobile-hero-reveal, mobile-pulse-once, mobile-card-hover,
tab-slide-{left,right,up,down}, tab-fade-in, tab-icon-pulse,
animate-card-in, animate-shimmer, animate-number-pop, animate-float,
animate-stagger-{1..6}, animate-tutorial-{fade,tooltip,spotlight}-…,
welcome-logo-pulse, secret-badge-shimmer, secret-badge-frame, secret-badge-label
```

All animations have `@media (prefers-reduced-motion: reduce)` guards.
Any new animation **must** include a reduced-motion override.

### 5b. Responsive design

Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`). The app is
mobile-first; most layouts assume <640px viewport. Use safe-area insets
for fixed elements (`var(--safe-area-inset-top|bottom|right|left)`).

### 5c. Theme switching

`useAccessibilityPreferences` (in `src/hooks/useAccessibilityPreferences.tsx`)
sets `<html data-theme="dark|light">`, `<html data-font-scale="sm|md|lg|xl">`,
and `<html style="font-size: …">`. Components don't read the theme — the
CSS variables and utility overrides do all the work.

---

## 6. Asset management

- **Static assets**: `apps/mobile/public/` (icons, manifest, qrcodes,
  service worker). Files here are served from `/mobile/<filename>` in
  production due to `vite.config.ts` `base: '/mobile/'`.
- **Icons (PWA)**: `public/icons/pwa-{48,96,144,180,192,512}.png` —
  referenced from `index.html` and `manifest.webmanifest`.
- **Figma exports / SVGs**: `src/assets/figma/`. Only one file there
  today (`welcome-logo.svg`). Import as a module and inline:
  ```tsx
  import welcomeLogo from '../../assets/figma/welcome-logo.svg';
  <img src={welcomeLogo} alt="Turni di Palco" />
  ```
- **Profile images / user uploads**: stored in Supabase Storage; URLs
  passed through component props (`profileImage` etc.).
- **No CDN / image optimisation pipeline**. Vite emits hashed asset
  filenames; that's it. Keep raster assets reasonably small.
- Do **not** commit `apps/mobile/build/` artifacts — `build/assets/*.{js,css}`
  and `build/sw.js` are gitignored. Tracked items under `build/` are
  **only** the manifest, icons, favicon, and qrcodes.

---

## 7. Icon system

**Single source: [`lucide-react`](https://lucide.dev/icons)**.

```tsx
import { ArrowLeft, Camera, X, Bell } from 'lucide-react';

<button type="button" onClick={onBack} aria-label="Indietro">
  <ArrowLeft size={24} aria-hidden="true" />
</button>
```

Conventions:
- Import each icon individually by PascalCase name (tree-shakeable).
- Pass `size` (in px) and optionally `strokeWidth`. Prefer `size`
  prop over `width/height` style.
- Color via Tailwind `text-…` class on the icon or its parent button:
  `<X className="text-[#f4bf4f]" size={22} />`.
- For decorative icons inside labelled buttons, set `aria-hidden="true"`.
  For icon-only buttons, set `aria-label="…"` on the `<button>`.

If a Figma component uses an icon not in lucide-react, **first** check
for a close lucide equivalent. Only inline an SVG (saved into
`src/assets/figma/`) as a last resort.

---

## 8. Mapping Figma → this codebase

When Figma MCP returns reference React + Tailwind code, transform it
through this checklist:

1. **Replace any imported component library** (e.g. shadcn from
   `@/components/ui/...`) with this repo's equivalents in
   `src/components/ui/`. The wrappers exist for `accordion`, `alert`,
   `alert-dialog`, `avatar`, `badge` (use `Badge.tsx`), `breadcrumb`,
   `calendar`, `card` (use `Card.tsx`), `carousel`, `checkbox`,
   `collapsible`, `command`, `context-menu`, `dialog`, `drawer`,
   `dropdown-menu`, `form`, `hover-card`, `input-otp`, `label`,
   `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`,
   `radio-group`, `resizable`, `scroll-area`, `select`, `separator`,
   `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`,
   `table`, `tabs`, `textarea`, `toggle-group`, `toggle`, `tooltip`.
2. **Map color tokens** to the existing palette (see §3a):
   - Surface backgrounds → `bg-[#1a1617]` / `bg-[#241f20]` / `bg-[#0f0d0e]`
   - Body text → `text-[#f5f5f5]` (primary) / `text-[#b8b2b3]` (secondary) / `text-[#9a9697]` (tertiary)
   - Gold accent → `text-[#f4bf4f]`; deeper gold → `text-[#e6a23c]`
   - Burgundy hero → `bg-gradient-to-b from-[#8c1c38] to-[#a82847]` (or `from-[#a82847] to-[#6b1529]`)
   - Border → `border-[#2d2728]` (subtle) / `border-[#3d3a3b]` (strong)
   - Error / success → `text-[#ff4d4f]` / `text-[#52c41a]`
   These all theme-flip via the override layer; do not invent new hex
   shades unless the design genuinely requires a brand-new color.
3. **Replace icons** with `lucide-react` equivalents.
4. **Use the project's `cn()` helper** for class composition:
   `import { cn } from '../ui/utils';`
5. **Wrap pages in `<Screen>`** rather than ad-hoc `<div className="min-h-screen …">`.
6. **Add aria-labels** to icon-only buttons before considering the port
   complete (WCAG 2.1 AA is a project target — see issue #476).
7. **Animations** from the design get one of the named animation
   classes in §5a. Don't introduce new keyframes without a
   `prefers-reduced-motion: reduce` guard.
8. **Localisation**: user-facing strings are Italian. Use
   short, idiomatic Italian (e.g. "Indietro", "Esci", "Conferma").
9. **Spacing**: prefer Tailwind scale (`p-4`, `gap-3`) and the
   `--space-*` variables; the codebase mixes both — match the
   surrounding screen's style.

---

## 9. What NOT to do

- ❌ Don't add new icon libraries (lucide only).
- ❌ Don't introduce CSS-in-JS or CSS Modules.
- ❌ Don't write new global styles in `apps/mobile/src/index.css`
   (it is intentionally empty); put them in `shared/styles/main.css`.
- ❌ Don't hardcode new hex colors in components when one of the
   semantic tokens fits — add a CSS variable + utility override instead.
- ❌ Don't bypass the `Screen` / `app-content` layout primitives for
   page chrome.
- ❌ Don't use `default` exports for components.
- ❌ Don't paste Figma MCP's reference code as-is — always adapt.

---

## 10. Quick reference — file paths

| Need                                | Path                                                          |
| ----------------------------------- | ------------------------------------------------------------- |
| Color/spacing/typography tokens     | `shared/styles/main.css` (`:root`, `html[data-theme="light"]`) |
| Utility-class theme overrides       | `shared/styles/main.css` (`@layer utilities`)                 |
| Animation keyframes & classes       | `shared/styles/main.css`                                      |
| Mobile-only style overrides         | `apps/mobile/src/styles/globals.css`                          |
| Custom UI primitives                | `apps/mobile/src/components/ui/`                              |
| Radix UI wrappers                   | `apps/mobile/src/components/ui/*.tsx` (lowercase filenames)   |
| `cn()` helper                       | `apps/mobile/src/components/ui/utils.ts`                      |
| Page-level components               | `apps/mobile/src/components/screens/`                         |
| Screen routing switch               | `apps/mobile/src/components/AppShell.tsx`                     |
| App-wide context providers          | `apps/mobile/src/App.tsx`                                     |
| Accessibility prefs (theme/font)    | `apps/mobile/src/hooks/useAccessibilityPreferences.tsx`       |
| Game/app state                      | `apps/mobile/src/state/store.tsx`                             |
| Vite config                         | `apps/mobile/vite.config.ts`                                  |
| Static PWA assets                   | `apps/mobile/public/`                                         |
| Raw Figma SVG exports               | `apps/mobile/src/assets/figma/`                               |
