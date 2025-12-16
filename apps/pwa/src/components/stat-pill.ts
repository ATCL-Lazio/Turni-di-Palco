import { colorTokens, radiusTokens, spacingTokens, typographyTokens } from "./tokens";

export type StatPillSize = "sm" | "md";
export type StatPillState = "default" | "positive" | "warning" | "danger";

export type StatPillProps = {
  label: string;
  value: string | number;
  icon?: string;
  size?: StatPillSize;
  state?: StatPillState;
  valueAttributes?: Record<string, string>;
};

type PillSizeConfig = { paddingY: string; paddingX: string; fontSize: string };

const sizeConfig: Record<StatPillSize, PillSizeConfig> = {
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

function valueAttributeString(valueAttributes?: Record<string, string>) {
  if (!valueAttributes) return "";
  return Object.entries(valueAttributes)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join("");
}

export function renderStatPill({
  label,
  value,
  icon,
  size = "md",
  state = "default",
  valueAttributes,
}: StatPillProps): string {
  const classes = ["stat-pill"];
  if (size === "sm") classes.push("stat-pill-sm");
  const iconMarkup = icon ? `<span class="pill-icon">${icon}</span>` : "";
  const sizeVars = sizeConfig[size];
  const valueAttrs = valueAttributeString(valueAttributes);
  const style = `style="--pill-py:${sizeVars.paddingY};--pill-px:${sizeVars.paddingX};--pill-fz:${sizeVars.fontSize};--pill-radius:${radiusTokens.pill};--pill-bg:${colorTokens.surface};--pill-border:${colorTokens.surfaceBorder};--pill-text:${colorTokens.text};--pill-muted:${colorTokens.muted};--pill-positive:${colorTokens.success};--pill-warning:${colorTokens.warning};--pill-danger:${colorTokens.danger};"`;

  return `<div class="${classes.join(" ")}" data-state="${state}" ${style}>${iconMarkup}<span>${label}</span><strong${valueAttrs}>${value}</strong></div>`;
}
