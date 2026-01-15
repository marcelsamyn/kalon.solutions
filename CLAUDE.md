# Kalon Solutions

Static company landing page built with Astro.

## Design Language

- **Feel**: Paper-like warmth with subtle godray from top-left
- **Typography**: Lora (serif) for headings, IBM Plex Sans for body
- **Colors**: Blue (teal) for primary/headers, gray (warm) for text/backgrounds, orange for accents

## Tech Stack

- **Framework**: Astro 5
- **Styling**: Tailwind CSS v4 (via Vite plugin)
- **Interactivity**: Qwik (for interactive islands when needed)
- **Package Manager**: pnpm

## Commands

```bash
pnpm dev        # Start dev server at localhost:4321
pnpm build      # Build for production to ./dist/
pnpm preview    # Preview production build locally
```

## Project Structure

```
src/
├── assets/          # Static assets (images, SVGs)
├── components/      # Astro and Qwik components
│   └── *.astro      # Astro components
│   └── *.tsx        # Qwik components (for interactivity)
├── layouts/
│   └── Layout.astro # Base HTML layout
├── pages/           # File-based routing
│   └── index.astro  # Homepage (/)
└── styles/
    └── global.css   # Tailwind imports and theme customization
```

## Tailwind v4

Theme customization is done in `src/styles/global.css` using the `@theme` directive:

```css
@theme {
  --color-primary-500: oklch(0.55 0.18 250);
}
```

Use custom colors with Tailwind classes: `bg-primary-500`, `text-primary-600`, etc.

## Qwik Components

For interactive components, create `.tsx` files in `src/components/`:

```tsx
import { component$, useSignal } from "@builder.io/qwik";

export const Counter = component$(() => {
  const count = useSignal(0);
  return <button onClick$={() => count.value++}>{count.value}</button>;
});
```

Use in Astro files:

```astro
---
import { Counter } from "../components/Counter";
---
<Counter client:visible />
```

Client directives: `client:load`, `client:visible`, `client:idle`, `client:only="qwik"`
