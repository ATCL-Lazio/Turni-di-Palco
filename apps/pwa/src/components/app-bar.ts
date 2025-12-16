import { renderChip, ChipProps } from "./chip";

export type AppBarProps = {
  eyebrow?: string;
  subtitle?: string;
  brandMark?: string;
  actions?: ChipProps[];
};

export function renderAppBar({ eyebrow = "Turni di Palco", subtitle, brandMark = "TdP", actions = [] }: AppBarProps) {
  const chips = actions.map((chip) => renderChip({ ...chip, variant: chip.variant ?? "ghost", size: chip.size ?? "sm" })).join("");

  return `
    <header class="app-bar">
      <div class="app-brand">
        <span class="brand-mark">${brandMark}</span>
        <div>
          <p class="eyebrow">${eyebrow}</p>
          <p class="muted tiny">${subtitle ?? ""}</p>
        </div>
      </div>
      <div class="chip-row">${chips}</div>
    </header>
  `;
}
