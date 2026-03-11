import type { AvatarIcon, AvatarSettings } from "./types";
import { deriveRpmThumbnail } from "./state";

export type AvatarVisual = {
  color: string;
  icon: string;
  image: string;
};

const DEFAULT_HUE = 210;
const ICON_MAP: Record<AvatarIcon, string> = {
  mask: "M",
  spot: "L",
  gear: "T",
  note: "N",
};

function normalizeHue(value: number | undefined, fallback = DEFAULT_HUE) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(360, Math.round(value)));
}

export function getAvatarVisual(avatar: AvatarSettings): AvatarVisual {
  const hue = normalizeHue(avatar.hue, DEFAULT_HUE);
  const icon = ICON_MAP[avatar.icon] ?? ICON_MAP.mask;
  const image = avatar.rpmThumbnail || deriveRpmThumbnail(avatar.rpmUrl) || "";
  return {
    color: `hsl(${hue}deg 75% 55%)`,
    icon,
    image,
  };
}
