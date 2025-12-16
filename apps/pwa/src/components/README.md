# Componenti UI PWA

Set di componenti a template string pensati per riutilizzare i token stilistici della PWA.
Ogni componente restituisce markup HTML pronto per essere inserito nelle pagine vanilla JS/TS.

## Tokens
- Definiti in `tokens.ts` con palette, raggi e spaziature condivise.
- Le varianti dei componenti impostano CSS custom properties per mantenere lo stile coerente con `style.css`.

## Componenti
- `renderChip(props)`: pill/link con varianti `solid` o `ghost`, dimensioni `sm|md`, icona opzionale e stato (`default|active|muted`).
- `renderStatPill(props)`: indicatore di statistica con varianti di stato (`default|positive|warning|danger`), dimensioni `sm|md` e icona opzionale.
- `renderAppBar(props)`: intestazione brand + navigazione; compone internamente chip ghost piccoli.

### Esempi rapidi
```ts
import { renderChip } from "./components/chip";
import { renderStatPill } from "./components/stat-pill";

const nav = renderChip({ label: "Home", href: "/", icon: "🏠", state: "active" });
const stat = renderStatPill({ label: "XP", value: 120, state: "positive", icon: "⭐" });
```

Incorpora il markup concatenandolo nelle sezioni HTML delle pagine (`innerHTML`) o usando `insertAdjacentHTML`.
