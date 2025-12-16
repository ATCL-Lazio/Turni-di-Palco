import { colorTokens, radiusTokens, spacingTokens, typographyTokens } from "./tokens";

export type ChipVariant = "solid" | "ghost";
export type ChipSize = "sm" | "md";
export type ChipState = "default" | "active" | "muted";

export type ChipProps = {
  label: string;
  href?: string;
  icon?: string;
  size?: ChipSize;
  variant?: ChipVariant;
  state?: ChipState;
  title?: string;
  dataAttributes?: Record<string, string>;
};

type ChipSizeConfig = { paddingY: string; paddingX: string; fontSize: string };

const sizeConfig: Record<ChipSize, ChipSizeConfig> = {
  sm: {
    paddingY: spacingTokens.xs,
    paddingX: spacingTokens.sm,
    fontSize: typographyTokens.tiny,
  },
  md: {
    paddingY: spacingTokens.sm,
    paddingX: spacingTokens.md,
    fontSize: typographyTokens.small,
  },
};

function dataAttributeString(dataAttributes?: Record<string, string>) {
  if (!dataAttributes) return "";
  return Object.entries(dataAttributes)
    .map(([key, value]) => ` data-${key}="${value}"`)
    .join("");
}

export function renderChip({
  label,
  href,
  icon,
  size = "md",
  variant = "solid",
  state = "default",
  title,
  dataAttributes,
}: ChipProps): string {
  const tag = href ? "a" : "button";
  const classes = ["chip"];
  if (variant === "ghost") classes.push("chip-ghost");
  if (size === "sm") classes.push("chip-sm");
  const iconMarkup = icon ? `<span class="chip-icon">${icon}</span>` : "";
  const aria = title ? ` aria-label="${title}" title="${title}"` : "";
  const attrs = href ? `href="${href}"` : "type=\"button\"";
  const sizeVars = sizeConfig[size];
  const dataAttrs = dataAttributeString(dataAttributes);
  const style = `style="--chip-py:${sizeVars.paddingY};--chip-px:${sizeVars.paddingX};--chip-fz:${sizeVars.fontSize};--chip-radius:${radiusTokens.pill};--chip-bg:${colorTokens.surface};--chip-border:${colorTokens.surfaceBorder};--chip-hover-border:${colorTokens.surfaceHoverBorder};--chip-active-bg:${colorTokens.accentTint};--chip-active-border:${colorTokens.accentBorder};"`;

  return `<${tag} class="${classes.join(" ")}" data-state="${state}" ${attrs}${aria} ${style}${dataAttrs}>${iconMarkup}<span>${label}</span></${tag}>`;
}
